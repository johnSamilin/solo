package lexical

import "testing"

func TestDetectLanguage(t *testing.T) {
	cases := []struct {
		text string
		want Language
	}{
		{"Планирование путешествия", LangRussian},
		{"vacation planning trip", LangEnglish},
		{"12345 !!!", LangUnknown},
		{"", LangUnknown},
		{"Россия and USA", LangRussian}, // more Cyrillic than Latin
	}
	for _, c := range cases {
		if got := DetectLanguage(c.text); got != c.want {
			t.Errorf("DetectLanguage(%q) = %q, want %q", c.text, got, c.want)
		}
	}
}

// TestAnalyzeRussianStemming verifies that different grammatical forms of the
// same Russian word collapse to a shared stem — the core benefit of the
// language-aware lexical track for morphologically rich Russian.
func TestAnalyzeRussianStemming(t *testing.T) {
	forms := []string{"заметка", "заметки", "заметкой", "заметку"}
	stems := make(map[string]bool)
	for _, f := range forms {
		out := Analyze(f)
		if len(out) != 1 {
			t.Fatalf("Analyze(%q) = %v, expected single token", f, out)
		}
		stems[out[0]] = true
	}
	if len(stems) != 1 {
		t.Errorf("expected all forms to share one stem, got %d distinct: %v", len(stems), stems)
	}
}

func TestAnalyzeTokenizesAndLowercases(t *testing.T) {
	out := Analyze("Привет, Мир! Hello.")
	if len(out) == 0 {
		t.Fatal("expected non-empty analysis")
	}
	for _, tok := range out {
		for _, r := range tok {
			if r >= 'A' && r <= 'Z' {
				t.Errorf("token %q not lower-cased", tok)
			}
		}
	}
}

// TestBM25RanksExactMatchFirst checks that a document sharing the query's
// (stemmed) terms outranks one that does not.
func TestBM25RanksExactMatchFirst(t *testing.T) {
	docs := []Document{
		{ID: 1, Tokens: Analyze("бюджет путешествия и накопления")},
		{ID: 2, Tokens: Analyze("рецепт супа с грибами")},
		{ID: 3, Tokens: Analyze("планирование бюджета на отпуск")},
	}
	idx := BuildIndex(docs)
	scores := idx.Score(Analyze("бюджет отпуска"))

	if scores[3] <= scores[2] {
		t.Errorf("doc 3 (budget/vacation) should outrank doc 2 (soup): %v", scores)
	}
	if scores[1] <= scores[2] {
		t.Errorf("doc 1 (budget) should outrank doc 2 (soup): %v", scores)
	}
}

func TestBM25EmptyIndex(t *testing.T) {
	idx := BuildIndex(nil)
	scores := idx.Score(Analyze("что-нибудь"))
	if len(scores) != 0 {
		t.Errorf("expected empty scores for empty index, got %v", scores)
	}
}
