// Package indexer implements the `solo-search index` behavior: walking the
// root folder for HTML notes, extracting paragraph chunks, embedding
// changed content, and persisting it into the SQLite store. Indexing is
// incremental: files whose content hash (HTML + sidecar JSON) has not
// changed since the last run are skipped entirely.
package indexer

import (
	"fmt"
	"os"
	"time"

	"github.com/solo-notes/semantic-search/internal/embedding"
	"github.com/solo-notes/semantic-search/internal/fsutil"
	"github.com/solo-notes/semantic-search/internal/htmlparse"
	"github.com/solo-notes/semantic-search/internal/metadata"
	"github.com/solo-notes/semantic-search/internal/store"
)

// ModelVersionTag should change whenever the embedding model or tokenizer
// changes in a way that makes previously stored vectors incomparable to
// newly computed ones. Bump this alongside store.SchemaVersion when
// swapping models.
const ModelVersionTag = "all-MiniLM-L6-v2-onnx-v1"

// Options configures a single indexing run.
type Options struct {
	Root  string
	Store *store.Store
	Model *embedding.Model
	// Progress, if non-nil, is called after each processed file.
	Progress func(processed, total int, relPath string)
}

// Result summarizes the outcome of an indexing run.
type Result struct {
	FilesScanned  int
	FilesIndexed  int
	FilesSkipped  int
	FilesRemoved  int
	ParagraphsNew int
}

// Run performs a full incremental index pass: it walks the root for HTML
// notes, re-embeds any file whose content hash changed (or whose stored
// model version differs from ModelVersionTag), and removes index entries
// for files that no longer exist on disk.
func Run(opts Options) (*Result, error) {
	res := &Result{}

	storedModelVersion, err := opts.Store.GetModelVersion()
	if err != nil {
		return nil, fmt.Errorf("reading stored model version: %w", err)
	}
	forceReindex := storedModelVersion != ModelVersionTag

	notes, err := fsutil.WalkNotes(opts.Root)
	if err != nil {
		return nil, fmt.Errorf("walking root folder: %w", err)
	}
	res.FilesScanned = len(notes)

	seen := make(map[string]bool, len(notes))

	for i, note := range notes {
		seen[note.RelPath] = true

		sidecarPath := metadata.SidecarPath(note.AbsPath)
		hash, err := fsutil.ContentHash(note.AbsPath, sidecarPath)
		if err != nil {
			return nil, fmt.Errorf("hashing %q: %w", note.RelPath, err)
		}

		if !forceReindex {
			existingHash, err := opts.Store.GetFileHash(note.RelPath)
			if err != nil {
				return nil, fmt.Errorf("checking existing hash for %q: %w", note.RelPath, err)
			}
			if existingHash == hash {
				res.FilesSkipped++
				if opts.Progress != nil {
					opts.Progress(i+1, len(notes), note.RelPath)
				}
				continue
			}
		}

		n, err := indexOneFile(opts, note, sidecarPath, hash)
		if err != nil {
			return nil, fmt.Errorf("indexing %q: %w", note.RelPath, err)
		}
		res.FilesIndexed++
		res.ParagraphsNew += n

		if opts.Progress != nil {
			opts.Progress(i+1, len(notes), note.RelPath)
		}
	}

	// Remove entries for files that no longer exist under root.
	existingPaths, err := opts.Store.AllFilePaths()
	if err != nil {
		return nil, fmt.Errorf("listing indexed files: %w", err)
	}
	for _, p := range existingPaths {
		if !seen[p] {
			if err := opts.Store.DeleteFile(p); err != nil {
				return nil, fmt.Errorf("removing stale entry %q: %w", p, err)
			}
			res.FilesRemoved++
		}
	}

	if err := opts.Store.SetModelVersion(ModelVersionTag); err != nil {
		return nil, fmt.Errorf("recording model version: %w", err)
	}
	if err := opts.Store.SetLastFullIndex(time.Now()); err != nil {
		return nil, fmt.Errorf("recording last index time: %w", err)
	}

	return res, nil
}

func indexOneFile(opts Options, note fsutil.NoteFile, sidecarPath, hash string) (int, error) {
	htmlBytes, err := os.ReadFile(note.AbsPath)
	if err != nil {
		return 0, fmt.Errorf("reading html: %w", err)
	}

	paragraphs, err := htmlparse.ExtractParagraphs(string(htmlBytes))
	if err != nil {
		return 0, fmt.Errorf("parsing html: %w", err)
	}

	meta, err := metadata.Load(note.AbsPath)
	if err != nil {
		return 0, fmt.Errorf("loading metadata: %w", err)
	}

	fileRec := store.FileRecord{
		Path:        note.RelPath,
		ContentHash: hash,
		NoteID:      meta.ID,
		Tags:        meta.Tags,
		Theme:       meta.Theme,
		CreatedAt:   meta.CreatedAt,
		IndexedAt:   time.Now(),
	}

	// A note with no indexable paragraphs still needs its file record
	// written (with the new hash) so it isn't re-processed every run.
	if len(paragraphs) == 0 {
		if err := opts.Store.IndexFile(fileRec, nil); err != nil {
			return 0, fmt.Errorf("writing file record: %w", err)
		}
		return 0, nil
	}

	texts := make([]string, len(paragraphs))
	for i, p := range paragraphs {
		texts[i] = p.Text
	}

	embeddings, err := opts.Model.EmbedBatch(texts)
	if err != nil {
		return 0, fmt.Errorf("embedding paragraphs: %w", err)
	}

	records := make([]store.ParagraphRecord, len(paragraphs))
	for i, p := range paragraphs {
		records[i] = store.ParagraphRecord{
			FilePath:      note.RelPath,
			ParagraphIdx:  p.Index,
			Tag:           p.Tag,
			Text:          p.Text,
			ParagraphTags: p.ParagraphTags,
			Embedding:     embeddings[i],
		}
	}

	// Persist the file record and all its paragraphs atomically in a single
	// transaction (one fsync instead of one-per-paragraph).
	if err := opts.Store.IndexFile(fileRec, records); err != nil {
		return 0, fmt.Errorf("indexing file: %w", err)
	}

	return len(paragraphs), nil
}
