// Package store implements the SQLite-backed index used to persist
// per-paragraph embeddings and metadata between `solo-search index` and
// `solo-search query` invocations. The database lives at
// <root>/.solo-index/index.db (see internal/config).
package store

import (
	"database/sql"
	"encoding/binary"
	"fmt"
	"math"
	"time"

	_ "modernc.org/sqlite"
)

// SchemaVersion is bumped whenever the table layout changes in a
// backwards-incompatible way, or when the embedding model changes such that
// previously stored vectors are no longer comparable to newly generated
// ones.
//
// v2: embeddings are stored in a compact int8-quantized format (see
// encodeEmbedding/decodeEmbedding) rather than raw float32, cutting the
// index size roughly 4x.
const SchemaVersion = 2

// Store wraps a *sql.DB providing typed access to the index tables.
type Store struct {
	db *sql.DB
}

// Open opens (creating if necessary) the SQLite database at path and
// ensures the schema exists.
func Open(path string) (*Store, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, fmt.Errorf("opening sqlite database: %w", err)
	}
	// modernc.org/sqlite does not support concurrent writers well; keep a
	// single connection to avoid "database is locked" errors.
	db.SetMaxOpenConns(1)

	s := &Store{db: db}
	if err := s.migrate(); err != nil {
		db.Close()
		return nil, err
	}
	return s, nil
}

// Close closes the underlying database connection.
func (s *Store) Close() error {
	return s.db.Close()
}

func (s *Store) migrate() error {
	_, err := s.db.Exec(`
		PRAGMA journal_mode=WAL;

		CREATE TABLE IF NOT EXISTS index_meta (
			key   TEXT PRIMARY KEY,
			value TEXT NOT NULL
		);

		CREATE TABLE IF NOT EXISTS files (
			path         TEXT PRIMARY KEY,
			content_hash TEXT NOT NULL,
			note_id      TEXT,
			tags         TEXT NOT NULL DEFAULT '',
			theme        TEXT,
			created_at   TEXT,
			indexed_at   TEXT NOT NULL
		);

		CREATE TABLE IF NOT EXISTS paragraphs (
			id             INTEGER PRIMARY KEY AUTOINCREMENT,
			file_path      TEXT NOT NULL REFERENCES files(path) ON DELETE CASCADE,
			paragraph_idx  INTEGER NOT NULL,
			tag            TEXT NOT NULL,
			text           TEXT NOT NULL,
			paragraph_tags TEXT NOT NULL DEFAULT '',
			embedding      BLOB NOT NULL
		);

		CREATE INDEX IF NOT EXISTS idx_paragraphs_file_path
			ON paragraphs(file_path);
	`)
	if err != nil {
		return fmt.Errorf("applying schema: %w", err)
	}

	// Enforce schema version: if an existing database was built with an
	// older, incompatible schema (e.g. the pre-quantization float32 blob
	// layout), wipe the indexed data so it is rebuilt cleanly on the next
	// `index` run. index_meta itself is preserved/reset explicitly.
	stored, err := s.getMeta("schema_version")
	if err != nil && err != sql.ErrNoRows {
		return fmt.Errorf("reading schema version: %w", err)
	}
	expected := fmt.Sprintf("%d", SchemaVersion)
	if stored != "" && stored != expected {
		if _, err := s.db.Exec(`DELETE FROM paragraphs; DELETE FROM files; DELETE FROM index_meta;`); err != nil {
			return fmt.Errorf("wiping outdated index (schema %s -> %s): %w", stored, expected, err)
		}
	}
	if stored != expected {
		if err := s.setMeta("schema_version", expected); err != nil {
			return err
		}
	}
	return nil
}

// --- index_meta accessors -------------------------------------------------

func (s *Store) getMeta(key string) (string, error) {
	var value string
	err := s.db.QueryRow(`SELECT value FROM index_meta WHERE key = ?`, key).Scan(&value)
	if err != nil {
		return "", err
	}
	return value, nil
}

func (s *Store) setMeta(key, value string) error {
	_, err := s.db.Exec(`
		INSERT INTO index_meta (key, value) VALUES (?, ?)
		ON CONFLICT(key) DO UPDATE SET value = excluded.value
	`, key, value)
	return err
}

// GetModelVersion returns the identifier of the embedding model that was
// used to build the currently stored embeddings, or "" if unset (e.g. fresh
// database).
func (s *Store) GetModelVersion() (string, error) {
	v, err := s.getMeta("model_version")
	if err == sql.ErrNoRows {
		return "", nil
	}
	return v, err
}

// SetModelVersion records the embedding model identifier used to build the
// index.
func (s *Store) SetModelVersion(v string) error {
	return s.setMeta("model_version", v)
}

// GetLastFullIndex returns the RFC3339 timestamp of the last full index
// rebuild, or "" if never run.
func (s *Store) GetLastFullIndex() (string, error) {
	v, err := s.getMeta("last_full_index")
	if err == sql.ErrNoRows {
		return "", nil
	}
	return v, err
}

// SetLastFullIndex records the current time as the last full index rebuild
// time.
func (s *Store) SetLastFullIndex(t time.Time) error {
	return s.setMeta("last_full_index", t.UTC().Format(time.RFC3339))
}

