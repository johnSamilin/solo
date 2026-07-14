// Package embedding provides a minimal WordPiece tokenizer and an ONNX
// Runtime based sentence embedder compatible with the all-MiniLM-L6-v2
// model family (and other BERT-like encoders sharing the same tokenizer
// vocabulary format and input/output tensor layout).
package embedding

import (
	"bufio"
	"fmt"
	"os"
	"strings"
	"unicode"
)

const (
	tokenUnk  = "[UNK]"
	tokenCls  = "[CLS]"
	tokenSep  = "[SEP]"
	tokenPad  = "[PAD]"
	maxWPChar = 200 // words longer than this become [UNK], matches HF default
)

// Tokenizer implements the BERT "BasicTokenizer + WordPiece" scheme used by
// all-MiniLM-L6-v2 and most bert-base derived encoders. It reads a
// WordPiece vocabulary file (vocab.txt, one token per line).
type Tokenizer struct {
	vocab    map[string]int64
	unkID    int64
	clsID    int64
	sepID    int64
	padID    int64
	maxSeq   int
}

// NewTokenizerFromFile loads a WordPiece vocabulary from vocabPath.
func NewTokenizerFromFile(vocabPath string, maxSeqLen int) (*Tokenizer, error) {
	f, err := os.Open(vocabPath)
	if err != nil {
		return nil, fmt.Errorf("opening vocab file: %w", err)
	}
	defer f.Close()

	vocab := make(map[string]int64, 32000)
	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	var idx int64
	for scanner.Scan() {
		tok := scanner.Text()
		if tok == "" {
			continue
		}
		vocab[tok] = idx
		idx++
	}
	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("reading vocab file: %w", err)
	}

	t := &Tokenizer{vocab: vocab, maxSeq: maxSeqLen}
	var ok bool
	if t.unkID, ok = vocab[tokenUnk]; !ok {
		return nil, fmt.Errorf("vocab file missing %s token", tokenUnk)
	}
	if t.clsID, ok = vocab[tokenCls]; !ok {
		return nil, fmt.Errorf("vocab file missing %s token", tokenCls)
	}
	if t.sepID, ok = vocab[tokenSep]; !ok {
		return nil, fmt.Errorf("vocab file missing %s token", tokenSep)
	}
	if t.padID, ok = vocab[tokenPad]; !ok {
		return nil, fmt.Errorf("vocab file missing %s token", tokenPad)
	}
	return t, nil
}

// Encoded holds the token id / attention mask / token type sequences ready
// to be fed into the ONNX model, all padded to the same length.
type Encoded struct {
	InputIDs      []int64
	AttentionMask []int64
	TokenTypeIDs  []int64
}

// Encode tokenizes text into a single [CLS] ... [SEP] sequence, truncated
// and padded to the tokenizer's configured max sequence length.
func (t *Tokenizer) Encode(text string) Encoded {
	words := basicTokenize(text)

	ids := make([]int64, 0, t.maxSeq)
	ids = append(ids, t.clsID)
	for _, w := range words {
		for _, sub := range t.wordPiece(w) {
			if len(ids) >= t.maxSeq-1 {
				break
			}
			ids = append(ids, sub)
		}
		if len(ids) >= t.maxSeq-1 {
			break
		}
	}
	ids = append(ids, t.sepID)

	attn := make([]int64, len(ids))
	for i := range attn {
		attn[i] = 1
	}
	typeIDs := make([]int64, len(ids))

	for len(ids) < t.maxSeq {
		ids = append(ids, t.padID)
		attn = append(attn, 0)
		typeIDs = append(typeIDs, 0)
	}

	return Encoded{InputIDs: ids, AttentionMask: attn, TokenTypeIDs: typeIDs}
}

// wordPiece splits a single whitespace/punctuation-delimited word into
// WordPiece subword ids using the greedy longest-match-first algorithm.
func (t *Tokenizer) wordPiece(word string) []int64 {
	runes := []rune(word)
	if len(runes) > maxWPChar {
		return []int64{t.unkID}
	}

	var out []int64
	start := 0
	for start < len(runes) {
		end := len(runes)
		var curID int64 = -1
		for end > start {
			sub := string(runes[start:end])
			if start > 0 {
				sub = "##" + sub
			}
			if id, ok := t.vocab[sub]; ok {
				curID = id
				break
			}
			end--
		}
		if curID == -1 {
			return []int64{t.unkID}
		}
		out = append(out, curID)
		start = end
	}
	return out
}

// basicTokenize performs whitespace splitting, lowercasing, and punctuation
// separation, matching BERT's BasicTokenizer (without accent stripping,
// which most modern vocabularies bake into casing already).
func basicTokenize(text string) []string {
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
		switch {
		case unicode.IsSpace(r):
			flush()
		case isPunct(r):
			flush()
			tokens = append(tokens, string(r))
		default:
			cur.WriteRune(r)
		}
	}
	flush()
	return tokens
}

func isPunct(r rune) bool {
	if unicode.IsPunct(r) || unicode.IsSymbol(r) {
		return true
	}
	// ASCII punctuation not always covered by unicode.IsPunct/IsSymbol
	switch r {
	case '~', '`', '^', '$', '+', '<', '=', '>', '|':
		return true
	}
	return false
}
