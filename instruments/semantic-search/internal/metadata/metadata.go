// Package metadata reads the sidecar JSON metadata files that accompany
// each HTML note (same base name, .json extension), mirroring the
// FileMetadata TypeScript type used by the Solo Electron/React app.
package metadata

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// FileMetadata mirrors src/types.tsx's FileMetadata interface.
type FileMetadata struct {
	ID            string   `json:"id"`
	Tags          []string `json:"tags"`
	CreatedAt     string   `json:"createdAt"`
	Theme         string   `json:"theme,omitempty"`
	ParagraphTags []string `json:"paragraphTags,omitempty"`
}

// SidecarPath returns the path to the JSON metadata file corresponding to
// an HTML (or other extension) note file path.
func SidecarPath(notePath string) string {
	ext := filepath.Ext(notePath)
	return strings.TrimSuffix(notePath, ext) + ".json"
}

// Load reads and parses the sidecar JSON metadata for the given note file
// path. If the sidecar file does not exist, it returns a zero-value
// FileMetadata and no error, treating the note as metadata-less.
func Load(notePath string) (*FileMetadata, error) {
	sidecar := SidecarPath(notePath)
	data, err := os.ReadFile(sidecar)
	if err != nil {
		if os.IsNotExist(err) {
			return &FileMetadata{}, nil
		}
		return nil, fmt.Errorf("reading metadata %q: %w", sidecar, err)
	}
	var meta FileMetadata
	if err := json.Unmarshal(data, &meta); err != nil {
		return nil, fmt.Errorf("parsing metadata %q: %w", sidecar, err)
	}
	return &meta, nil
}

// AllTags returns the union of file-level tags and paragraph tags, useful
// for tag-expression evaluation at the file level.
func (m *FileMetadata) AllTags() []string {
	seen := make(map[string]bool, len(m.Tags)+len(m.ParagraphTags))
	var out []string
	add := func(t string) {
		if t == "" || seen[t] {
			return
		}
		seen[t] = true
		out = append(out, t)
	}
	for _, t := range m.Tags {
		add(t)
	}
	for _, t := range m.ParagraphTags {
		add(t)
	}
	return out
}
