// Package embedding: model.go wraps an ONNX Runtime session for a
// sentence-transformer style encoder (e.g. all-MiniLM-L6-v2), producing
// mean-pooled, L2-normalized sentence embeddings.
package embedding

import (
	"fmt"
	"math"
	"sync"

	ort "github.com/yalue/onnxruntime_go"
)

// DefaultMaxSeqLen matches the training sequence length used by
// all-MiniLM-L6-v2 (and is a safe default for similar small encoders).
const DefaultMaxSeqLen = 256

// DefaultDimensions is the embedding size produced by all-MiniLM-L6-v2.
const DefaultDimensions = 384

// MaxBatchSize caps how many texts are packed into a single ONNX Run() call.
// Larger inputs are transparently split into sub-batches by EmbedBatch to
// bound peak memory: a single tensor is batch * maxSeqLen * hidden floats,
// which grows quickly for notes with hundreds of paragraphs.
const MaxBatchSize = 32

var initOnce sync.Once
var initErr error

// InitRuntime initializes the global onnxruntime environment exactly once.
// libPath may be empty, in which case the platform default search is used
// (onnxruntime.so / .dylib / .dll on the linker path).
func InitRuntime(libPath string) error {
	initOnce.Do(func() {
		if libPath != "" {
			ort.SetSharedLibraryPath(libPath)
		}
		initErr = ort.InitializeEnvironment()
	})
	return initErr
}

// ShutdownRuntime releases the global onnxruntime environment. Safe to call
// even if InitRuntime failed or was never called.
func ShutdownRuntime() {
	if ort.IsInitialized() {
		_ = ort.DestroyEnvironment()
	}
}

// Model wraps a loaded ONNX encoder session plus its tokenizer, and exposes
// a simple Embed(text) -> []float32 API producing normalized sentence
// vectors via mean pooling over token embeddings.
type Model struct {
	tokenizer *Tokenizer
	session   *ort.DynamicAdvancedSession
	inputName [3]string // input_ids, attention_mask, token_type_ids
	hasType   bool
	outputName string
	maxSeqLen int
	dims      int
}

// LoadOptions configures Model loading.
type LoadOptions struct {
	ModelPath string
	VocabPath string
	MaxSeqLen int // 0 => DefaultMaxSeqLen
}

// LoadModel loads the tokenizer vocabulary and ONNX model, inspecting the
// model's declared inputs/outputs to determine tensor names.
func LoadModel(opts LoadOptions) (*Model, error) {
	maxSeq := opts.MaxSeqLen
	if maxSeq <= 0 {
		maxSeq = DefaultMaxSeqLen
	}

	tok, err := NewTokenizerFromFile(opts.VocabPath, maxSeq)
	if err != nil {
		return nil, fmt.Errorf("loading tokenizer: %w", err)
	}

	inputInfo, outputInfo, err := ort.GetInputOutputInfo(opts.ModelPath)
	if err != nil {
		return nil, fmt.Errorf("inspecting model %q: %w", opts.ModelPath, err)
	}

	m := &Model{tokenizer: tok, maxSeqLen: maxSeq, dims: DefaultDimensions}

	inputNames := make([]string, 0, len(inputInfo))
	for _, in := range inputInfo {
		inputNames = append(inputNames, in.Name)
		switch in.Name {
		case "input_ids":
			m.inputName[0] = in.Name
		case "attention_mask":
			m.inputName[1] = in.Name
		case "token_type_ids":
			m.inputName[2] = in.Name
			m.hasType = true
		}
	}
	if m.inputName[0] == "" || m.inputName[1] == "" {
		return nil, fmt.Errorf("model %q does not expose expected input_ids/attention_mask inputs (found: %v)", opts.ModelPath, inputNames)
	}

	// Prefer an output named like a hidden-state / token-embeddings tensor;
	// otherwise fall back to the first declared output.
	outputNames := make([]string, 0, len(outputInfo))
	for _, out := range outputInfo {
		outputNames = append(outputNames, out.Name)
	}
	m.outputName = pickOutputName(outputNames)
	if m.outputName == "" {
		return nil, fmt.Errorf("model %q does not declare any outputs", opts.ModelPath)
	}

	sessionInputNames := []string{m.inputName[0], m.inputName[1]}
	if m.hasType {
		sessionInputNames = append(sessionInputNames, m.inputName[2])
	}
	session, err := ort.NewDynamicAdvancedSession(opts.ModelPath, sessionInputNames, []string{m.outputName}, nil)
	if err != nil {
		return nil, fmt.Errorf("creating onnx session: %w", err)
	}
	m.session = session

	return m, nil
}

func pickOutputName(names []string) string {
	preferred := []string{"last_hidden_state", "token_embeddings", "hidden_state", "output"}
	for _, p := range preferred {
		for _, n := range names {
			if n == p {
				return n
			}
		}
	}
	if len(names) > 0 {
		return names[0]
	}
	return ""
}

