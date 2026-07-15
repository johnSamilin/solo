# solo-search

`solo-search` is a local-only, offline semantic search CLI for [Solo](../../README.md)
notes. It indexes the `.html` note files inside a notes folder (each with a
sidecar `.json` metadata file of the same name) and lets you search them by
meaning, by tags, or both — entirely on-device, with no network calls at
runtime.

It is a Go/CLI counterpart to the Electron-based plan in
[`../../plans/semantic-search.md`](../../plans/semantic-search.md) and follows
the detailed design in
[`../../plans/go-semantic-search-cli-plan.md`](../../plans/go-semantic-search-cli-plan.md).

## How it works

- Notes are plain HTML files. Each block-level element (`p`, `h1`-`h6`, `li`)
  with a `data-tags="..."` attribute (as written by Solo's `ParagraphTags`
  TipTap extension) becomes one indexable **paragraph chunk**, carrying its
  own `paragraphTags`.
- Each note's sidecar `<name>.json` file provides file-level metadata
  (`tags`, `paragraphTags`, `createdAt`, `theme`, `id`), mirroring the
  `FileMetadata` TypeScript type used by the Solo app.
- Indexing computes a 384-dimensional sentence embedding
  (mean-pooled, L2-normalized) for every paragraph chunk using the
  `all-MiniLM-L6-v2` model running locally through ONNX Runtime, and stores
  it in a SQLite database at `<root>/.solo-index/index.db`.
- Indexing is **incremental**: a file is only re-embedded if the combined
  hash of its HTML + JSON sidecar content changed since the last run (or if
  the embedding model version changed).
- Querying supports three modes depending on which flags you provide.

## Building

Requires Go 1.23+ and a C toolchain (cgo is used to `dlopen` the ONNX
Runtime shared library at runtime; it is not statically linked).

```sh
make build              # build for the current host (macOS/Linux) into ./dist
make build-linux        # cross-compile linux/amd64 using a local cross toolchain
make build-linux-docker # cross-compile linux/amd64 inside a golang:bookworm container (needs Docker)
make test               # run all unit tests
```

The resulting binary is a single self-contained executable with no compiled-in
model or Go dependencies beyond what cgo pulls in; it still needs the model
files and the ONNX Runtime shared library available at runtime (see below).

## Runtime requirements

### 1. ONNX Runtime shared library