// --- files table -----------------------------------------------------------

// FileRecord represents one indexed note file.
type FileRecord struct {
	Path        string
	ContentHash string
	NoteID      string
	Tags        []string
	Theme       string
	CreatedAt   string
	IndexedAt   time.Time
}

// GetFileHash returns the stored content hash for a file path, or "" if the
// file is not present in the index.
func (s *Store) GetFileHash(path string) (string, error) {
	var hash string
	err := s.db.QueryRow(`SELECT content_hash FROM files WHERE path = ?`, path).Scan(&hash)
	if err == sql.ErrNoRows {
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("querying file hash: %w", err)
	}
	return hash, nil
}

// AllFilePaths returns every file path currently tracked in the index.
func (s *Store) AllFilePaths() ([]string, error) {
	rows, err := s.db.Query(`SELECT path FROM files`)
	if err != nil {
		return nil, fmt.Errorf("querying file paths: %w", err)
	}
	defer rows.Close()
	var paths []string
	for rows.Next() {
		var p string
		if err := rows.Scan(&p); err != nil {
			return nil, err
		}
		paths = append(paths, p)
	}
	return paths, rows.Err()
}

// upsertFileTx inserts or replaces a file record and clears its existing
// paragraphs, using the provided transaction. Callers re-insert paragraphs
// within the same transaction.
func upsertFileTx(tx *sql.Tx, rec FileRecord) error {
	if _, err := tx.Exec(`DELETE FROM paragraphs WHERE file_path = ?`, rec.Path); err != nil {
		return fmt.Errorf("clearing old paragraphs: %w", err)
	}

	_, err := tx.Exec(`
		INSERT INTO files (path, content_hash, note_id, tags, theme, created_at, indexed_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(path) DO UPDATE SET
			content_hash = excluded.content_hash,
			note_id      = excluded.note_id,
			tags         = excluded.tags,
			theme        = excluded.theme,
			created_at   = excluded.created_at,
			indexed_at   = excluded.indexed_at
	`, rec.Path, rec.ContentHash, rec.NoteID, joinTags(rec.Tags), rec.Theme, rec.CreatedAt, rec.IndexedAt.UTC().Format(time.RFC3339))
	if err != nil {
		return fmt.Errorf("upserting file record: %w", err)
	}
	return nil
}

// insertParagraphTx inserts a single paragraph within the provided
// transaction using the prepared statement stmt.
func insertParagraphTx(stmt *sql.Stmt, p ParagraphRecord) error {
	_, err := stmt.Exec(p.FilePath, p.ParagraphIdx, p.Tag, p.Text, joinTags(p.ParagraphTags), encodeEmbedding(p.Embedding))
	if err != nil {
		return fmt.Errorf("inserting paragraph: %w", err)
	}
	return nil
}

// IndexFile atomically replaces a file's record and all of its paragraphs
// in a single transaction. This is the preferred entry point for the
// indexer: it avoids one implicit transaction (and fsync) per paragraph,
// giving a large speedup for notes with many paragraphs, and ensures a
// file's index entry is never left half-written.
func (s *Store) IndexFile(rec FileRecord, paragraphs []ParagraphRecord) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if err := upsertFileTx(tx, rec); err != nil {
		return err
	}

	if len(paragraphs) > 0 {
		stmt, err := tx.Prepare(`
			INSERT INTO paragraphs (file_path, paragraph_idx, tag, text, paragraph_tags, embedding)
			VALUES (?, ?, ?, ?, ?, ?)
		`)
		if err != nil {
			return fmt.Errorf("preparing paragraph insert: %w", err)
		}
		defer stmt.Close()

		for _, p := range paragraphs {
			if err := insertParagraphTx(stmt, p); err != nil {
				return err
			}
		}
	}

	return tx.Commit()
}

// UpsertFile inserts or replaces a file record. Existing paragraphs for
// this path are deleted first; callers should re-insert paragraphs after
// calling UpsertFile. Prefer IndexFile for the indexing path; UpsertFile
// remains for callers that manage paragraphs separately.
func (s *Store) UpsertFile(rec FileRecord) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if err := upsertFileTx(tx, rec); err != nil {
		return err
	}

	return tx.Commit()
}

