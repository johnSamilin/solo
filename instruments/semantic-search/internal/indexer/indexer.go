// Package indexer implements the `solo-search index` behavior: walking the
// root folder for HTML notes, extracting paragraph chunks, embedding
// changed content, and persisting it into the SQLite store. Indexing is
// incremental: files whose content hash (HTML + sidecar JSON) has not
// changed since the last run are skipped entirely.
package indexer

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/solo-notes/semantic-search/internal/embedding"
	"github.com/solo-notes/semantic-search/internal/fsutil"
	"github.com/solo-notes/semantic-search/internal/htmlparse"
	"github.com/solo-notes/semantic-search/internal/lexical"
	"github.com/solo-notes/semantic-search/internal/metadata"
	"github.com/solo-notes/semantic-search/internal/store"
)

// ModelVersionTag should change whenever the embedding model or tokenizer
// changes in a way that makes previously stored vectors incomparable to
// newly computed ones. Bump this alongside store.SchemaVersion when
// swapping models.
//
// Switched from the English-only all-MiniLM to the multilingual
// paraphrase-multilingual-MiniLM-L12-v2, plus the addition of stored lexical
// tokens for hybrid search — both force a full re-index of existing corpora.
const ModelVersionTag = "paraphrase-multilingual-MiniLM-L12-v2-hybrid-v1"

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

// OneOptions configures a single-file index update.
type OneOptions struct {
	Root  string
	Store *store.Store
	Model *embedding.Model
	// RelPath is the note's path relative to Root (matching the identifier
	// stored in the index). It must point at an .html note file.
	RelPath string
}

// RunOne (re)indexes a single note identified by opts.RelPath without
// walking or touching any other file in the corpus. It is meant for the
// common case where exactly one note changed and re-scanning the whole root
// would be wasteful.
//
// Behavior:
//   - If the note file exists on disk, its paragraphs are re-embedded and
//     its index entry is replaced (FilesIndexed=1), unless the stored
//     content hash already matches (FilesSkipped=1).
//   - If the note file no longer exists, its index entry (if any) is removed
//     (FilesRemoved=1).
//
// Unlike Run, RunOne never rewrites the stored model version or the
// last-full-index timestamp: it is an incremental patch, not a full pass. If
// the stored model version differs from ModelVersionTag the file is always
// re-embedded (a mixed-version index is still better than a stale entry, and
// a subsequent full `index` run will reconcile the rest).
func RunOne(opts OneOptions) (*Result, error) {
	res := &Result{FilesScanned: 1}

	if opts.RelPath == "" {
		return nil, fmt.Errorf("a note path is required")
	}

	absPath := filepath.Join(opts.Root, opts.RelPath)
	// Normalize RelPath back through filepath.Rel so callers may pass either
	// a path relative to root or an absolute path within root, and we store
	// the same canonical identifier the full walk would use.
	relPath, err := filepath.Rel(opts.Root, absPath)
	if err != nil {
		return nil, fmt.Errorf("resolving note path relative to root: %w", err)
	}

	info, statErr := os.Stat(absPath)
	if statErr != nil {
		if os.IsNotExist(statErr) {
			// The note was deleted: drop its index entry if present.
			if err := opts.Store.DeleteFile(relPath); err != nil {
				return nil, fmt.Errorf("removing index entry for %q: %w", relPath, err)
			}
			res.FilesRemoved = 1
			return res, nil
		}
		return nil, fmt.Errorf("stat %q: %w", relPath, statErr)
	}
	if info.IsDir() {
		return nil, fmt.Errorf("note path %q is a directory, not a file", relPath)
	}

	note := fsutil.NoteFile{AbsPath: absPath, RelPath: relPath}
	sidecarPath := metadata.SidecarPath(absPath)

	hash, err := fsutil.ContentHash(absPath, sidecarPath)
	if err != nil {
		return nil, fmt.Errorf("hashing %q: %w", relPath, err)
	}

	storedModelVersion, err := opts.Store.GetModelVersion()
	if err != nil {
		return nil, fmt.Errorf("reading stored model version: %w", err)
	}
	forceReindex := storedModelVersion != ModelVersionTag

	if !forceReindex {
		existingHash, err := opts.Store.GetFileHash(relPath)
		if err != nil {
			return nil, fmt.Errorf("checking existing hash for %q: %w", relPath, err)
		}
		if existingHash == hash {
			res.FilesSkipped = 1
			return res, nil
		}
	}

	n, err := indexOneFile(Options{Root: opts.Root, Store: opts.Store, Model: opts.Model}, note, sidecarPath, hash)
	if err != nil {
		return nil, fmt.Errorf("indexing %q: %w", relPath, err)
	}
	res.FilesIndexed = 1
	res.ParagraphsNew = n

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

	embeddings, err := opts.Model.EmbedPassageBatch(texts)
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
			// Precompute the language-aware stemmed tokens for the BM25
			// lexical track so querying never has to re-analyze documents.
			LexicalTokens: lexical.Analyze(p.Text),
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
