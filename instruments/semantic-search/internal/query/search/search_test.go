package search

import (
	"math"
	"path/filepath"
	"testing"
	"time"

	"github.com/solo-notes/semantic-search/internal/store"
)

func TestCosineSimilarity(t *testing.T) {
	cases := []struct {
		name string
		a, b []float32
		want float64
	}{
		{"identical", []float32{1, 0, 0}, []float32{1, 0, 0}, 1},
		{"orthogonal", []float32{1, 0}, []float32{0, 1}, 0},
		{"opposite", []float32{1, 0}, []float32{-1, 0}, -1},
		{"scaled identical direction", []float32{2, 0}, []float32{4, 0}, 1},
		{"mismatched length", []float32{1, 2}, []float32{1}, 0},
		{"zero vector", []float32{0, 0}, []float32{1, 1}, 0},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := cosineSimilarity(tc.a, tc.b)
			if math.Abs(got-tc.want) > 1e-6 {
				t.Errorf("cosineSimilarity(%v, %v) = %v, want %v", tc.a, tc.b, got, tc.want)
			}
		})
	}
}

func openTestStoreWithData(t *testing.T) *store.Store {
	t.Helper()
	dir := t.TempDir()
	s, err := store.Open(filepath.Join(dir, "index.db"))
	if err != nil {
		t.Fatalf("store.Open error: %v", err)
	}
	t.Cleanup(func() { s.Close() })

	files := []struct {
		path      string
		tags      []string
		createdAt string
	}{
		{"a.html", []string{"project/alpha"}, "2024-01-01T00:00:00Z"},
		{"b.html", []string{"journal"}, "2024-02-01T00:00:00Z"},
		{"c.html", []string{"project/beta", "archived"}, "2024-03-01T00:00:00Z"},
	}
	for _, f := range files {
		if err := s.UpsertFile(store.FileRecord{
			Path:        f.path,
			ContentHash: "h-" + f.path,
			Tags:        f.tags,
			CreatedAt:   f.createdAt,
			IndexedAt:   time.Now(),
		}); err != nil {
			t.Fatalf("UpsertFile(%s) error: %v", f.path, err)
		}
	}

	paragraphs := []struct {
		file string
		text string
		tags []string
		vec  []float32
	}{
		{"a.html", "Alpha project kickoff notes", []string{"kickoff"}, []float32{1, 0, 0}},
		{"b.html", "Random journal entry about weather", nil, []float32{0, 1, 0}},
		{"c.html", "Beta project retro, now archived", []string{"retro"}, []float32{0, 0, 1}},
	}
	for _, p := range paragraphs {
		if err := s.InsertParagraph(store.ParagraphRecord{
			FilePath:      p.file,
			Tag:           "p",
			Text:          p.text,
			ParagraphTags: p.tags,
			Embedding:     p.vec,
		}); err != nil {
			t.Fatalf("InsertParagraph error: %v", err)
		}
	}

	return s
}

func TestRunTagsOnlyMode(t *testing.T) {
	s := openTestStoreWithData(t)

	resp, err := Run(Options{Store: s, TagExpr: "project"})
	if err != nil {
		t.Fatalf("Run error: %v", err)
	}
	if resp.Mode != ModeTagsOnly {
		t.Errorf("Mode = %q, want %q", resp.Mode, ModeTagsOnly)
	}
	if resp.Count != 2 {
		t.Fatalf("expected 2 tag matches, got %d: %+v", resp.Count, resp.Results)
	}
	for _, r := range resp.Results {
		if r.Score != nil {
			t.Errorf("tags-only result should have nil Score, got %v", *r.Score)
		}
		if r.TagMatched == nil || !*r.TagMatched {
			t.Errorf("expected TagMatched=true, got %+v", r.TagMatched)
		}
	}
	// Newest first: c.html (2024-03) before a.html (2024-01)
	if resp.Results[0].FilePath != "c.html" {
		t.Errorf("expected newest file first (c.html), got %s", resp.Results[0].FilePath)
	}
}

func TestRunTagsOnlyExcludesNonMatching(t *testing.T) {
	s := openTestStoreWithData(t)

	resp, err := Run(Options{Store: s, TagExpr: "project AND NOT archived"})
	if err != nil {
		t.Fatalf("Run error: %v", err)
	}
	if resp.Count != 1 {
		t.Fatalf("expected 1 match, got %d: %+v", resp.Count, resp.Results)
	}
	if resp.Results[0].FilePath != "a.html" {
		t.Errorf("expected a.html, got %s", resp.Results[0].FilePath)
	}
}

func TestRunRequiresQueryOrTags(t *testing.T) {
	s := openTestStoreWithData(t)
	if _, err := Run(Options{Store: s}); err == nil {
		t.Fatal("expected error when neither Query nor TagExpr provided")
	}
}
