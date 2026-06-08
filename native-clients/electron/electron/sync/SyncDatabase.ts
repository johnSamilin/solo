/**
 * SyncDatabase — SQLite база данных для отслеживания состояния синхронизации.
 *
 * Использует better-sqlite3 (уже есть как зависимость в main.ts).
 * Создаётся в userData папке приложения.
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';

const DB_FILENAME = 'sync.db';

export interface DBPeer {
  id: string;
  name: string;
  deviceType: string;
  macAddress: string | null;
  lastSeenAt: number;
  firstSeenAt: number;
  trustStatus: 'pending' | 'trusted' | 'blocked';
  publicKey: string | null;
  protocolVersion: number;
  isPaired: number;
}

export interface DBLedgerEntry {
  id: number;
  fileId: string;
  filePath: string;
  version: number;
  checksum: string;
  sizeBytes: number;
  modifiedAt: number;
  modifiedBy: string | null;
  operation: 'create' | 'update' | 'delete';
  parentVersion: number | null;
  syncedAt: number | null;
}

export interface DBQueueEntry {
  id: number;
  fileId: string;
  filePath: string;
  operation: 'create' | 'update' | 'delete';
  localVersion: number;
  checksum: string | null;
  createdAt: number;
  status: 'pending' | 'in_progress' | 'failed' | 'done';
  retryCount: number;
  lastError: string | null;
  targetPeerId: string | null;
}

export interface DBTombstone {
  fileId: string;
  deletedAt: number;
  originalPath: string;
  checksum: string | null;
  syncedToPeers: number;
}

export interface DBConflict {
  id: number;
  fileId: string;
  filePath: string | null;
  localVersion: number;
  remoteVersion: number;
  localChecksum: string | null;
  remoteChecksum: string | null;
  localModifiedAt: number;
  remoteModifiedAt: number;
  localContent: string | null;
  remoteContent: string | null;
  resolution: 'pending' | 'auto_resolved' | 'manual';
  resolvedAt: number | null;
  resolvedBy: string | null;
  createdAt: number;
}

export class SyncDatabase {
  private db: Database.Database;
  private dbPath: string;

  constructor(dataDir?: string) {
    const dir = dataDir || app.getPath('userData');
    this.dbPath = path.join(dir, DB_FILENAME);

    // Создаём директорию, если её нет
    const dbDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = new Database(this.dbPath);

    // Оптимизации
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    this.migrate();
  }

  /**
   * Создаёт схему базы данных, если таблицы ещё не существуют.
   */
  private migrate(): void {
    // Проверяем версию схемы
    const hasSchemaVersion = this.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'")
      .get();

    if (!hasSchemaVersion) {
      this.db.exec(`
        CREATE TABLE schema_version (
          version INTEGER PRIMARY KEY,
          applied_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
        );

        CREATE TABLE sync_peers (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          device_type TEXT NOT NULL CHECK(device_type IN ('android', 'linux', 'mac', 'electron')),
          mac_address TEXT,
          last_seen_at INTEGER NOT NULL,
          first_seen_at INTEGER NOT NULL,
          trust_status TEXT DEFAULT 'pending' CHECK(trust_status IN ('pending', 'trusted', 'blocked')),
          public_key TEXT,
          protocol_version INTEGER DEFAULT 1,
          is_paired INTEGER DEFAULT 0
        );

        CREATE TABLE sync_ledger (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          file_id TEXT NOT NULL,
          file_path TEXT NOT NULL,
          version INTEGER NOT NULL DEFAULT 1,
          checksum TEXT NOT NULL,
          size_bytes INTEGER NOT NULL DEFAULT 0,
          modified_at INTEGER NOT NULL,
          modified_by TEXT,
          operation TEXT NOT NULL CHECK(operation IN ('create', 'update', 'delete')),
          parent_version INTEGER,
          synced_at INTEGER
        );

        CREATE INDEX idx_ledger_file_id ON sync_ledger(file_id);
        CREATE INDEX idx_ledger_modified_at ON sync_ledger(modified_at);
        CREATE INDEX idx_ledger_synced ON sync_ledger(synced_at);

        CREATE TABLE sync_queue (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          file_id TEXT NOT NULL,
          file_path TEXT NOT NULL,
          operation TEXT NOT NULL CHECK(operation IN ('create', 'update', 'delete')),
          local_version INTEGER NOT NULL,
          checksum TEXT,
          created_at INTEGER NOT NULL,
          status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'failed', 'done')),
          retry_count INTEGER DEFAULT 0,
          last_error TEXT,
          target_peer_id TEXT,
          FOREIGN KEY (target_peer_id) REFERENCES sync_peers(id)
        );

        CREATE INDEX idx_queue_status ON sync_queue(status);
        CREATE INDEX idx_queue_created ON sync_queue(created_at);

        CREATE TABLE tombstone (
          file_id TEXT PRIMARY KEY,
          deleted_at INTEGER NOT NULL,
          original_path TEXT NOT NULL,
          checksum TEXT,
          synced_to_peers INTEGER DEFAULT 0
        );

        CREATE INDEX idx_tombstone_deleted_at ON tombstone(deleted_at);

        CREATE TABLE sync_conflicts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          file_id TEXT NOT NULL,
          file_path TEXT,
          local_version INTEGER NOT NULL,
          remote_version INTEGER NOT NULL,
          local_checksum TEXT,
          remote_checksum TEXT,
          local_modified_at INTEGER NOT NULL,
          remote_modified_at INTEGER NOT NULL,
          local_content TEXT,
          remote_content TEXT,
          resolution TEXT DEFAULT 'pending' CHECK(resolution IN ('pending', 'auto_resolved', 'manual')),
          resolved_at INTEGER,
          resolved_by TEXT CHECK(resolved_by IN ('lww', 'local_wins', 'remote_wins', 'manual_merge')),
          created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
        );

        CREATE INDEX idx_conflicts_resolution ON sync_conflicts(resolution);
        CREATE INDEX idx_conflicts_file_id ON sync_conflicts(file_id);

        CREATE TABLE sync_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );

        -- Версия схемы
        INSERT INTO schema_version (version, applied_at) VALUES (1, unixepoch('now') * 1000);
      `);
    }
  }

  // ==================== Sync Peers ====================

  upsertPeer(peer: DBPeer): void {
    const stmt = this.db.prepare(`
      INSERT INTO sync_peers (id, name, device_type, mac_address, last_seen_at, first_seen_at, trust_status, public_key, protocol_version, is_paired)
      VALUES (@id, @name, @deviceType, @macAddress, @lastSeenAt, @firstSeenAt, @trustStatus, @publicKey, @protocolVersion, @isPaired)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        device_type = excluded.device_type,
        mac_address = excluded.mac_address,
        last_seen_at = excluded.last_seen_at,
        trust_status = excluded.trust_status,
        protocol_version = excluded.protocol_version,
        is_paired = excluded.is_paired
    `);
    stmt.run(peer);
  }

  getPeer(id: string): DBPeer | undefined {
    return this.db.prepare('SELECT * FROM sync_peers WHERE id = ?').get(id) as DBPeer | undefined;
  }

  getAllPeers(): DBPeer[] {
    return this.db.prepare('SELECT * FROM sync_peers ORDER BY last_seen_at DESC').all() as DBPeer[];
  }

  getTrustedPeers(): DBPeer[] {
    return this.db.prepare("SELECT * FROM sync_peers WHERE trust_status = 'trusted' ORDER BY last_seen_at DESC").all() as DBPeer[];
  }

  deletePeer(id: string): void {
    this.db.prepare('DELETE FROM sync_peers WHERE id = ?').run(id);
  }

  // ==================== Sync Ledger ====================

  getLatestLedgerEntry(fileId: string): DBLedgerEntry | undefined {
    return this.db
      .prepare('SELECT * FROM sync_ledger WHERE file_id = ? ORDER BY version DESC LIMIT 1')
      .get(fileId) as DBLedgerEntry | undefined;
  }

  getAllLatestLedgerEntries(): DBLedgerEntry[] {
    // Получить последнюю версию каждого файла
    return this.db
      .prepare(`
        SELECT l.* FROM sync_ledger l
        INNER JOIN (
          SELECT file_id, MAX(version) as max_version
          FROM sync_ledger
          GROUP BY file_id
        ) latest ON l.file_id = latest.file_id AND l.version = latest.max_version
        ORDER BY l.modified_at DESC
      `)
      .all() as DBLedgerEntry[];
  }

  addLedgerEntry(entry: Omit<DBLedgerEntry, 'id' | 'syncedAt'>): void {
    this.db
      .prepare(`
        INSERT INTO sync_ledger (file_id, file_path, version, checksum, size_bytes, modified_at, modified_by, operation, parent_version)
        VALUES (@fileId, @filePath, @version, @checksum, @sizeBytes, @modifiedAt, @modifiedBy, @operation, @parentVersion)
      `)
      .run(entry);
  }

  markLedgerSynced(fileId: string, version: number): void {
    this.db
      .prepare('UPDATE sync_ledger SET synced_at = ? WHERE file_id = ? AND version = ?')
      .run(Date.now(), fileId, version);
  }

  // ==================== Sync Queue ====================

  addToQueue(entry: {
    fileId: string;
    filePath: string;
    operation: 'create' | 'update' | 'delete';
    localVersion: number;
    checksum: string | null;
    targetPeerId?: string | null;
  }): void {
    this.db
      .prepare(`
        INSERT INTO sync_queue (file_id, file_path, operation, local_version, checksum, created_at, status, target_peer_id)
        VALUES (@fileId, @filePath, @operation, @localVersion, @checksum, @createdAt, 'pending', @targetPeerId)
      `)
      .run({ ...entry, createdAt: Date.now(), targetPeerId: entry.targetPeerId || null });
  }

  getPendingQueueEntries(): DBQueueEntry[] {
    return this.db
      .prepare("SELECT * FROM sync_queue WHERE status IN ('pending', 'failed') ORDER BY created_at ASC LIMIT 50")
      .all() as DBQueueEntry[];
  }

  updateQueueStatus(id: number, status: DBQueueEntry['status'], error?: string): void {
    this.db
      .prepare('UPDATE sync_queue SET status = ?, retry_count = retry_count + 1, last_error = ? WHERE id = ?')
      .run(status, error || null, id);
  }

  clearCompletedQueue(): void {
    this.db.prepare("DELETE FROM sync_queue WHERE status = 'done'").run();
  }

  // ==================== Tombstones ====================

  addTombstone(fileId: string, originalPath: string, checksum?: string): void {
    this.db
      .prepare(`
        INSERT INTO tombstone (file_id, deleted_at, original_path, checksum)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(file_id) DO UPDATE SET
          deleted_at = excluded.deleted_at,
          original_path = excluded.original_path,
          checksum = excluded.checksum
      `)
      .run(fileId, Date.now(), originalPath, checksum || null);
  }

  getTombstone(fileId: string): DBTombstone | undefined {
    return this.db.prepare('SELECT * FROM tombstone WHERE file_id = ?').get(fileId) as DBTombstone | undefined;
  }

  getAllTombstones(): DBTombstone[] {
    return this.db.prepare('SELECT * FROM tombstone WHERE synced_to_peers = 0 ORDER BY deleted_at DESC').all() as DBTombstone[];
  }

  markTombstoneSynced(fileId: string): void {
    this.db.prepare('UPDATE tombstone SET synced_to_peers = 1 WHERE file_id = ?').run(fileId);
  }

  cleanupOldTombstones(ttlDays: number = 30): void {
    const cutoff = Date.now() - ttlDays * 24 * 60 * 60 * 1000;
    this.db.prepare('DELETE FROM tombstone WHERE deleted_at < ?').run(cutoff);
  }

  // ==================== Conflicts ====================

  addConflict(conflict: Omit<DBConflict, 'id' | 'createdAt' | 'resolution' | 'resolvedAt' | 'resolvedBy'>): number {
    const result = this.db
      .prepare(`
        INSERT INTO sync_conflicts (file_id, file_path, local_version, remote_version, local_checksum, remote_checksum, local_modified_at, remote_modified_at, local_content, remote_content)
        VALUES (@fileId, @filePath, @localVersion, @remoteVersion, @localChecksum, @remoteChecksum, @localModifiedAt, @remoteModifiedAt, @localContent, @remoteContent)
      `)
      .run(conflict);
    return result.lastInsertRowid as number;
  }

  getConflicts(resolution?: DBConflict['resolution']): DBConflict[] {
    if (resolution) {
      return this.db
        .prepare('SELECT * FROM sync_conflicts WHERE resolution = ? ORDER BY created_at DESC')
        .all(resolution) as DBConflict[];
    }
    return this.db.prepare('SELECT * FROM sync_conflicts ORDER BY created_at DESC').all() as DBConflict[];
  }

  resolveConflict(id: number, resolution: DBConflict['resolution'], resolvedBy: DBConflict['resolvedBy']): void {
    this.db
      .prepare('UPDATE sync_conflicts SET resolution = ?, resolved_by = ?, resolved_at = ? WHERE id = ?')
      .run(resolution, resolvedBy, Date.now(), id);
  }

  // ==================== Settings ====================

  getSetting(key: string): string | undefined {
    const row = this.db.prepare('SELECT value FROM sync_settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value;
  }

  setSetting(key: string, value: string): void {
    this.db
      .prepare('INSERT INTO sync_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at')
      .run(key, value, Date.now());
  }

  getAllSettings(): Record<string, string> {
    const rows = this.db.prepare('SELECT key, value FROM sync_settings').all() as { key: string; value: string }[];
    const settings: Record<string, string> = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    return settings;
  }

  // ==================== Обслуживание ====================

  /**
   * Возвращает статистику БД.
   */
  getStats(): { peersCount: number; ledgerEntries: number; queuePending: number; conflictsPending: number; tombstonesCount: number } {
    const peersCount = (this.db.prepare('SELECT COUNT(*) as count FROM sync_peers').get() as any).count;
    const ledgerEntries = (this.db.prepare('SELECT COUNT(*) as count FROM sync_ledger').get() as any).count;
    const queuePending = (this.db.prepare("SELECT COUNT(*) as count FROM sync_queue WHERE status IN ('pending', 'failed')").get() as any).count;
    const conflictsPending = (this.db.prepare("SELECT COUNT(*) as count FROM sync_conflicts WHERE resolution = 'pending'").get() as any).count;
    const tombstonesCount = (this.db.prepare('SELECT COUNT(*) as count FROM tombstone').get() as any).count;

    return { peersCount, ledgerEntries, queuePending, conflictsPending, tombstonesCount };
  }

  /**
   * Закрывает соединение с БД.
   */
  close(): void {
    this.db.close();
  }
  
  /**
   * Получает время последней синхронизации.
   */
  getLastSyncTime(): number | null {
    const value = this.getSetting('last_sync_time');
    if (value) {
      return parseInt(value, 10);
    }
    return null;
  }
  
  /**
   * Обновляет время последней синхронизации.
   */
  updateLastSyncTime(timestamp: number): void {
    this.setSetting('last_sync_time', timestamp.toString());
  }
}
