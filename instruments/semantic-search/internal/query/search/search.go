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

	"github.com/solo-notes/semantic-search/internal/lexical"
	"github.com/solo-notes/semantic-search/internal/query/tagexpr"
	"github.com/solo-notes/semantic-search/internal/store"
)

// TagBoostWeight controls how much a full tag-expression match contributes
// to a result's score. In hybrid mode the base score is the Reciprocal Rank
// Fusion score (small, typically < 0.05), so the boost is scaled to remain
// meaningful relative to it.
const TagBoostWeight = 0.15

// rrfK is the Reciprocal Rank Fusion constant. RRF fuses the semantic and
// lexical rankings by summing 1/(k+rank) across both lists, which is robust
// to the two tracks' very different score scales (cosine similarity vs
// BM25) without any per-corpus weight tuning. k=60 is the value from the
// original RRF paper and a widely used default.
const rrfK = 60.0

// Options configures a single search invocation.
type Options struct {
	Store       *store.Store
	Model       Embedder // may be nil if Query == ""
	Query       string
	TagExpr     string
	Limit       int // 0 => DefaultLimit
}

// Embedder is the minimal embedding surface the search layer needs. It is
// satisfied by *embedding.Model in production and by a stub in tests, so the
// hybrid ranking can be exercised without loading the ONNX runtime.
type Embedder interface {
	// EmbedQuery returns the (prefixed, pooled, normalized) query embedding.
	EmbedQuery(text string) ([]float32, error)
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

	// Score is the final ranking score. For query modes this is the
	// Reciprocal Rank Fusion score of the semantic and lexical rankings
	// (plus any tag boost). For tags-only mode, Score is omitted (all
	// matches are equally valid) — a nil pointer distinguishes "no score"
	// from 0.
	Score *float64 `json:"score,omitempty"`
	// SemanticScore is the raw cosine similarity, present whenever a query
	// embedding was computed.
	SemanticScore *float64 `json:"semanticScore,omitempty"`
	// LexicalScore is the raw BM25 score of the paragraph against the
	// stemmed query, present whenever a query was supplied.
	LexicalScore *float64 `json:"lexicalScore,omitempty"`
	// TagMatched reports whether this result satisfied the tag expression
	// (present whenever a tag expression was supplied).
	TagMatched *bool `json:"tagMatched,omitempty"`
}

// Mode identifies which search strategy was used.
type Mode string

const (
	ModeHybrid    Mode = "hybrid"           // query only (semantic + lexical RRF)
	ModeTagsOnly  Mode = "tags-only"        // tags only
	ModeHybridTag Mode = "hybrid+tag-boost" // query + tags
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
		return runHybrid(opts, expr, paragraphs, limit)
	case hasTags:
		return runTagsOnly(expr, paragraphs, limit)
	default:
		return runHybrid(opts, nil, paragraphs, limit)
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

// runHybrid performs the hybrid semantic + lexical search. It ranks every
// paragraph twice — once by dense cosine similarity and once by BM25 over
// the stemmed query — then fuses the two rankings with Reciprocal Rank
// Fusion. When expr is non-nil, paragraphs whose tags satisfy it receive an
// additive score boost (results not matching the tags are still returned,
// just ranked lower). expr==nil is the pure query mode.
func runHybrid(opts Options, expr tagexpr.Expr, paragraphs []store.StoredParagraph, limit int) (*Response, error) {
	queryVec, err := opts.Model.EmbedQuery(opts.Query)
	if err != nil {
		return nil, fmt.Errorf("embedding query: %w", err)
	}

	// --- Semantic track: cosine similarity for every paragraph. ---
	semScores := make([]float64, len(paragraphs))
	for i, p := range paragraphs {
		semScores[i] = cosineSimilarity(queryVec, p.Embedding)
	}
	semRank := rankIndices(semScores)

	// --- Lexical track: BM25 over the stemmed query against stored tokens. ---
	docs := make([]lexical.Document, len(paragraphs))
	for i, p := range paragraphs {
		docs[i] = lexical.Document{ID: int64(i), Tokens: p.LexicalTokens}
	}
	bm25 := lexical.BuildIndex(docs)
	lexScoreByID := bm25.Score(lexical.Analyze(opts.Query))
	lexScores := make([]float64, len(paragraphs))
	for i := range paragraphs {
		lexScores[i] = lexScoreByID[int64(i)]
	}
	lexRank := rankIndices(lexScores)

	// --- Fuse the two rankings with Reciprocal Rank Fusion. ---
	results := make([]Result, 0, len(paragraphs))
	for i, p := range paragraphs {
		rrf := 1.0/(rrfK+float64(semRank[i])) + 1.0/(rrfK+float64(lexRank[i]))

		var matched bool
		if expr != nil {
			matched = expr.Eval(combinedTags(p))
			if matched {
				rrf += TagBoostWeight
			}
		}

		r := toResult(p)
		sem := semScores[i]
		lex := lexScores[i]
		final := rrf
		r.SemanticScore = &sem
		r.LexicalScore = &lex
		r.Score = &final
		if expr != nil {
			m := matched
			r.TagMatched = &m
		}
		results = append(results, r)
	}

	sort.Slice(results, func(i, j int) bool {
		return *results[i].Score > *results[j].Score
	})
	if len(results) > limit {
		results = results[:limit]
	}

	mode := ModeHybrid
	tagExpr := ""
	if expr != nil {
		mode = ModeHybridTag
		tagExpr = exprString(expr)
	}
	return &Response{
		Mode:    mode,
		Query:   opts.Query,
		TagExpr: tagExpr,
		Count:   len(results),
		Results: results,
	}, nil
}

// rankIndices returns, for each input index, its 1-based rank when sorted by
// descending score (rank 1 = highest score). Ties are broken by original
// index for determinism. Used to feed Reciprocal Rank Fusion.
func rankIndices(scores []float64) []int {
	order := make([]int, len(scores))
	for i := range order {
		order[i] = i
	}
	sort.SliceStable(order, func(a, b int) bool {
		return scores[order[a]] > scores[order[b]]
	})
	rank := make([]int, len(scores))
	for r, idx := range order {
		rank[idx] = r + 1
	}
	return rank
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
