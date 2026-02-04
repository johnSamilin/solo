# Prompt
I want to add offline semantic (meaning-based) full-text search across notes, but I do not want to use Python or any heavy dependencies.
The solution should rely only on Node.js, or lightweight C++/Go binaries if absolutely necessary, and must be easy to bundle with Electron.
Please recommend and implement a minimal-dependency approach for generating vector embeddings and performing fast semantic search queries.
The code should be ready for extracting text from HTML, generating embeddings, storing/searching them, and returning the most relevant results for a user's query.

# Plan
Plan: Offline Semantic Search for Notes using Transformers.js

## 1. Technology Selection and Dependencies

* Use Transformers.js (from Hugging Face) for generating vector embeddings
* Pure JavaScript/WebAssembly, no Python required
* Runs ONNX models locally, works completely offline
* Pre-trained model: Xenova/all-MiniLM-L6-v2 (22MB, 384-dimensional embeddings)
* Easy to bundle with Electron
* Use new better-sqlite3 database for storing embeddings
    * Already a dependency in the project
* Efficient binary blob storage for vectors
* Fast retrieval with indexed queries
* Implement cosine similarity search
* No additional dependencies needed
* Performant for thousands of notes

## 2. Database Schema for Embeddings

* Create a new SQLite database file for semantic search index
* Design tables:
    * embeddings table: note_id, chunk_id, chunk_text, embedding (BLOB), updated_at
    * index_metadata table: model_version, last_full_index, chunk_size
    * Add migration logic to handle model version changes
    * Store embeddings as Float32Array binary blobs for efficiency

## 3. Text Processing Pipeline

* Create HTML-to-text extraction utility
* Parse note HTML content to extract plain text
* Preserve paragraph boundaries for chunking
* Strip HTML tags while maintaining sentence structure
* Implement text chunking strategy
* Split content into overlapping chunks (e.g., 256 tokens with 50 token overlap)
* Keep chunk metadata (position, paragraph index) for result highlighting
* Handle edge cases: very short notes, empty content, special characters

## 4. Embedding Generation Service

* Create SemanticSearchService class in Electron main process
* Initialize Transformers.js pipeline on first use (lazy loading)
* Implement batch embedding generation for efficiency
* Add progress reporting via IPC for UI feedback
* Handle model loading:
* Cache model files in app userData directory
* Bundle the model with the app (it would be placed in assets folder)
* Verify model integrity on startup
* Implement background indexing:
    * Index new/modified notes incrementally
    * Full re-index capability for model updates
    * Throttle CPU usage to avoid blocking UI

## 5. Vector Search Implementation

* Implement cosine similarity function
* Create efficient search algorithm:
    * Load all embeddings into memory on startup (feasible for thousands of notes)
    * Compute query embedding at search time
    * Calculate similarity scores against all stored embeddings
    * Return top-k results sorted by relevance
* Add result post-processing:
    * Group chunks by note
    * Calculate aggregate note scores
    * Extract relevant text snippets for display

## 6. IPC Handlers and API

* Add new IPC handlers in main.ts:
    * semantic-search-index-note: Index a single note
    * semantic-search-index-all: Full index rebuild with progress
    * semantic-search-query: Perform semantic search
    * semantic-search-status: Get index status and stats
    * semantic-search-clear: Clear search index
* Update preload.ts to expose new API methods
* Define TypeScript interfaces for search requests/responses

## 7. Frontend Integration

* Extend SearchPage component:
    * Add toggle for "Semantic Search" mode
    * Show search mode indicator (fuzzy vs semantic)
* Create SemanticSearchStore (MobX):
    * Track indexing status and progress
    * Cache recent search results
    * Manage search preferences
* Add indexing UI in settings:
    * Show indexing progress indicator
    * Display index statistics (notes indexed, last update)
    * Provide manual re-index button

## 8. Performance Optimizations

* Implement incremental indexing:
    * Track note modification timestamps
    * Only re-embed changed notes
    * Use content hashing to detect actual changes
* Add search result caching:
    * Cache recent query embeddings
    * Invalidate cache on index updates
* Optimize memory usage:
    * Load embeddings lazily or in batches
    * Consider memory-mapped file access for large indices
    * Implement garbage collection for unused model data

## 9. File Structure

New files to create:
* native-clients/electron/electron/semanticSearch/SemanticSearchService.ts
* native-clients/electron/electron/semanticSearch/EmbeddingGenerator.ts
* native-clients/electron/electron/semanticSearch/VectorStore.ts
* native-clients/electron/electron/semanticSearch/TextProcessor.ts
* native-clients/electron/electron/semanticSearch/types.ts
* src/stores/SemanticSearchStore.ts
* src/components/Search/SemanticSearchToggle.tsx
* src/components/Search/SemanticSearchToggle

# Summary

This approach uses Transformers.js with the all-MiniLM-L6-v2 model to generate high-quality semantic embeddings entirely offline. The solution requires only one new npm dependency (@xenova/transformers), leverages the existing better-sqlite3 for storage, and integrates cleanly with the current Electron architecture. The embedding model is small (~22MB) and fast enough to run in real-time on modern hardware. This enables users to search by meaning rather than exact keywords, finding notes about "vacation planning" when searching for "trip preparation" or notes about "feeling sad" when searching for "depression."
