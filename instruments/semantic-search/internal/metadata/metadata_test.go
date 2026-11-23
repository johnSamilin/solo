package metadata

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadMissingSidecar(t *testing.T) {
	dir := t.TempDir()
	notePath := filepath.Join(dir, "note.html")
	if err := os.WriteFile(notePath, []byte("<p>hi</p>"), 0o644); err != nil {
		t.Fatalf("writing note: %v", err)
	}

	meta, err := Load(notePath)
	if err != nil {
		t.Fatalf("Load error: %v", err)
	}
	if meta.ID != "" || len(meta.Tags) != 0 {
		t.Errorf("expected zero-value metadata, got %+v", meta)
	}
}

func TestLoadValidSidecar(t *testing.T) {
	dir := t.TempDir()
	notePath := filepath.Join(dir, "note.html")
	jsonPath := SidecarPath(notePath)
	content := `{
		"id": "note-1",
		"tags": ["journal", "project/alpha"],
		"createdAt": "2024-01-01T00:00:00Z",
		"theme": "dark",
		"paragraphTags": ["p1", "p2"]
	}`
	if err := os.WriteFile(jsonPath, []byte(content), 0o644); err != nil {
		t.Fatalf("writing sidecar: %v", err)
	}

	meta, err := Load(notePath)
	if err != nil {
		t.Fatalf("Load error: %v", err)
	}
	if meta.ID != "note-1" {
		t.Errorf("ID = %q, want %q", meta.ID, "note-1")
	}
	if len(meta.Tags) != 2 {
		t.Errorf("Tags = %v, want 2 entries", meta.Tags)
	}
	if meta.Theme != "dark" {
		t.Errorf("Theme = %q, want %q", meta.Theme, "dark")
	}
	if len(meta.ParagraphTags) != 2 {
		t.Errorf("ParagraphTags = %v, want 2 entries", meta.ParagraphTags)
	}
}

func TestAllTagsDedup(t *testing.T) {
	meta := &FileMetadata{
		Tags:          []string{"journal", "shared"},
		ParagraphTags: []string{"shared", "p1"},
	}
	all := meta.AllTags()
	if len(all) != 3 {
		t.Fatalf("expected 3 unique tags, got %v", all)
	}
}

func TestSidecarPath(t *testing.T) {
	got := SidecarPath("/root/notes/hello.html")
	want := "/root/notes/hello.json"
	if got != want {
		t.Errorf("SidecarPath() = %q, want %q", got, want)
	}
}
