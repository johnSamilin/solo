// Package search implements the `solo-search query` behavior, supporting
// three modes depending on which of --query / --tags were provided:
//
//   - query + tags: semantic ranking (cosine similarity) with a soft
//     relevance boost for paragraphs/files whose tags satisfy the tag
//     expression.
//   - tags only: hard filter — only paragraphs whose tags satisfy the tag
//     expression are returned, sorted by file creation date (newest
//     first), with no similarity score.
//   - query only: pure semantic search, no tag involvement.
package search

import (
	"fmt"
	"math"
	"sort"

	"github.com/solo-notes/semantic-search/internal/embedding"
	"github.com/solo-notes/semantic-search/internal/query/tagexpr"
	"github.com/solo-notes/semantic-search/internal/store"
)

// TagBoostWeight controls how much a full tag-expression match contributes
// to a result's score, expressed as a fraction added on top of the
// semantic cosine similarity (which is already in [-1, 1], but typically
// >0 for reasonably related sentences). A boosted match adds this constant
// to the raw similarity score.
const TagBoostWeight = 0.15

// Options configures a single search invocation.
type Options struct {
	Store       *store.Store
	Model       *embedding.Model // may be nil if Query == ""
	Query       string
	TagExpr     string
	Limit       int // 0 => DefaultLimit
}

// DefaultLimit is used when Options.Limit is unset (<=0).
const DefaultLimit = 20

// Result is a single paragraph-level search hit.
type Result struct {
	FilePath      string   `json:"filePath"`
	ParagraphIdx  int      `json:"paragraphIndex"`
	Tag           string   `json:"tag"`
	Text          string   `json:"text"`
	ParagraphTags []string `json:"paragraphTags,omitempty"`
	FileTags      []string `json:"fileTags,omitempty"`
	NoteID        string   `json:"noteId,omitempty"`
	FileTheme     string   `json:"fileTheme,omitempty"`
	FileCreatedAt string   `json:"fileCreatedAt,omitempty"`

	// Score is the final ranking score. For query-only and query+tags
	// modes this is the (possibly boosted) cosine similarity. For
	// tags-only mode, Score is omitted (all matches are equally valid) —
	// represented as a nil pointer to distinguish "no score" from 0.
	Score *float64 `json:"score,omitempty"`
	// SemanticScore is the raw cosine similarity, present whenever a query
	// embedding was computed.
	SemanticScore *float64 `json:"semanticScore,omitempty"`
	// TagMatched reports whether this result satisfied the tag expression
	// (present whenever a tag expression was supplied).
	TagMatched *bool `json:"tagMatched,omitempty"`
}

// Mode identifies which of the three search strategies was used.
type Mode string

const (
	ModeSemantic    Mode = "semantic"           // query only
	ModeTagsOnly    Mode = "tags-only"          // tags only
	ModeSemanticTag Mode = "semantic+tag-boost" // query + tags
)

// Response is the top-level structure serialized to stdout as JSON.
type Response struct {
	Mode    Mode     `json:"mode"`
	Query   string   `json:"query,omitempty"`
	TagExpr string   `json:"tagExpr,omitempty"`
	Count   int      `json:"count"`
	Results []Result `json:"results"`
}

// Run executes a search according to Options and returns the ranked/filtered
// results. Exactly one of Options.Query / Options.TagExpr must be provided,
// or an error is returned; this mirrors the CLI-level validation but is
// re-checked here for safety when Options are constructed programmatically.
func Run(opts Options) (*Response, error) {
	hasQuery := opts.Query != ""
	hasTags := opts.TagExpr != ""
	if !hasQuery && !hasTags {
		return nil, fmt.Errorf("at least one of --query or --tags must be provided")
	}

	limit := opts.Limit
	if limit <= 0 {
		limit = DefaultLimit
	}

	var expr tagexpr.Expr
	if hasTags {
		e, err := tagexpr.Parse(opts.TagExpr)
		if err != nil {
			return nil, fmt.Errorf("parsing --tags expression: %w", err)
		}
		expr = e
	}

	paragraphs, err := opts.Store.AllParagraphs()
	if err != nil {
		return nil, fmt.Errorf("reading index: %w", err)
	}

	switch {
	case hasQuery && hasTags:
		return runSemanticWithTagBoost(opts, expr, paragraphs, limit)
	case hasTags:
		return runTagsOnly(expr, paragraphs, limit)
	default:
		return runSemanticOnly(opts, paragraphs, limit)
	}
}

