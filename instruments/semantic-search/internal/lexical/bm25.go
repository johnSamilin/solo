// bm25.go implements a small in-memory Okapi BM25 ranker over a set of
// pre-analyzed documents (paragraph chunks). The indexer builds one Index
// per query invocation from the stemmed token lists persisted alongside each
// paragraph, and the search layer scores the query's stems against it.
//
// BM25 is used (rather than raw TF-IDF) because its term-frequency
// saturation and document-length normalization behave well on the short,
// uneven paragraph chunks produced by note splitting.
package lexical

import "math"

// Standard Okapi BM25 free parameters. k1 controls term-frequency
// saturation; b controls how strongly document length normalizes the score.
// These are the conventional defaults and work well without corpus-specific
// tuning.
const (
	bm25K1 = 1.2
	bm25B  = 0.75
)

// Document is one indexable unit (a paragraph chunk) identified by an opaque
// caller-supplied ID, carrying its already-analyzed stem tokens.
type Document struct {
	ID     int64
	Tokens []string
}

// Index is an immutable in-memory inverted index supporting BM25 scoring.
type Index struct {
	// postings maps a stem term to the list of documents containing it and
	// the term frequency within each.
	postings map[string][]posting
	// docLen holds the token count of each document by ID.
	docLen map[int64]int
	// docFreq caches how many documents contain each term (len of its
	// postings list) for IDF computation.
	docFreq map[string]int
	avgLen  float64
	numDocs int
}

type posting struct {
	docID int64
	tf    int
}

// BuildIndex constructs a BM25 index from the given analyzed documents.
func BuildIndex(docs []Document) *Index {
	idx := &Index{
		postings: make(map[string][]posting),
		docLen:   make(map[int64]int, len(docs)),
		docFreq:  make(map[string]int),
		numDocs:  len(docs),
	}

	var totalLen int
	for _, d := range docs {
		idx.docLen[d.ID] = len(d.Tokens)
		totalLen += len(d.Tokens)

		// Count term frequencies within this document.
		tf := make(map[string]int, len(d.Tokens))
		for _, tok := range d.Tokens {
			tf[tok]++
		}
		for term, freq := range tf {
			idx.postings[term] = append(idx.postings[term], posting{docID: d.ID, tf: freq})
			idx.docFreq[term]++
		}
	}

	if idx.numDocs > 0 {
		idx.avgLen = float64(totalLen) / float64(idx.numDocs)
	}
	return idx
}

// Score ranks all documents against the analyzed query terms, returning a
// map from document ID to its BM25 score. Documents that share no term with
// the query are absent from the result (implicit score 0).
func (idx *Index) Score(queryTerms []string) map[int64]float64 {
	scores := make(map[int64]float64)
	if idx.numDocs == 0 {
		return scores
	}

	// De-duplicate query terms; a term appearing multiple times in the
	// query does not increase a document's BM25 contribution.
	seen := make(map[string]bool, len(queryTerms))
	for _, term := range queryTerms {
		if seen[term] {
			continue
		}
		seen[term] = true

		postings := idx.postings[term]
		if len(postings) == 0 {
			continue
		}
		idf := idx.idf(term)
		for _, p := range postings {
			dl := float64(idx.docLen[p.docID])
			tf := float64(p.tf)
			denom := tf + bm25K1*(1-bm25B+bm25B*dl/idx.avgLen)
			scores[p.docID] += idf * (tf * (bm25K1 + 1)) / denom
		}
	}
	return scores
}

// idf computes the BM25 "probabilistic" inverse document frequency for a
// term, using the standard smoothed form that stays non-negative:
//
//	idf = ln(1 + (N - n + 0.5) / (n + 0.5))
//
// where N is the corpus size and n the number of documents containing the
// term.
func (idx *Index) idf(term string) float64 {
	n := float64(idx.docFreq[term])
	N := float64(idx.numDocs)
	return math.Log(1 + (N-n+0.5)/(n+0.5))
}
