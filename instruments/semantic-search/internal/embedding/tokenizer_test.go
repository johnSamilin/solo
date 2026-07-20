package embedding

import (
	"os"
	"testing"
)

// findTokenizerJSON locates a real tokenizer.json for integration-style
// tests, honoring SOLO_SEARCH_MODEL_DIR. Tests that need the actual
// multilingual tokenizer skip when it is not present, so the suite still
// runs in CI without the (large) model artifacts.
func findTokenizerJSON(t *testing.T) string {
	t.Helper()
	dir := os.Getenv("SOLO_SEARCH_MODEL_DIR")
	if dir == "" {
		dir = "../../models"
	}
	path := dir + "/tokenizer.json"
	if _, err := os.Stat(path); err != nil {
		t.Skipf("tokenizer.json not found at %q; skipping (set SOLO_SEARCH_MODEL_DIR)", path)
	}
	return path
}

// fakeTokenizer builds a Tokenizer with a nil underlying HF tokenizer and
// fixed special-token ids, so the model-independent framing/padding logic
// can be unit-tested without loading tokenizer.json.
func fakeTokenizer(maxSeq int) *Tokenizer {
	return &Tokenizer{maxSeq: maxSeq, clsID: 100, sepID: 101, padID: 0}
}

func TestFrameAndPadFramesAndPads(t *testing.T) {
	tok := fakeTokenizer(8)
	enc := tok.frameAndPad([]int{1, 2, 3})

	if len(enc.InputIDs) != 8 {
		t.Fatalf("expected padded length 8, got %d", len(enc.InputIDs))
	}
	if enc.InputIDs[0] != 100 {
		t.Errorf("expected leading CLS id 100, got %d", enc.InputIDs[0])
	}
	if enc.InputIDs[4] != 101 {
		t.Errorf("expected SEP id 101 at position 4, got %d", enc.InputIDs[4])
	}
	// Positions 0..4 are content+framing (mask 1), 5..7 are pad (mask 0).
	nonPad := 0
	for _, m := range enc.AttentionMask {
		if m == 1 {
			nonPad++
		}
	}
	if nonPad != 5 { // CLS + 3 content + SEP
		t.Errorf("expected 5 non-pad tokens, got %d", nonPad)
	}
}

func TestFrameAndPadTruncates(t *testing.T) {
	tok := fakeTokenizer(4) // room for only 2 content tokens after framing
	content := []int{10, 11, 12, 13, 14}
	enc := tok.frameAndPad(content)

	if len(enc.InputIDs) != 4 {
		t.Fatalf("expected length 4, got %d", len(enc.InputIDs))
	}
	if enc.InputIDs[0] != 100 || enc.InputIDs[3] != 101 {
		t.Errorf("expected CLS/SEP framing, got %v", enc.InputIDs)
	}
	// Only the first 2 content tokens should survive truncation.
	if enc.InputIDs[1] != 10 || enc.InputIDs[2] != 11 {
		t.Errorf("expected truncated content [10 11], got %v", enc.InputIDs[1:3])
	}
}

// TestEncodeCyrillic verifies the real multilingual tokenizer produces a
// non-trivial (non-all-UNK) token sequence for Russian text — the whole
// point of switching away from the English WordPiece vocabulary. Skips when
// the model artifacts are absent.
func TestEncodeCyrillic(t *testing.T) {
	path := findTokenizerJSON(t)
	tok, err := NewTokenizerFromFile(path, 32)
	if err != nil {
		t.Fatalf("NewTokenizerFromFile: %v", err)
	}

	enc := tok.Encode("Планирование путешествия по России")

	if len(enc.InputIDs) != 32 {
		t.Fatalf("expected padded length 32, got %d", len(enc.InputIDs))
	}
	// Count content tokens (attention mask == 1) excluding the two framing
	// specials; there should be several real subword tokens.
	content := 0
	for _, m := range enc.AttentionMask {
		if m == 1 {
			content++
		}
	}
	if content <= 2 {
		t.Errorf("expected multiple content tokens for Cyrillic input, got %d", content-2)
	}
}
