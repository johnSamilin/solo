package embedding

import (
	"os"
	"path/filepath"
	"testing"
)

// writeTestVocab creates a minimal WordPiece vocabulary file sufficient for
// tokenizing simple lowercase English test sentences.
func writeTestVocab(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	path := filepath.Join(dir, "vocab.txt")

	tokens := []string{
		"[PAD]", "[UNK]", "[CLS]", "[SEP]",
		"hello", "world", "brown", "fox", "jump", "##s", "over", "the",
		"lazy", "dog", ".", ",",
	}
	content := ""
	for _, tok := range tokens {
		content += tok + "\n"
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatalf("writing vocab: %v", err)
	}
	return path
}

func TestTokenizerEncodeBasic(t *testing.T) {
	vocabPath := writeTestVocab(t)
	tok, err := NewTokenizerFromFile(vocabPath, 16)
	if err != nil {
		t.Fatalf("NewTokenizerFromFile error: %v", err)
	}

	enc := tok.Encode("hello world")
	if len(enc.InputIDs) != 16 {
		t.Fatalf("expected padded length 16, got %d", len(enc.InputIDs))
	}
	if enc.InputIDs[0] != tok.clsID {
		t.Errorf("expected first token to be [CLS], got %d", enc.InputIDs[0])
	}

	// [CLS] hello world [SEP] pad...
	nonPad := 0
	for _, m := range enc.AttentionMask {
		if m == 1 {
			nonPad++
		}
	}
	if nonPad != 4 {
		t.Errorf("expected 4 non-pad tokens ([CLS] hello world [SEP]), got %d", nonPad)
	}
}

func TestTokenizerWordPieceSplitting(t *testing.T) {
	vocabPath := writeTestVocab(t)
	tok, err := NewTokenizerFromFile(vocabPath, 16)
	if err != nil {
		t.Fatalf("NewTokenizerFromFile error: %v", err)
	}

	// "jumps" should split into "jump" + "##s" given our fixture vocab.
	ids := tok.wordPiece("jumps")
	if len(ids) != 2 {
		t.Fatalf("expected 2 subword ids for 'jumps', got %d: %v", len(ids), ids)
	}
}

func TestTokenizerUnknownWord(t *testing.T) {
	vocabPath := writeTestVocab(t)
	tok, err := NewTokenizerFromFile(vocabPath, 16)
	if err != nil {
		t.Fatalf("NewTokenizerFromFile error: %v", err)
	}

	ids := tok.wordPiece("zzzznotinvocab")
	if len(ids) != 1 || ids[0] != tok.unkID {
		t.Errorf("expected single [UNK] id, got %v (unkID=%d)", ids, tok.unkID)
	}
}

func TestBasicTokenizePunctuation(t *testing.T) {
	words := basicTokenize("Hello, world.")
	want := []string{"hello", ",", "world", "."}
	if len(words) != len(want) {
		t.Fatalf("got %v, want %v", words, want)
	}
	for i := range want {
		if words[i] != want[i] {
			t.Errorf("word %d: got %q, want %q", i, words[i], want[i])
		}
	}
}
