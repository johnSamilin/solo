package store

import (
	"math"
	"path/filepath"
	"testing"
	"time"
)

func TestEmbeddingQuantizationRoundTrip(t *testing.T) {
	cases := [][]float32{
		{0, 0, 0, 0},                      // all-zero
		{1, -1, 0.5, -0.5},                // extremes
		{0.0123, -0.0456, 0.9876, -0.321}, // typical normalized-ish values
	}
	for ci, orig := range cases {
		blob := encodeEmbedding(orig)
		// int8 layout: 4 bytes scale + 1 byte per component.
		if want := 4 + len(orig); len(blob) != want {
			t.Errorf("case %d: blob len = %d, want %d", ci, len(blob), want)
		}
		got := decodeEmbedding(blob)
		if len(got) != len(orig) {
			t.Fatalf("case %d: decoded len = %d, want %d", ci, len(got), len(orig))
		}
		// Tolerance ~ maxAbs/127.
		var maxAbs float32
		for _, f := range orig {
			if a := float32(math.Abs(float64(f))); a > maxAbs {
				maxAbs = a
			}
		}
		tol := maxAbs/127 + 1e-6
		for i := range orig {
			if diff := float32(math.Abs(float64(got[i] - orig[i]))); diff > tol {
				t.Errorf("case %d component %d: got %v want %v (±%v)", ci, i, got[i], orig[i], tol)
			}
		}
	}
}

func TestIndexFileAtomic(t *testing.T) {
	s := openTestStore(t)

	rec := FileRecord{
		Path:        "notes/a.html",
		ContentHash: "h1",
		NoteID:      "n1",
		Tags:        []string{"x"},
		CreatedAt:   "2024-01-01T00:00:00Z",
		IndexedAt:   time.Now(),
	}
	paras := []ParagraphRecord{
		{FilePath: rec.Path, ParagraphIdx: 0, Tag: "p", Text: "one", Embedding: []float32{0.1, 0.2}},
		{FilePath: rec.Path, ParagraphIdx: 1, Tag: "p", Text: "two", Embedding: []float32{0.3, 0.4}},
	}
	if err := s.IndexFile(rec, paras); err != nil {
		t.Fatalf("IndexFile error: %v", err)
	}

	all, err := s.AllParagraphs()
	if err != nil {
		t.Fatalf("AllParagraphs error: %v", err)
	}
	if len(all) != 2 {
		t.Fatalf("expected 2 paragraphs, got %d", len(all))
	}

	// Re-index the same file with fewer paragraphs; old ones must be gone.
	rec.ContentHash = "h2"
	if err := s.IndexFile(rec, paras[:1]); err != nil {
		t.Fatalf("IndexFile (2nd) error: %v", err)
	}
	all, err = s.AllParagraphs()
	if err != nil {
		t.Fatalf("AllParagraphs error: %v", err)
	}
	if len(all) != 1 {
		t.Fatalf("expected 1 paragraph after re-index, got %d", len(all))
	}

	hash, err := s.GetFileHash(rec.Path)
	if err != nil {
		t.Fatalf("GetFileHash error: %v", err)
	}
	if hash != "h2" {
		t.Errorf("hash = %q, want h2", hash)
	}
}

func TestIndexFileNoParagraphs(t *testing.T) {
	s := openTestStore(t)
	rec := FileRecord{Path: "empty.html", ContentHash: "h1", IndexedAt: time.Now()}
	if err := s.IndexFile(rec, nil); err != nil {
		t.Fatalf("IndexFile error: %v", err)
	}
	paths, err := s.AllFilePaths()
	if err != nil {
		t.Fatalf("AllFilePaths error: %v", err)
	}
	if len(paths) != 1 || paths[0] != "empty.html" {
		t.Errorf("expected empty.html tracked, got %v", paths)
	}
}

func openTestStore(t *testing.T) *Store {
	t.Helper()
	dir := t.TempDir()
	s, err := Open(filepath.Join(dir, "index.db"))
	if err != nil {
		t.Fatalf("Open() error: %v", err)
	}
	t.Cleanup(func() { s.Close() })
	return s
}