// DeleteFile removes a file record and all its paragraphs (paragraphs are
// removed via ON DELETE CASCADE, but modernc.org/sqlite requires foreign
// keys to be enabled explicitly; we delete explicitly to be safe).
func (s *Store) DeleteFile(path string) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.Exec(`DELETE FROM paragraphs WHERE file_path = ?`, path); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM files WHERE path = ?`, path); err != nil {
		return err
	}
	return tx.Commit()
}

// --- paragraphs table --------------------------------------------------

// ParagraphRecord represents one indexed paragraph chunk with its embedding.
type ParagraphRecord struct {
	FilePath      string
	ParagraphIdx  int
	Tag           string
	Text          string
	ParagraphTags []string
	Embedding     []float32
}

// InsertParagraph adds a single paragraph record to the index. Callers
// typically call UpsertFile first to clear any previous paragraphs for the
// file.
func (s *Store) InsertParagraph(p ParagraphRecord) error {
	_, err := s.db.Exec(`
		INSERT INTO paragraphs (file_path, paragraph_idx, tag, text, paragraph_tags, embedding)
		VALUES (?, ?, ?, ?, ?, ?)
	`, p.FilePath, p.ParagraphIdx, p.Tag, p.Text, joinTags(p.ParagraphTags), encodeEmbedding(p.Embedding))
	if err != nil {
		return fmt.Errorf("inserting paragraph: %w", err)
	}
	return nil
}

// StoredParagraph is a ParagraphRecord as read back from the database,
// including file-level metadata useful for search results.
type StoredParagraph struct {
	ParagraphRecord
	FileTags      []string
	FileTheme     string
	FileCreatedAt string
	NoteID        string
}

// AllParagraphs streams every paragraph in the index, joined with its
// parent file's metadata. Used by the search engine to compute similarity
// against the full corpus (acceptable for the target scale of thousands of
// notes).
func (s *Store) AllParagraphs() ([]StoredParagraph, error) {
	rows, err := s.db.Query(`
		SELECT
			p.file_path, p.paragraph_idx, p.tag, p.text, p.paragraph_tags, p.embedding,
			f.tags, f.theme, f.created_at, f.note_id
		FROM paragraphs p
		JOIN files f ON f.path = p.file_path
	`)
	if err != nil {
		return nil, fmt.Errorf("querying paragraphs: %w", err)
	}
	defer rows.Close()

	var out []StoredParagraph
	for rows.Next() {
		var (
			filePath, tag, text, paragraphTagsRaw string
			paragraphIdx                          int
			embeddingBlob                         []byte
			fileTagsRaw, fileTheme, createdAt     sql.NullString
			noteID                                sql.NullString
		)
		if err := rows.Scan(&filePath, &paragraphIdx, &tag, &text, &paragraphTagsRaw, &embeddingBlob,
			&fileTagsRaw, &fileTheme, &createdAt, &noteID); err != nil {
			return nil, fmt.Errorf("scanning paragraph row: %w", err)
		}
		out = append(out, StoredParagraph{
			ParagraphRecord: ParagraphRecord{
				FilePath:      filePath,
				ParagraphIdx:  paragraphIdx,
				Tag:           tag,
				Text:          text,
				ParagraphTags: splitTags(paragraphTagsRaw),
				Embedding:     decodeEmbedding(embeddingBlob),
			},
			FileTags:      splitTags(fileTagsRaw.String),
			FileTheme:     fileTheme.String,
			FileCreatedAt: createdAt.String,
			NoteID:        noteID.String,
		})
	}
	return out, rows.Err()
}

// --- helpers -------------------------------------------------------------

func joinTags(tags []string) string {
	out := ""
	for i, t := range tags {
		if i > 0 {
			out += ","
		}
		out += t
	}
	return out
}

func splitTags(raw string) []string {
	if raw == "" {
		return nil
	}
	var out []string
	start := 0
	for i := 0; i <= len(raw); i++ {
		if i == len(raw) || raw[i] == ',' {
			if i > start {
				out = append(out, raw[start:i])
			}
			start = i + 1
		}
	}
	return out
}

// Embeddings are stored in a compact int8-quantized format instead of raw
// float32, cutting the on-disk size roughly 4x (from 4 bytes to ~1 byte per
// dimension). Because embeddings produced by the model are L2-normalized,
// each component is in [-1, 1], so we use a symmetric per-vector scale.
//
// Blob layout (little-endian):
//
//	[0:4]   float32 scale   (maxAbs / 127; 0 if the vector is all-zero)
//	[4:4+N] int8    quantized components (value = round(component / scale))
//
// A per-vector scale (rather than a fixed one) preserves relative precision
// even for vectors whose largest component is small. We dequantize back to
// float32 on read for a uniform in-memory representation; the small
// quantization error is negligible for cosine-similarity ranking.
func encodeEmbedding(v []float32) []byte {
	buf := make([]byte, 4+len(v))

	var maxAbs float32
	for _, f := range v {
		a := f
		if a < 0 {
			a = -a
		}
		if a > maxAbs {
			maxAbs = a
		}
	}

	var scale float32
	if maxAbs > 0 {
		scale = maxAbs / 127.0
	}
	binary.LittleEndian.PutUint32(buf[0:4], math.Float32bits(scale))

	for i, f := range v {
		if scale == 0 {
			buf[4+i] = 0
			continue
		}
		q := int32(math.Round(float64(f / scale)))
		if q > 127 {
			q = 127
		} else if q < -128 {
			q = -128
		}
		buf[4+i] = byte(int8(q))
	}
	return buf
}

func decodeEmbedding(buf []byte) []float32 {
	if len(buf) < 4 {
		return nil
	}
	scale := math.Float32frombits(binary.LittleEndian.Uint32(buf[0:4]))
	n := len(buf) - 4
	out := make([]float32, n)
	for i := 0; i < n; i++ {
		q := int8(buf[4+i])
		out[i] = float32(q) * scale
	}
	return out
}
