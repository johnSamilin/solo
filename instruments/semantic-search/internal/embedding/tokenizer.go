// Package embedding provides a HuggingFace-tokenizer-backed sentence
// embedder for multilingual sentence-transformer encoders such as
// paraphrase-multilingual-MiniLM-L12-v2 (an XLM-RoBERTa derived model using
// SentencePiece/Unigram tokenization).
//
// The previous English-only WordPiece implementation has been removed
// entirely: multilingual models ship a `tokenizer.json` describing a
// Unigram/BPE tokenizer plus its normalizers and pre-tokenizers, which we
// load verbatim via github.com/sugarme/tokenizer rather than reimplementing
// by hand. This is what makes correct Russian (Cyrillic) tokenization
// possible.
package embedding

import (
	"fmt"

	"github.com/sugarme/tokenizer"
	"github.com/sugarme/tokenizer/pretrained"
	"golang.org/x/text/unicode/norm"
)

// Tokenizer wraps a loaded HuggingFace tokenizer (from tokenizer.json) and
// produces padded/truncated model input sequences. It replaces the former
// hand-written WordPiece tokenizer.
type Tokenizer struct {
	tk     *tokenizer.Tokenizer
	maxSeq int
	// clsID/sepID/padID are resolved from the tokenizer's special tokens so
	// we can frame and pad sequences consistently across model families
	// (XLM-R uses <s>/</s>/<pad>; BERT uses [CLS]/[SEP]/[PAD]).
	clsID int
	sepID int
	padID int
}

// NewTokenizerFromFile loads a HuggingFace tokenizer.json from tokenizerPath.
// maxSeqLen is the sequence length sequences are padded/truncated to.
func NewTokenizerFromFile(tokenizerPath string, maxSeqLen int) (*Tokenizer, error) {
	tk, err := pretrained.FromFile(tokenizerPath)
	if err != nil {
		return nil, fmt.Errorf("loading tokenizer.json %q: %w", tokenizerPath, err)
	}

	t := &Tokenizer{tk: tk, maxSeq: maxSeqLen}

	// Resolve framing/padding special-token ids, tolerating either the
	// XLM-RoBERTa (<s>/</s>/<pad>) or BERT ([CLS]/[SEP]/[PAD]) conventions.
	t.clsID = firstKnownTokenID(tk, "<s>", "[CLS]")
	t.sepID = firstKnownTokenID(tk, "</s>", "[SEP]")
	t.padID = firstKnownTokenID(tk, "<pad>", "[PAD]")
	if t.clsID < 0 || t.sepID < 0 || t.padID < 0 {
		return nil, fmt.Errorf("tokenizer %q is missing expected framing/pad special tokens", tokenizerPath)
	}
	return t, nil
}

// firstKnownTokenID returns the id of the first of the given token strings
// that exists in the tokenizer's vocabulary, or -1 if none are present.
func firstKnownTokenID(tk *tokenizer.Tokenizer, candidates ...string) int {
	for _, c := range candidates {
		if id, ok := tk.TokenToId(c); ok {
			return id
		}
	}
	return -1
}

// Encoded holds the token id / attention mask / token type sequences ready
// to be fed into the ONNX model, all padded to the same length.
type Encoded struct {
	InputIDs      []int64
	AttentionMask []int64
	TokenTypeIDs  []int64
}

// Encode NFC-normalizes text, tokenizes it with the loaded HuggingFace
// tokenizer, frames it as <s> ... </s> (or [CLS] ... [SEP]) and
// pads/truncates to the configured max sequence length.
//
// Note: the tokenizer.json's own normalizer (e.g. NFKC/lowercase for XLM-R)
// still runs inside Tokenizer.EncodeSingle; the outer NFC pass here only
// guarantees a canonical, well-formed input string (important for Cyrillic
// combining sequences) before that model-specific normalization.
func (t *Tokenizer) Encode(text string) Encoded {
	text = norm.NFC.String(text)

	en, err := t.tk.EncodeSingle(text, false)
	if err != nil || en == nil {
		// On tokenization failure, emit an empty (just-framed) sequence so
		// the caller still produces a well-formed, if uninformative, vector
		// rather than crashing on a single bad paragraph.
		return t.frameAndPad(nil)
	}
	ids := make([]int, len(en.Ids))
	copy(ids, en.Ids)
	return t.frameAndPad(ids)
}

// frameAndPad wraps raw content token ids with the leading/trailing special
// tokens, truncates to leave room for them, builds the attention mask, and
// right-pads to maxSeq. token_type_ids are all zero (single-segment input).
func (t *Tokenizer) frameAndPad(content []int) Encoded {
	// Reserve two slots for the framing special tokens.
	maxContent := t.maxSeq - 2
	if maxContent < 0 {
		maxContent = 0
	}
	if len(content) > maxContent {
		content = content[:maxContent]
	}

	ids := make([]int64, 0, t.maxSeq)
	ids = append(ids, int64(t.clsID))
	for _, id := range content {
		ids = append(ids, int64(id))
	}
	ids = append(ids, int64(t.sepID))

	attn := make([]int64, len(ids))
	for i := range attn {
		attn[i] = 1
	}
	typeIDs := make([]int64, len(ids))

	for len(ids) < t.maxSeq {
		ids = append(ids, int64(t.padID))
		attn = append(attn, 0)
		typeIDs = append(typeIDs, 0)
	}

	return Encoded{InputIDs: ids, AttentionMask: attn, TokenTypeIDs: typeIDs}
}
