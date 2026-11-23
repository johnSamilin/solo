// Package fsutil provides small filesystem helpers shared by the indexer:
// walking the notes root while skipping the index folder itself, and
// computing a stable content hash for a note + its sidecar metadata.
package fsutil

import (
	"crypto/sha256"
	"encoding/hex"
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	"github.com/solo-notes/semantic-search/internal/config"
)

// NoteFile describes a discovered HTML note file relative to the root.
type NoteFile struct {
	// AbsPath is the absolute path to the .html file.
	AbsPath string
	// RelPath is the path relative to the root folder (used as the stable
	// identifier stored in the index).
	RelPath string
}

// WalkNotes recursively finds all .html files under root, skipping the
// .solo-index folder (and any dotfile-style hidden directories, to avoid
// picking up unrelated tool/version-control metadata).
func WalkNotes(root string) ([]NoteFile, error) {
	var notes []NoteFile
	err := filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		name := d.Name()
		if d.IsDir() {
			if name == config.IndexDirName || (strings.HasPrefix(name, ".") && path != root) {
				return filepath.SkipDir
			}
			return nil
		}
		if strings.HasSuffix(strings.ToLower(name), ".html") {
			rel, err := filepath.Rel(root, path)
			if err != nil {
				return err
			}
			notes = append(notes, NoteFile{AbsPath: path, RelPath: rel})
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return notes, nil
}

// ContentHash computes a stable hash over the note's HTML content plus its
// sidecar JSON metadata content (if present), so that changes to either
// file trigger re-indexing.
func ContentHash(htmlPath, sidecarPath string) (string, error) {
	h := sha256.New()

	htmlData, err := os.ReadFile(htmlPath)
	if err != nil {
		return "", err
	}
	h.Write(htmlData)
	h.Write([]byte{0})

	if sidecarData, err := os.ReadFile(sidecarPath); err == nil {
		h.Write(sidecarData)
	}

	return hex.EncodeToString(h.Sum(nil)), nil
}
