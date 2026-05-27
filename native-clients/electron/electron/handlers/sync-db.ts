import { app, ipcMain } from 'electron';
import * as path from 'path';
import Database from 'better-sqlite3';

// ============================================================
// Sync State Database (SQLite) — IPC handler
// ============================================================

interface SyncFileRow {
  file_id: string;
  note_id: string;
  device_id: string;
  version: number;
  content_hash: string;
  mtime: number;
  deleted: number;
  file_type: string;
}

interface SyncPeerRow {
  device_id: string;
  device_name: string;
  last_seen: number;
  last_version_map: string;
  address: string;
  transport: string;
}

interface SyncOpRow {
  op_id: string;
  note_id: string;
  file_id: string;
  op_type: string;
  old_path: string | null;
  new_path: string | null;
  timestamp: number;
  device_id: string;
  applied: number;
}

interface SyncConflictRow {
  conflict_id: string;
  file_id: string;
  note_id: string;
  local_version: number;
  remote_version: number;
  local_content_hash: string;
  remote_content_hash: string;
  resolved: number;
  resolution: string | null;
  created_at: number;
}

let syncDb: Database.Database | null = null;

function getSyncDbPath(): string {
  return path.join(app.getPath('userData'), 'sync.db');
}

function ensureSyncDb(): Database.Database {
  if (syncDb) return syncDb;

  const dbPath = getSyncDbPath();
  syncDb = new Database(dbPath);

  // Включаем WAL для производительности
  syncDb.pragma('journal_mode = WAL');

  // Создаём таблицы, если не существуют
  syncDb.exec(`
    CREATE TABLE IF NOT EXISTS sync_files (
      file_id TEXT PRIMARY KEY,
      note_id TEXT NOT NULL DEFAULT '',
      device_id TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      content_hash TEXT NOT NULL DEFAULT '',
      mtime INTEGER NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0,
      file_type TEXT NOT NULL DEFAULT 'html'
    );

    CREATE TABLE IF NOT EXISTS sync_peers (
      device_id TEXT PRIMARY KEY,
      device_name TEXT NOT NULL DEFAULT '',
      last_seen INTEGER NOT NULL DEFAULT 0,
      last_version_map TEXT NOT NULL DEFAULT '{}',
      address TEXT NOT NULL DEFAULT '',
      transport TEXT NOT NULL DEFAULT 'wifi'
    );

    CREATE TABLE IF NOT EXISTS sync_operations (
      op_id TEXT PRIMARY KEY,
      note_id TEXT NOT NULL DEFAULT '',
      file_id TEXT NOT NULL DEFAULT '',
      op_type TEXT NOT NULL,
      old_path TEXT,
      new_path TEXT,
      timestamp INTEGER NOT NULL,
      device_id TEXT NOT NULL,
      applied INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sync_conflicts (
      conflict_id TEXT PRIMARY KEY,
      file_id TEXT NOT NULL DEFAULT '',
      note_id TEXT NOT NULL DEFAULT '',
      local_version INTEGER NOT NULL DEFAULT 0,
      remote_version INTEGER NOT NULL DEFAULT 0,
      local_content_hash TEXT NOT NULL DEFAULT '',
      remote_content_hash TEXT NOT NULL DEFAULT '',
      resolved INTEGER NOT NULL DEFAULT 0,
      resolution TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sync_files_note_id ON sync_files(note_id);
    CREATE INDEX IF NOT EXISTS idx_sync_files_device_id ON sync_files(device_id);
    CREATE INDEX IF NOT EXISTS idx_sync_operations_note_id ON sync_operations(note_id);
    CREATE INDEX IF NOT EXISTS idx_sync_operations_file_id ON sync_operations(file_id);
    CREATE INDEX IF NOT EXISTS idx_sync_operations_applied ON sync_operations(applied);
    CREATE INDEX IF NOT EXISTS idx_sync_conflicts_file_id ON sync_conflicts(file_id);
    CREATE INDEX IF NOT EXISTS idx_sync_conflicts_resolved ON sync_conflicts(resolved);
  `);

  return syncDb;
}