`solo-search` dynamically loads `onnxruntime.so` (Linux) / `.dylib` (macOS) /
`.dll` (Windows) at startup using [`yalue/onnxruntime_go`](https://github.com/yalue/onnxruntime_go).
This project currently pins onnxruntime_go v1.31.0, which requires the
**ONNX Runtime 1.26.0** C API. Download the matching release for your
platform from the
[onnxruntime releases page](https://github.com/microsoft/onnxruntime/releases/tag/v1.26.0),
e.g. for Ubuntu x86_64:

```sh
curl -LO https://github.com/microsoft/onnxruntime/releases/download/v1.26.0/onnxruntime-linux-x64-1.26.0.tgz
tar xzf onnxruntime-linux-x64-1.26.0.tgz
export SOLO_SEARCH_ONNXRUNTIME_LIB="$PWD/onnxruntime-linux-x64-1.26.0/lib/libonnxruntime.so.1.26.0"
```

If `SOLO_SEARCH_ONNXRUNTIME_LIB` is not set, the library is loaded via the
default dynamic linker search (`onnxruntime.so` must be on `LD_LIBRARY_PATH`
or installed system-wide).

### 2. Model + tokenizer files

`solo-search` expects two files in its **model directory**:

- `model.onnx` — the `all-MiniLM-L6-v2` encoder in ONNX format.
- `vocab.txt` — the matching WordPiece vocabulary (one token per line).

Both are available from the Hugging Face mirror
[`Xenova/all-MiniLM-L6-v2`](https://huggingface.co/Xenova/all-MiniLM-L6-v2):

```sh
mkdir -p models
curl -L https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/onnx/model.onnx -o models/model.onnx
curl -L https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/vocab.txt      -o models/vocab.txt
```

The model directory is resolved in this order:

1. `--model-dir <dir>` flag
2. `SOLO_SEARCH_MODEL_DIR` environment variable
3. a `models/` folder next to the `solo-search` executable

## Usage

```sh
# Build (or rebuild) the semantic index for a notes folder.
solo-search index --root /path/to/notes

# Pure semantic search.
solo-search query --root /path/to/notes --query "vacation planning"

# Pure tag filter (boolean expression: AND / OR / NOT / parentheses).
solo-search query --root /path/to/notes --tags "travel AND NOT food"

# Semantic search with a soft tag-relevance boost.
solo-search query --root /path/to/notes \
  --query "trip budget" \
  --tags "travel AND (budget OR money)" \
  --limit 10
```

At least one of `--query` / `--tags` must be given to `query`; providing both
is allowed and combines them (see "Query modes" below).

All output is a single JSON document written to stdout; progress/log lines go
to stderr, so stdout can be piped directly into `jq` or another tool.

### Query modes

| Flags provided        | Mode                  | Behavior                                                                 |
|------------------------|-----------------------|---------------------------------------------------------------------------|
| `--query` only          | `semantic`            | Pure cosine-similarity ranking over all indexed paragraphs.               |
| `--tags` only           | `tags-only`           | Hard filter: only paragraphs/files whose tags satisfy the expression are returned (no similarity score), sorted newest-first. |
| `--query` **and** `--tags` | `semantic+tag-boost`  | Cosine similarity ranking, with a fixed additive boost (`+0.15`) applied to results whose tags satisfy the expression. Non-matching results are still included, just ranked lower. |

### Tag expression syntax

`--tags` accepts a small boolean language over tag substrings:

```
foo
foo AND bar
foo OR bar
NOT foo
foo AND (bar OR baz)
foo AND NOT archived
```

Matching is case-insensitive substring containment: an atom matches a
paragraph/file if any of its tags (paragraph-level `paragraphTags` union
file-level `tags`) contains the atom as a substring — this mirrors the
existing fuzzy tag-path matching used by Solo's web `SearchPage`.

### JSON output shape

```json
{
  "mode": "semantic+tag-boost",
  "query": "trip budget",
  "tagExpr": "travel AND (budget OR money)",
  "count": 2,
  "results": [
    {
      "filePath": "notebook/travel.html",
      "paragraphIndex": 1,
      "tag": "p",
      "text": "We are saving money for our upcoming vacation to Japan next spring.",
      "paragraphTags": ["travel", "budget"],
      "fileTags": ["travel", "journal"],
      "noteId": "note-travel-1",
      "fileCreatedAt": "2024-05-01T00:00:00Z",
      "score": 0.57,
      "semanticScore": 0.42,
      "tagMatched": true
    }
  ]
}
```

`score` is omitted entirely in `tags-only` mode (all matches are equally
valid); `semanticScore` and `tagMatched` are included whenever a query /
tag expression, respectively, was supplied.

## Index storage

The index lives entirely inside the notes root folder at
`<root>/.solo-index/index.db` (SQLite, via `modernc.org/sqlite`, no cgo
required for the database itself). It is safe to delete this folder at any
time to force a full rebuild on the next `index` run.

Embeddings are stored **int8-quantized** (a per-vector `float32` scale plus
one `int8` per dimension), which is ~4x smaller than raw `float32` blobs.
The quantization error is negligible for cosine-similarity ranking. The
schema is versioned; if a database was built with an older, incompatible
layout, opening it automatically wipes the stale data so the next `index`
run rebuilds it cleanly.

Indexing writes each note's file record and all of its paragraphs in a
single SQLite transaction (`IndexFile`), avoiding one fsync per paragraph.
Embedding runs in batches capped at `MaxBatchSize` (32) texts per ONNX
inference to bound peak memory for notes with many paragraphs.

## Project layout

```
solo/instruments/semantic-search/
├── go.mod
├── Makefile
├── README.md
├── models/                    # place model.onnx + vocab.txt here (not committed)
├── cmd/solo-search/main.go    # CLI entry point (index / query subcommands)
└── internal/
    ├── config/                # path resolution (root, model dir, index path)
    ├── embedding/              # WordPiece tokenizer + ONNX Runtime session wrapper
    ├── htmlparse/              # paragraph/heading/list-item chunk extraction
    ├── metadata/               # sidecar JSON (FileMetadata) loading
    ├── store/                  # SQLite-backed index (files + paragraphs tables)
    ├── fsutil/                 # note file walking + content hashing
    ├── indexer/                # incremental index build orchestration
    └── query/
        ├── tagexpr/            # boolean tag expression parser/evaluator
        └── search/             # the 3 query modes + JSON response shaping
```

## Testing

```sh
make test
```

Unit tests cover the tag-expression parser, HTML paragraph extraction
(including nested block elements), the WordPiece tokenizer, the SQLite
store round-trip, and all three search modes (using a mocked embedding
store, not requiring the actual ONNX model at test time).

An end-to-end run (real ONNX Runtime + real `all-MiniLM-L6-v2` model against
sample notes) has been manually verified to produce correctly ranked
semantic results, correct incremental re-indexing (skipping unchanged
files), and correct behavior for all three query modes.
