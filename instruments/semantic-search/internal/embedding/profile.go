// profile.go defines the declarative model profile (model.json) that lives
// alongside model.onnx and tokenizer.json in the model directory. It removes
// the previous hard-coded assumptions (English all-MiniLM, fixed 384 dims,
// implicit mean pooling) so the encoder can be swapped without code changes.
package embedding

import (
	"encoding/json"
	"fmt"
	"os"
)

// Pooling identifies how token embeddings are reduced to a single sentence
// vector.
type Pooling string

const (
	// PoolingMean averages token embeddings weighted by the attention mask
	// (the sentence-transformers default, used by the MiniLM family).
	PoolingMean Pooling = "mean"
	// PoolingCLS takes the first token's embedding as the sentence vector
	// (used by some BERT/RoBERTa classification-style encoders).
	PoolingCLS Pooling = "cls"
)

// Profile is the decoded contents of model.json describing how to run and
// interpret the ONNX encoder.
type Profile struct {
	// Name is a human/version identifier recorded in the index so a model
	// swap forces a clean re-index.
	Name string `json:"name"`
	// Dimensions is the size of the produced sentence embedding.
	Dimensions int `json:"dimensions"`
	// MaxSeqLen is the token sequence length inputs are padded/truncated to.
	MaxSeqLen int `json:"maxSeqLen"`
	// Pooling selects the token->sentence reduction strategy.
	Pooling Pooling `json:"pooling"`
	// QueryPrefix / PassagePrefix are optional instruction prefixes some
	// models (e.g. e5) require, prepended to query and document text
	// respectively before tokenization. Empty for MiniLM-style models.
	QueryPrefix   string `json:"queryPrefix"`
	PassagePrefix string `json:"passagePrefix"`
}

// LoadProfile reads and validates a model.json profile from path.
func LoadProfile(path string) (*Profile, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("reading model profile %q: %w", path, err)
	}
	var p Profile
	if err := json.Unmarshal(data, &p); err != nil {
		return nil, fmt.Errorf("parsing model profile %q: %w", path, err)
	}
	if p.Dimensions <= 0 {
		return nil, fmt.Errorf("model profile %q: dimensions must be > 0", path)
	}
	if p.MaxSeqLen <= 0 {
		return nil, fmt.Errorf("model profile %q: maxSeqLen must be > 0", path)
	}
	if p.Pooling == "" {
		p.Pooling = PoolingMean
	}
	if p.Pooling != PoolingMean && p.Pooling != PoolingCLS {
		return nil, fmt.Errorf("model profile %q: unknown pooling %q", path, p.Pooling)
	}
	if p.Name == "" {
		return nil, fmt.Errorf("model profile %q: name is required", path)
	}
	return &p, nil
}