export function registerSyncDbHandlers(): void {
  ipcMain.handle('sync-db-invoke', async (_event, operation: string, ...params: any[]) => {
    try {
      const db = ensureSyncDb();

      switch (operation) {
        // ============================================================
        // Sync Files
        // ============================================================
        case 'getFile': {
          const [fileId] = params as [string];
          const row = db.prepare('SELECT * FROM sync_files WHERE file_id = ?').get(fileId) as SyncFileRow | undefined;
          if (!row) return { success: true, data: null };
          return {
            success: true,
            data: {
              fileId: row.file_id,
              noteId: row.note_id,
              deviceId: row.device_id,
              version: row.version,
              contentHash: row.content_hash,
              mtime: row.mtime,
              deleted: !!row.deleted,
              fileType: row.file_type,
            },
          };
        }

        case 'getAllFiles': {
          const rows = db.prepare('SELECT * FROM sync_files').all() as SyncFileRow[];
          return {
            success: true,
            data: rows.map(row => ({
              fileId: row.file_id,
              noteId: row.note_id,
              deviceId: row.device_id,
              version: row.version,
              contentHash: row.content_hash,
              mtime: row.mtime,
              deleted: !!row.deleted,
              fileType: row.file_type,
            })),
          };
        }

        case 'putFile': {
          const [record] = params as [{
            fileId: string; noteId: string; deviceId: string; version: number;
            contentHash: string; mtime: number; deleted: boolean; fileType: string;
          }];
          db.prepare(`
            INSERT INTO sync_files (file_id, note_id, device_id, version, content_hash, mtime, deleted, file_type)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(file_id) DO UPDATE SET
              note_id = excluded.note_id,
              device_id = excluded.device_id,
              version = excluded.version,
              content_hash = excluded.content_hash,
              mtime = excluded.mtime,
              deleted = excluded.deleted,
              file_type = excluded.file_type
          `).run(record.fileId, record.noteId, record.deviceId, record.version, record.contentHash, record.mtime, record.deleted ? 1 : 0, record.fileType);
          return { success: true };
        }

        case 'deleteFile': {
          const [fileId] = params as [string];
          db.prepare('DELETE FROM sync_files WHERE file_id = ?').run(fileId);
          return { success: true };
        }

        case 'getFilesByNoteId': {
          const [noteId] = params as [string];
          const rows = db.prepare('SELECT * FROM sync_files WHERE note_id = ?').all(noteId) as SyncFileRow[];
          return {
            success: true,
            data: rows.map(row => ({
              fileId: row.file_id,
              noteId: row.note_id,
              deviceId: row.device_id,
              version: row.version,
              contentHash: row.content_hash,
              mtime: row.mtime,
              deleted: !!row.deleted,
              fileType: row.file_type,
            })),
          };
        }

        // ============================================================
        // Version Map (built from sync_files)
        // ============================================================
        case 'buildVersionMap': {
          const [deviceId] = params as [string];
          const rows = db.prepare('SELECT * FROM sync_files').all() as SyncFileRow[];
          const entries: Record<string, any> = {};
          for (const row of rows) {
            entries[row.file_id] = {
              fileId: row.file_id,
              noteId: row.note_id,
              deviceId: row.device_id,
              version: row.version,
              contentHash: row.content_hash,
              mtime: row.mtime,
              deleted: !!row.deleted,
            };
          }
          return {
            success: true,
            data: {
              entries,
              deviceId,
              timestamp: Date.now(),
            },
          };
        }

        // ============================================================
        // Sync Peers
        // ============================================================
        case 'getPeer': {
          const [deviceId] = params as [string];
          const row = db.prepare('SELECT * FROM sync_peers WHERE device_id = ?').get(deviceId) as SyncPeerRow | undefined;
          if (!row) return { success: true, data: null };
          return {
            success: true,
            data: {
              deviceId: row.device_id,
              deviceName: row.device_name,
              lastSeen: row.last_seen,
              lastVersionMap: row.last_version_map,
              address: row.address,
              transport: row.transport,
            },
          };
        }

        case 'getAllPeers': {
          const rows = db.prepare('SELECT * FROM sync_peers').all() as SyncPeerRow[];
          return {
            success: true,
            data: rows.map(row => ({
              deviceId: row.device_id,
              deviceName: row.device_name,
              lastSeen: row.last_seen,
              lastVersionMap: row.last_version_map,
              address: row.address,
              transport: row.transport,
            })),
          };
        }

        case 'putPeer': {
          const [record] = params as [{
            deviceId: string; deviceName: string; lastSeen: number;
            lastVersionMap: string; address: string; transport: string;
          }];
          db.prepare(`
            INSERT INTO sync_peers (device_id, device_name, last_seen, last_version_map, address, transport)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(device_id) DO UPDATE SET
              device_name = excluded.device_name,
              last_seen = excluded.last_seen,
              last_version_map = excluded.last_version_map,
              address = excluded.address,
              transport = excluded.transport
          `).run(record.deviceId, record.deviceName, record.lastSeen, record.lastVersionMap, record.address, record.transport);
          return { success: true };
        }

        case 'deletePeer': {
          const [deviceId] = params as [string];
          db.prepare('DELETE FROM sync_peers WHERE device_id = ?').run(deviceId);
          return { success: true };
        }

        // ============================================================
        // Sync Operations
        // ============================================================
        case 'getOperation': {
          const [opId] = params as [string];
          const row = db.prepare('SELECT * FROM sync_operations WHERE op_id = ?').get(opId) as SyncOpRow | undefined;
          if (!row) return { success: true, data: null };
          return {
            success: true,
            data: {
              opId: row.op_id,
              noteId: row.note_id,
              fileId: row.file_id,
              opType: row.op_type,
              oldPath: row.old_path || undefined,
              newPath: row.new_path || undefined,
              timestamp: row.timestamp,
              deviceId: row.device_id,
              applied: !!row.applied,
            },
          };
        }

        case 'getAllOperations': {
          const rows = db.prepare('SELECT * FROM sync_operations').all() as SyncOpRow[];
          return {
            success: true,
            data: rows.map(row => ({
              opId: row.op_id,
              noteId: row.note_id,
              fileId: row.file_id,
              opType: row.op_type,
              oldPath: row.old_path || undefined,
              newPath: row.new_path || undefined,
              timestamp: row.timestamp,
              deviceId: row.device_id,
              applied: !!row.applied,
            })),
          };
        }

        case 'putOperation': {
          const [record] = params as [{
            opId: string; noteId: string; fileId: string; opType: string;
            oldPath?: string; newPath?: string; timestamp: number; deviceId: string; applied: boolean;
          }];
          db.prepare(`
            INSERT INTO sync_operations (op_id, note_id, file_id, op_type, old_path, new_path, timestamp, device_id, applied)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(op_id) DO UPDATE SET
              note_id = excluded.note_id,
              file_id = excluded.file_id,
              op_type = excluded.op_type,
              old_path = excluded.old_path,
              new_path = excluded.new_path,
              timestamp = excluded.timestamp,
              device_id = excluded.device_id,
              applied = excluded.applied
          `).run(record.opId, record.noteId, record.fileId, record.opType, record.oldPath || null, record.newPath || null, record.timestamp, record.deviceId, record.applied ? 1 : 0);
          return { success: true };
        }

        case 'getUnappliedOperations': {
          const rows = db.prepare('SELECT * FROM sync_operations WHERE applied = 0').all() as SyncOpRow[];
          return {
            success: true,
            data: rows.map(row => ({
              opId: row.op_id,
              noteId: row.note_id,
              fileId: row.file_id,
              opType: row.op_type,
              oldPath: row.old_path || undefined,
              newPath: row.new_path || undefined,
              timestamp: row.timestamp,
              deviceId: row.device_id,
              applied: false,
            })),
          };
        }

        case 'markOperationApplied': {
          const [opId] = params as [string];
          db.prepare('UPDATE sync_operations SET applied = 1 WHERE op_id = ?').run(opId);
          return { success: true };
        }

        // ============================================================
        // Sync Conflicts
        // ============================================================
        case 'getConflict': {
          const [conflictId] = params as [string];
          const row = db.prepare('SELECT * FROM sync_conflicts WHERE conflict_id = ?').get(conflictId) as SyncConflictRow | undefined;
          if (!row) return { success: true, data: null };
          return {
            success: true,
            data: {
              conflictId: row.conflict_id,
              fileId: row.file_id,
              noteId: row.note_id,
              localVersion: row.local_version,
              remoteVersion: row.remote_version,
              localContentHash: row.local_content_hash,
              remoteContentHash: row.remote_content_hash,
              resolved: !!row.resolved,
              resolution: row.resolution || undefined,
              createdAt: row.created_at,
            },
          };
        }

        case 'getAllConflicts': {
          const rows = db.prepare('SELECT * FROM sync_conflicts').all() as SyncConflictRow[];
          return {
            success: true,
            data: rows.map(row => ({
              conflictId: row.conflict_id,
              fileId: row.file_id,
              noteId: row.note_id,
              localVersion: row.local_version,
              remoteVersion: row.remote_version,
              localContentHash: row.local_content_hash,
              remoteContentHash: row.remote_content_hash,
              resolved: !!row.resolved,
              resolution: row.resolution || undefined,
              createdAt: row.created_at,
            })),
          };
        }

        case 'getUnresolvedConflicts': {
          const rows = db.prepare('SELECT * FROM sync_conflicts WHERE resolved = 0').all() as SyncConflictRow[];
          return {
            success: true,
            data: rows.map(row => ({
              conflictId: row.conflict_id,
              fileId: row.file_id,
              noteId: row.note_id,
              localVersion: row.local_version,
              remoteVersion: row.remote_version,
              localContentHash: row.local_content_hash,
              remoteContentHash: row.remote_content_hash,
              resolved: false,
              resolution: row.resolution || undefined,
              createdAt: row.created_at,
            })),
          };
        }

        case 'putConflict': {
          const [record] = params as [{
            conflictId: string; fileId: string; noteId: string;
            localVersion: number; remoteVersion: number;
            localContentHash: string; remoteContentHash: string;
            resolved: boolean; resolution?: string; createdAt: number;
          }];
          db.prepare(`
            INSERT INTO sync_conflicts (conflict_id, file_id, note_id, local_version, remote_version, local_content_hash, remote_content_hash, resolved, resolution, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(conflict_id) DO UPDATE SET
              file_id = excluded.file_id,
              note_id = excluded.note_id,
              local_version = excluded.local_version,
              remote_version = excluded.remote_version,
              local_content_hash = excluded.local_content_hash,
              remote_content_hash = excluded.remote_content_hash,
              resolved = excluded.resolved,
              resolution = excluded.resolution,
              created_at = excluded.created_at
          `).run(
            record.conflictId, record.fileId, record.noteId,
            record.localVersion, record.remoteVersion,
            record.localContentHash, record.remoteContentHash,
            record.resolved ? 1 : 0, record.resolution || null, record.createdAt,
          );
          return { success: true };
        }

        case 'resolveConflict': {
          const [conflictId, resolution] = params as [string, string];
          db.prepare('UPDATE sync_conflicts SET resolved = 1, resolution = ? WHERE conflict_id = ?').run(resolution, conflictId);
          return { success: true };
        }

        // ============================================================
        // Cleanup
        // ============================================================
        case 'clearAll': {
          db.exec('DELETE FROM sync_files; DELETE FROM sync_peers; DELETE FROM sync_operations; DELETE FROM sync_conflicts;');
          return { success: true };
        }

        default:
          return { success: false, error: `Unknown sync-db operation: ${operation}` };
      }
    } catch (error) {
      console.error(`[SyncDB] Error in operation "${operation}":`, error);
      return { success: false, error: (error as Error).message };
    }
  });
}