func TestUpsertFileAndParagraphRoundTrip(t *testing.T) {
	s := openTestStore(t)

	rec := FileRecord{
		Path:        "notes/hello.html",
		ContentHash: "hash1",
		NoteID:      "note-1",
		Tags:        []string{"project/alpha", "journal"},
		Theme:       "dark",
		CreatedAt:   "2024-01-01T00:00:00Z",
		IndexedAt:   time.Now(),
	}
	if err := s.UpsertFile(rec); err != nil {
		t.Fatalf("UpsertFile error: %v", err)
	}

	embedding := []float32{0.1, 0.2, 0.3, -0.4}
	p := ParagraphRecord{
		FilePath:      rec.Path,
		ParagraphIdx:  0,
		Tag:           "p",
		Text:          "Hello world",
		ParagraphTags: []string{"greeting"},
		Embedding:     embedding,
	}
	if err := s.InsertParagraph(p); err != nil {
		t.Fatalf("InsertParagraph error: %v", err)
	}

	hash, err := s.GetFileHash(rec.Path)
	if err != nil {
		t.Fatalf("GetFileHash error: %v", err)
	}
	if hash != rec.ContentHash {
		t.Errorf("GetFileHash() = %q, want %q", hash, rec.ContentHash)
	}

	all, err := s.AllParagraphs()
	if err != nil {
		t.Fatalf("AllParagraphs error: %v", err)
	}
	if len(all) != 1 {
		t.Fatalf("expected 1 paragraph, got %d", len(all))
	}
	got := all[0]
	if got.Text != p.Text || got.FilePath != p.FilePath || got.Tag != p.Tag {
		t.Errorf("unexpected paragraph record: %+v", got)
	}
	if len(got.ParagraphTags) != 1 || got.ParagraphTags[0] != "greeting" {
		t.Errorf("unexpected paragraph tags: %v", got.ParagraphTags)
	}
	if len(got.FileTags) != 2 {
		t.Errorf("unexpected file tags: %v", got.FileTags)
	}
	if len(got.Embedding) != len(embedding) {
		t.Fatalf("embedding length mismatch: got %d, want %d", len(got.Embedding), len(embedding))
	}
	// Embeddings are stored int8-quantized, so allow a small per-component
	// tolerance (~ maxAbs/127) on round-trip.
	const tol = 0.01
	for i := range embedding {
		if diff := got.Embedding[i] - embedding[i]; diff > tol || diff < -tol {
			t.Errorf("embedding[%d] = %v, want %v (±%v)", i, got.Embedding[i], embedding[i], tol)
		}
	}
}

func TestUpsertFileClearsOldParagraphs(t *testing.T) {
	s := openTestStore(t)

	rec := FileRecord{Path: "a.html", ContentHash: "h1", IndexedAt: time.Now()}
	if err := s.UpsertFile(rec); err != nil {
		t.Fatalf("UpsertFile error: %v", err)
	}
	if err := s.InsertParagraph(ParagraphRecord{FilePath: rec.Path, Text: "old", Embedding: []float32{1}}); err != nil {
		t.Fatalf("InsertParagraph error: %v", err)
	}

	// Re-upsert with a new hash; paragraphs should be cleared before the
	// caller re-inserts new ones.
	rec.ContentHash = "h2"
	if err := s.UpsertFile(rec); err != nil {
		t.Fatalf("UpsertFile (2nd) error: %v", err)
	}

	all, err := s.AllParagraphs()
	if err != nil {
		t.Fatalf("AllParagraphs error: %v", err)
	}
	if len(all) != 0 {
		t.Fatalf("expected paragraphs cleared, got %d", len(all))
	}
}

func TestDeleteFile(t *testing.T) {
	s := openTestStore(t)

	rec := FileRecord{Path: "a.html", ContentHash: "h1", IndexedAt: time.Now()}
	if err := s.UpsertFile(rec); err != nil {
		t.Fatalf("UpsertFile error: %v", err)
	}
	if err := s.InsertParagraph(ParagraphRecord{FilePath: rec.Path, Text: "x", Embedding: []float32{1}}); err != nil {
		t.Fatalf("InsertParagraph error: %v", err)
	}

	if err := s.DeleteFile(rec.Path); err != nil {
		t.Fatalf("DeleteFile error: %v", err)
	}

	paths, err := s.AllFilePaths()
	if err != nil {
		t.Fatalf("AllFilePaths error: %v", err)
	}
	if len(paths) != 0 {
		t.Fatalf("expected no files after delete, got %v", paths)
	}
	all, err := s.AllParagraphs()
	if err != nil {
		t.Fatalf("AllParagraphs error: %v", err)
	}
	if len(all) != 0 {
		t.Fatalf("expected no paragraphs after delete, got %d", len(all))
	}
}

func TestModelVersionAndLastFullIndex(t *testing.T) {
	s := openTestStore(t)

	v, err := s.GetModelVersion()
	if err != nil {
		t.Fatalf("GetModelVersion error: %v", err)
	}
	if v != "" {
		t.Fatalf("expected empty model version initially, got %q", v)
	}

	if err := s.SetModelVersion("test-model-v1"); err != nil {
		t.Fatalf("SetModelVersion error: %v", err)
	}
	v, err = s.GetModelVersion()
	if err != nil {
		t.Fatalf("GetModelVersion error: %v", err)
	}
	if v != "test-model-v1" {
		t.Errorf("GetModelVersion() = %q, want %q", v, "test-model-v1")
	}

	now := time.Now()
	if err := s.SetLastFullIndex(now); err != nil {
		t.Fatalf("SetLastFullIndex error: %v", err)
	}
	last, err := s.GetLastFullIndex()
	if err != nil {
		t.Fatalf("GetLastFullIndex error: %v", err)
	}
	if last == "" {
		t.Errorf("expected non-empty last full index timestamp")
	}
}
