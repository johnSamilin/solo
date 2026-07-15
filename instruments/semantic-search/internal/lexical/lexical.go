// Package lexical implements the language-aware lexical (keyword) side of
// the hybrid search pipeline. It complements the dense semantic embeddings
// with a classic sparse retrieval track: text is normalized, tokenized,
// language-detected (Cyrillic vs Latin) and stemmed with the appropriate
// Snowball stemmer, then ranked with Okapi BM25.
//
// This is what makes exact-ish, morphology-aware Russian (and English)
// keyword matches possible even when the multilingual embedding model
// produces only a fuzzy semantic neighborhood — for example matching
// different grammatical forms of the same Russian word ("заметка",
// "заметки", "заметкой") to the same stem.
package lexical

import (
	"strings"
	"unicode"

	"github.com/kljensen/snowball/english"
	"github.com/kljensen/snowball/russian"
	"golang.org/x/text/unicode/norm"
)

// Language identifies the dominant script of a piece of text, used to pick a
// stemmer. Detection is a cheap heuristic based on the alphabet of the
// letters present, which is sufficient for choosing between the Russian and
// English Snowball stemmers; we intentionally avoid a heavyweight statistical
// language detector.
type Language string

const (
	// LangRussian indicates predominantly Cyrillic text.
	LangRussian Language = "ru"
	// LangEnglish indicates predominantly Latin text.
	LangEnglish Language = "en"
	// LangUnknown indicates text with no clear alphabetic majority (e.g.
	// numbers/symbols only); such tokens are lower-cased but not stemmed.
	LangUnknown Language = "und"
)

// DetectLanguage returns the dominant script of text based on the ratio of
// Cyrillic to Latin letters. Ties and letterless input resolve to
// LangUnknown.
func DetectLanguage(text string) Language {
	var cyr, lat int
	for _, r := range text {
		switch {
		case unicode.Is(unicode.Cyrillic, r):
			cyr++
		case unicode.Is(unicode.Latin, r):
			lat++
		}
	}
	switch {
	case cyr == 0 && lat == 0:
		return LangUnknown
	case cyr >= lat:
		return LangRussian
	default:
		return LangEnglish
	}
}

// Analyze converts raw text into a normalized list of stem tokens suitable
// for indexing or querying. The pipeline is:
//
//  1. Unicode NFC normalization (canonical composition).
//  2. Lower-casing.
//  3. Splitting into word tokens on non-letter/non-digit runes.
//  4. Per-token stemming with the stemmer chosen by the whole text's
//     detected language (so a Russian paragraph stems every token with the
//     Russian stemmer, mixed content falls back per the dominant script).
//
// Stop words are handled by the underlying Snowball stemmers, which already
// map common function words to short, low-signal stems; BM25's IDF term
// then naturally down-weights any that remain frequent across the corpus.
func Analyze(text string) []string {
	lang := DetectLanguage(text)
	words := tokenizeWords(text)
	out := make([]string, 0, len(words))
	for _, w := range words {
		out = append(out, stem(w, lang))
	}
	return out
}

// tokenizeWords lower-cases and splits text into word tokens on runs of
// letters and digits, after NFC-normalizing so that combining sequences
// (e.g. Cyrillic "й" written as и + combining breve) collapse to a single
// canonical rune before splitting.
func tokenizeWords(text string) []string {
	text = norm.NFC.String(text)
	text = strings.ToLower(text)

	var tokens []string
	var cur strings.Builder
	flush := func() {
		if cur.Len() > 0 {
			tokens = append(tokens, cur.String())
			cur.Reset()
		}
	}
	for _, r := range text {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			cur.WriteRune(r)
		} else {
			flush()
		}
	}
	flush()
	return tokens
}

// stem reduces a single lower-cased word to its stem using the Snowball
// stemmer for lang. Unknown-language or purely numeric tokens are returned
// unchanged. The stemmers are invoked with stopWords=false so we keep every
// token and rely on BM25 IDF weighting instead of a hard stop-word list.
func stem(word string, lang Language) string {
	switch lang {
	case LangRussian:
		return russian.Stem(word, false)
	case LangEnglish:
		return english.Stem(word, false)
	default:
		return word
	}
}
