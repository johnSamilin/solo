// Command solo-search is a local-only semantic search CLI for Solo notes.
//
// Usage:
//
//	solo-search index --root <dir> [--model-dir <dir>] [--file <note>]
//	solo-search query --root <dir> [--query "<text>"] [--tags "<expr>"] [--model-dir <dir>] [--limit N]
//
// Passing --file to `index` (re)indexes only that single note (or removes it
// from the index if it was deleted) instead of walking the whole root.
//
// At least one of --query / --tags must be given to `query`. Results are
// printed to stdout as JSON. See README.md for details.
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/solo-notes/semantic-search/internal/config"
	"github.com/solo-notes/semantic-search/internal/embedding"
	"github.com/solo-notes/semantic-search/internal/indexer"
	"github.com/solo-notes/semantic-search/internal/query/search"
	"github.com/solo-notes/semantic-search/internal/store"
)

func main() {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(2)
	}

	var err error
	switch os.Args[1] {
	case "index":
		err = runIndex(os.Args[2:])
	case "query":
		err = runQuery(os.Args[2:])
	case "-h", "--help", "help":
		printUsage()
		return
	default:
		fmt.Fprintf(os.Stderr, "unknown command %q\n\n", os.Args[1])
		printUsage()
		os.Exit(2)
	}

	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
}

func printUsage() {
	fmt.Fprintln(os.Stderr, `solo-search - local-only semantic search over Solo notes

Usage:
	 solo-search index --root <dir> [--model-dir <dir>] [--file <note>]
	 solo-search query --root <dir> [--query "<text>"] [--tags "<expr>"] [--model-dir <dir>] [--limit N]

Passing --file to "index" (re)indexes only that single note, or removes it
from the index if the file was deleted, instead of scanning the whole root.

At least one of --query / --tags must be provided to "query".
Results are printed to stdout as JSON.`)
}

func runIndex(args []string) error {
	fs := flag.NewFlagSet("index", flag.ExitOnError)
	root := fs.String("root", "", "root folder containing notes to index (required)")
	modelDir := fs.String("model-dir", "", "directory containing model.onnx, tokenizer.json and model.json (defaults to $SOLO_SEARCH_MODEL_DIR or ./models next to the executable)")
	file := fs.String("file", "", "path to a single note (relative to --root, or absolute within it) to (re)index instead of walking the whole root; if the file no longer exists its index entry is removed")
	quiet := fs.Bool("quiet", false, "suppress progress output on stderr")
	if err := fs.Parse(args); err != nil {
		return err
	}

	cfg, err := config.Resolve(*root, *modelDir)
	if err != nil {
		return err
	}
	if err := cfg.EnsureIndexDir(); err != nil {
		return fmt.Errorf("preparing index directory: %w", err)
	}

	if *file != "" {
		return runIndexOne(cfg, *file, *quiet)
	}

	if err := cfg.CheckModelFiles(); err != nil {
		return err
	}

	if err := embedding.InitRuntime(config.OnnxSharedLibraryPath()); err != nil {
		return fmt.Errorf("initializing onnxruntime: %w", err)
	}
	defer embedding.ShutdownRuntime()

	profile, err := embedding.LoadProfile(cfg.ProfilePath())
	if err != nil {
		return fmt.Errorf("loading model profile: %w", err)
	}
	model, err := embedding.LoadModel(embedding.LoadOptions{
		ModelPath:     cfg.ModelPath(),
		TokenizerPath: cfg.TokenizerPath(),
		Profile:       profile,
	})
	if err != nil {
		return fmt.Errorf("loading model: %w", err)
	}
	defer model.Close()

	st, err := store.Open(cfg.IndexPath())
	if err != nil {
		return fmt.Errorf("opening index: %w", err)
	}
	defer st.Close()

	result, err := indexer.Run(indexer.Options{
		Root:  cfg.Root,
		Store: st,
		Model: model,
		Progress: func(processed, total int, relPath string) {
			if !*quiet {
				fmt.Fprintf(os.Stderr, "[%d/%d] %s\n", processed, total, relPath)
			}
		},
	})
	if err != nil {
		return fmt.Errorf("indexing failed: %w", err)
	}

	return json.NewEncoder(os.Stdout).Encode(result)
}

// relFromRoot normalizes a --file value (which may be absolute or relative to
// the current working directory or to --root) into a path relative to the
// resolved root folder.
func relFromRoot(root, file string) (string, error) {
	abs, err := filepath.Abs(file)
	if err != nil {
		return "", fmt.Errorf("resolving --file %q: %w", file, err)
	}
	rel, err := filepath.Rel(root, abs)
	if err != nil {
		return "", fmt.Errorf("resolving --file %q relative to root: %w", file, err)
	}
	if strings.HasPrefix(rel, ".."+string(filepath.Separator)) || rel == ".." {
		return "", fmt.Errorf("--file %q is outside the root folder %q", file, root)
	}
	return rel, nil
}

