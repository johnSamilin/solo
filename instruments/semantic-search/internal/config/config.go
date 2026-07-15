// Package config resolves runtime configuration for the solo-search CLI:
// the root folder to index/search, the location of the ONNX model and
// tokenizer vocabulary, and the path to the index database.
package config

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
)

const (
	// EnvModelDir is the environment variable used to override the model
	// directory when the --model-dir flag is not provided.
	EnvModelDir = "SOLO_SEARCH_MODEL_DIR"

	// EnvOnnxLibPath allows overriding the path to the onnxruntime shared
	// library (libonnxruntime.so / .dylib). If unset, a set of common
	// locations is probed, falling back to the dynamic linker default.
	EnvOnnxLibPath = "SOLO_SEARCH_ONNXRUNTIME_LIB"

	// IndexDirName is the folder created inside the root folder to hold the
	// SQLite index database.
	IndexDirName = ".solo-index"

	// IndexFileName is the SQLite database file name inside IndexDirName.
	IndexFileName = "index.db"

	// ModelFileName is the expected ONNX model file name inside the model
	// directory.
	ModelFileName = "model.onnx"

	// TokenizerFileName is the expected HuggingFace tokenizer file name
	// (tokenizer.json) inside the model directory. It replaces the former
	// WordPiece vocab.txt.
	TokenizerFileName = "tokenizer.json"

	// ProfileFileName is the declarative model profile (model.json) inside
	// the model directory describing dimensions, maxSeqLen, pooling and
	// optional query/passage prefixes.
	ProfileFileName = "model.json"
)

// Config holds resolved paths used across the CLI.
type Config struct {
	// Root is the absolute path to the notes root folder.
	Root string
	// ModelDir is the absolute path to the directory containing model.onnx
	// and vocab.txt.
	ModelDir string
}

// Resolve validates and resolves the root folder and model directory.
// modelDirFlag may be empty, in which case the SOLO_SEARCH_MODEL_DIR
// environment variable is used, falling back to a "models" directory next to
// the executable.
func Resolve(rootFlag, modelDirFlag string) (*Config, error) {
	if rootFlag == "" {
		return nil, errors.New("--root is required")
	}
	root, err := filepath.Abs(rootFlag)
	if err != nil {
		return nil, fmt.Errorf("resolving --root: %w", err)
	}
	info, err := os.Stat(root)
	if err != nil {
		return nil, fmt.Errorf("root folder %q: %w", root, err)
	}
	if !info.IsDir() {
		return nil, fmt.Errorf("root folder %q is not a directory", root)
	}

	modelDir := modelDirFlag
	if modelDir == "" {
		modelDir = os.Getenv(EnvModelDir)
	}
	if modelDir == "" {
		exe, err := os.Executable()
		if err == nil {
			modelDir = filepath.Join(filepath.Dir(exe), "models")
		}
	}
	modelDir, err = filepath.Abs(modelDir)
	if err != nil {
		return nil, fmt.Errorf("resolving model dir: %w", err)
	}

	return &Config{
		Root:     root,
		ModelDir: modelDir,
	}, nil
}

// ModelPath returns the absolute path to the ONNX model file.
func (c *Config) ModelPath() string {
	return filepath.Join(c.ModelDir, ModelFileName)
}

// TokenizerPath returns the absolute path to the HuggingFace tokenizer.json.
func (c *Config) TokenizerPath() string {
	return filepath.Join(c.ModelDir, TokenizerFileName)
}

// ProfilePath returns the absolute path to the model.json profile.
func (c *Config) ProfilePath() string {
	return filepath.Join(c.ModelDir, ProfileFileName)
}

// IndexDir returns the absolute path to the folder holding the index
// database (created inside the root folder).
func (c *Config) IndexDir() string {
	return filepath.Join(c.Root, IndexDirName)
}

// IndexPath returns the absolute path to the SQLite index database file.
func (c *Config) IndexPath() string {
	return filepath.Join(c.IndexDir(), IndexFileName)
}

// EnsureIndexDir creates the index directory if it does not already exist.
func (c *Config) EnsureIndexDir() error {
	return os.MkdirAll(c.IndexDir(), 0o755)
}

// CheckModelFiles verifies that the ONNX model, tokenizer.json and model.json
// profile all exist, returning a descriptive error otherwise.
func (c *Config) CheckModelFiles() error {
	if _, err := os.Stat(c.ModelPath()); err != nil {
		return fmt.Errorf("model file not found at %q (set --model-dir or %s): %w", c.ModelPath(), EnvModelDir, err)
	}
	if _, err := os.Stat(c.TokenizerPath()); err != nil {
		return fmt.Errorf("tokenizer file not found at %q (set --model-dir or %s): %w", c.TokenizerPath(), EnvModelDir, err)
	}
	if _, err := os.Stat(c.ProfilePath()); err != nil {
		return fmt.Errorf("model profile not found at %q (set --model-dir or %s): %w", c.ProfilePath(), EnvModelDir, err)
	}
	return nil
}

// OnnxSharedLibraryPath resolves the path to the onnxruntime shared library,
// honoring the SOLO_SEARCH_ONNXRUNTIME_LIB environment variable if set.
func OnnxSharedLibraryPath() string {
	if p := os.Getenv(EnvOnnxLibPath); p != "" {
		return p
	}
	return ""
}