// Close releases the underlying ONNX session.
func (m *Model) Close() error {
	if m.session != nil {
		return m.session.Destroy()
	}
	return nil
}

// Dimensions returns the size of embeddings produced by this model.
func (m *Model) Dimensions() int {
	return m.dims
}

// Embed tokenizes and runs the model for a single text, returning a
// mean-pooled, L2-normalized sentence embedding of length Dimensions().
func (m *Model) Embed(text string) ([]float32, error) {
	vecs, err := m.EmbedBatch([]string{text})
	if err != nil {
		return nil, err
	}
	return vecs[0], nil
}

// EmbedBatch tokenizes and runs the model for a batch of texts, returning
// one mean-pooled, L2-normalized embedding per input text. Inputs larger
// than MaxBatchSize are transparently split into sub-batches to bound peak
// memory usage; results are concatenated back in input order.
func (m *Model) EmbedBatch(texts []string) ([][]float32, error) {
	if len(texts) == 0 {
		return nil, nil
	}
	if len(texts) <= MaxBatchSize {
		return m.embedBatchRaw(texts)
	}

	out := make([][]float32, 0, len(texts))
	for start := 0; start < len(texts); start += MaxBatchSize {
		end := start + MaxBatchSize
		if end > len(texts) {
			end = len(texts)
		}
		vecs, err := m.embedBatchRaw(texts[start:end])
		if err != nil {
			return nil, err
		}
		out = append(out, vecs...)
	}
	return out, nil
}

// embedBatchRaw runs a single ONNX inference over a batch that is assumed to
// be no larger than MaxBatchSize.
func (m *Model) embedBatchRaw(texts []string) ([][]float32, error) {
	if len(texts) == 0 {
		return nil, nil
	}
	batch := len(texts)
	seq := m.maxSeqLen

	inputIDs := make([]int64, batch*seq)
	attnMask := make([]int64, batch*seq)
	typeIDs := make([]int64, batch*seq)

	for i, text := range texts {
		enc := m.tokenizer.Encode(text)
		copy(inputIDs[i*seq:(i+1)*seq], enc.InputIDs)
		copy(attnMask[i*seq:(i+1)*seq], enc.AttentionMask)
		copy(typeIDs[i*seq:(i+1)*seq], enc.TokenTypeIDs)
	}

	shape := ort.NewShape(int64(batch), int64(seq))

	idsTensor, err := ort.NewTensor(shape, inputIDs)
	if err != nil {
		return nil, fmt.Errorf("creating input_ids tensor: %w", err)
	}
	defer idsTensor.Destroy()

	maskTensor, err := ort.NewTensor(shape, attnMask)
	if err != nil {
		return nil, fmt.Errorf("creating attention_mask tensor: %w", err)
	}
	defer maskTensor.Destroy()

	inputs := []ort.Value{idsTensor, maskTensor}
	if m.hasType {
		typeTensor, err := ort.NewTensor(shape, typeIDs)
		if err != nil {
			return nil, fmt.Errorf("creating token_type_ids tensor: %w", err)
		}
		defer typeTensor.Destroy()
		inputs = append(inputs, typeTensor)
	}

	outputs := []ort.Value{nil}
	if err := m.session.Run(inputs, outputs); err != nil {
		return nil, fmt.Errorf("running onnx session: %w", err)
	}
	outTensor, ok := outputs[0].(*ort.Tensor[float32])
	if !ok {
		return nil, fmt.Errorf("unexpected output tensor type %T", outputs[0])
	}
	defer outTensor.Destroy()

	outShape := outTensor.GetShape()
	if len(outShape) != 3 {
		return nil, fmt.Errorf("unexpected output shape %v, expected [batch, seq, hidden]", outShape)
	}
	hidden := int(outShape[2])
	data := outTensor.GetData()

	result := make([][]float32, batch)
	for b := 0; b < batch; b++ {
		sum := make([]float32, hidden)
		var count float32
		for s := 0; s < seq; s++ {
			mask := attnMask[b*seq+s]
			if mask == 0 {
				continue
			}
			base := (b*seq + s) * hidden
			for h := 0; h < hidden; h++ {
				sum[h] += data[base+h]
			}
			count++
		}
		if count == 0 {
			count = 1
		}
		for h := 0; h < hidden; h++ {
			sum[h] /= count
		}
		normalize(sum)
		result[b] = sum
	}

	return result, nil
}

func normalize(v []float32) {
	var sumSq float32
	for _, x := range v {
		sumSq += x * x
	}
	if sumSq == 0 {
		return
	}
	norm := float32(math.Sqrt(float64(sumSq)))
	for i := range v {
		v[i] /= norm
	}
}