// runIndexOne (re)indexes a single note. It only loads the embedding model
// when the note still exists on disk (a deletion just removes the index entry
// and needs no model), so it works even in environments where the model files
// are unavailable but a note was removed.
func runIndexOne(cfg *config.Config, file string, quiet bool) error {
	relPath, err := relFromRoot(cfg.Root, file)
	if err != nil {
		return err
	}

	st, err := store.Open(cfg.IndexPath())
	if err != nil {
		return fmt.Errorf("opening index: %w", err)
	}
	defer st.Close()

	absPath := filepath.Join(cfg.Root, relPath)
	_, statErr := os.Stat(absPath)
	fileExists := statErr == nil

	var model *embedding.Model
	if fileExists {
		if err := cfg.CheckModelFiles(); err != nil {
			return err
		}
		if err := embedding.InitRuntime(config.OnnxSharedLibraryPath()); err != nil {
			return fmt.Errorf("initializing onnxruntime: %w", err)
		}
		defer embedding.ShutdownRuntime()

		profile, err := embedding.LoadProfile(cfg.ProfilePath())
		if err != nil {
			return fmt.Errorf("loading model profile: %w", err)
		}
		model, err = embedding.LoadModel(embedding.LoadOptions{
			ModelPath:     cfg.ModelPath(),
			TokenizerPath: cfg.TokenizerPath(),
			Profile:       profile,
		})
		if err != nil {
			return fmt.Errorf("loading model: %w", err)
		}
		defer model.Close()
	}

	result, err := indexer.RunOne(indexer.OneOptions{
		Root:    cfg.Root,
		Store:   st,
		Model:   model,
		RelPath: relPath,
	})
	if err != nil {
		return fmt.Errorf("indexing failed: %w", err)
	}

	if !quiet {
		switch {
		case result.FilesRemoved > 0:
			fmt.Fprintf(os.Stderr, "removed %s from index\n", relPath)
		case result.FilesSkipped > 0:
			fmt.Fprintf(os.Stderr, "unchanged %s (skipped)\n", relPath)
		default:
			fmt.Fprintf(os.Stderr, "indexed %s (%d paragraphs)\n", relPath, result.ParagraphsNew)
		}
	}

	return json.NewEncoder(os.Stdout).Encode(result)
}

func runQuery(args []string) error {
	fs := flag.NewFlagSet("query", flag.ExitOnError)
	root := fs.String("root", "", "root folder containing the notes index (required)")
	modelDir := fs.String("model-dir", "", "directory containing model.onnx, tokenizer.json and model.json")
	queryText := fs.String("query", "", "semantic search query text")
	tagsExpr := fs.String("tags", "", "boolean tag expression, e.g. \"foo AND (bar OR baz)\"")
	limit := fs.Int("limit", search.DefaultLimit, "maximum number of results to return")
	if err := fs.Parse(args); err != nil {
		return err
	}

	if *queryText == "" && *tagsExpr == "" {
		return fmt.Errorf("at least one of --query or --tags must be provided")
	}

	cfg, err := config.Resolve(*root, *modelDir)
	if err != nil {
		return err
	}

	if _, statErr := os.Stat(cfg.IndexPath()); statErr != nil {
		return fmt.Errorf("no index found at %q; run 'solo-search index --root %s' first", cfg.IndexPath(), cfg.Root)
	}

	st, err := store.Open(cfg.IndexPath())
	if err != nil {
		return fmt.Errorf("opening index: %w", err)
	}
	defer st.Close()

	var model *embedding.Model
	if *queryText != "" {
		if err := cfg.CheckModelFiles(); err != nil {
			return err
		}
		if err := embedding.InitRuntime(config.OnnxSharedLibraryPath()); err != nil {
			return fmt.Errorf("initializing onnxruntime: %w", err)
		}
		defer embedding.ShutdownRuntime()

		profile, err := embedding.LoadProfile(cfg.ProfilePath())
		if err != nil {
			return fmt.Errorf("loading model profile: %w", err)
		}
		model, err = embedding.LoadModel(embedding.LoadOptions{
			ModelPath:     cfg.ModelPath(),
			TokenizerPath: cfg.TokenizerPath(),
			Profile:       profile,
		})
		if err != nil {
			return fmt.Errorf("loading model: %w", err)
		}
		defer model.Close()
	}

	resp, err := search.Run(search.Options{
		Store:   st,
		Model:   model,
		Query:   *queryText,
		TagExpr: *tagsExpr,
		Limit:   *limit,
	})
	if err != nil {
		return err
	}

	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	return enc.Encode(resp)
}