func combinedTags(p store.StoredParagraph) []string {
	seen := make(map[string]bool, len(p.ParagraphTags)+len(p.FileTags))
	var out []string
	add := func(t string) {
		if t == "" || seen[t] {
			return
		}
		seen[t] = true
		out = append(out, t)
	}
	for _, t := range p.ParagraphTags {
		add(t)
	}
	for _, t := range p.FileTags {
		add(t)
	}
	return out
}

func toResult(p store.StoredParagraph) Result {
	return Result{
		FilePath:      p.FilePath,
		ParagraphIdx:  p.ParagraphIdx,
		Tag:           p.Tag,
		Text:          p.Text,
		ParagraphTags: p.ParagraphTags,
		FileTags:      p.FileTags,
		NoteID:        p.NoteID,
		FileTheme:     p.FileTheme,
		FileCreatedAt: p.FileCreatedAt,
	}
}

func runSemanticOnly(opts Options, paragraphs []store.StoredParagraph, limit int) (*Response, error) {
	queryVec, err := opts.Model.Embed(opts.Query)
	if err != nil {
		return nil, fmt.Errorf("embedding query: %w", err)
	}

	results := make([]Result, 0, len(paragraphs))
	for _, p := range paragraphs {
		sim := cosineSimilarity(queryVec, p.Embedding)
		r := toResult(p)
		s := sim
		r.Score = &s
		r.SemanticScore = &s
		results = append(results, r)
	}

	sort.Slice(results, func(i, j int) bool {
		return *results[i].Score > *results[j].Score
	})
	if len(results) > limit {
		results = results[:limit]
	}

	return &Response{
		Mode:    ModeSemantic,
		Query:   opts.Query,
		Count:   len(results),
		Results: results,
	}, nil
}

func runTagsOnly(expr tagexpr.Expr, paragraphs []store.StoredParagraph, limit int) (*Response, error) {
	results := make([]Result, 0)
	for _, p := range paragraphs {
		tags := combinedTags(p)
		if expr == nil || !expr.Eval(tags) {
			continue
		}
		r := toResult(p)
		matched := true
		r.TagMatched = &matched
		results = append(results, r)
	}

	// Sort newest-first by file creation date; fall back to file path for
	// stability when dates are equal or missing.
	sort.Slice(results, func(i, j int) bool {
		if results[i].FileCreatedAt != results[j].FileCreatedAt {
			return results[i].FileCreatedAt > results[j].FileCreatedAt
		}
		if results[i].FilePath != results[j].FilePath {
			return results[i].FilePath < results[j].FilePath
		}
		return results[i].ParagraphIdx < results[j].ParagraphIdx
	})
	if len(results) > limit {
		results = results[:limit]
	}

	return &Response{
		Mode:    ModeTagsOnly,
		TagExpr: exprString(expr),
		Count:   len(results),
		Results: results,
	}, nil
}

func runSemanticWithTagBoost(opts Options, expr tagexpr.Expr, paragraphs []store.StoredParagraph, limit int) (*Response, error) {
	queryVec, err := opts.Model.Embed(opts.Query)
	if err != nil {
		return nil, fmt.Errorf("embedding query: %w", err)
	}

	results := make([]Result, 0, len(paragraphs))
	for _, p := range paragraphs {
		sim := cosineSimilarity(queryVec, p.Embedding)
		matched := expr != nil && expr.Eval(combinedTags(p))

		score := sim
		if matched {
			score += TagBoostWeight
		}

		r := toResult(p)
		s := sim
		final := score
		r.SemanticScore = &s
		r.Score = &final
		r.TagMatched = &matched
		results = append(results, r)
	}

	sort.Slice(results, func(i, j int) bool {
		return *results[i].Score > *results[j].Score
	})
	if len(results) > limit {
		results = results[:limit]
	}

	return &Response{
		Mode:    ModeSemanticTag,
		Query:   opts.Query,
		TagExpr: exprString(expr),
		Count:   len(results),
		Results: results,
	}, nil
}

func exprString(e tagexpr.Expr) string {
	if e == nil {
		return ""
	}
	return e.String()
}

func cosineSimilarity(a, b []float32) float64 {
	if len(a) != len(b) || len(a) == 0 {
		return 0
	}
	var dot, na, nb float64
	for i := range a {
		af := float64(a[i])
		bf := float64(b[i])
		dot += af * bf
		na += af * af
		nb += bf * bf
	}
	if na == 0 || nb == 0 {
		return 0
	}
	return dot / (math.Sqrt(na) * math.Sqrt(nb))
}
