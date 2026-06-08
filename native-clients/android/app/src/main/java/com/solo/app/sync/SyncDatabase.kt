package com.solo.app.sync

import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

/**
 * SyncDatabase — SQLite база данных для синхронизации на Android.
 *
 * Полный порт Electron SyncDatabase.ts на Kotlin.
 * Содержит CRUD для всех таблиц: sync_peers, sync_ledger, sync_queue,
 * tombstone, sync_conflicts, sync_settings.
 */
class SyncDatabase(context: Context) : SQLiteOpenHelper(
    context, DB_NAME, null, DB_VERSION
) {
    companion object {
        const val DB_NAME = "sync.db"
        const val DB_VERSION = 1
    }

    override fun onCreate(db: SQLiteDatabase) {
        createSchema(db)
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        // Миграции будут добавляться здесь
    }

    private fun createSchema(db: SQLiteDatabase) {
        db.execSQL("""
            CREATE TABLE IF NOT EXISTS schema_version (
                version INTEGER PRIMARY KEY,
                applied_at INTEGER NOT NULL
            );
        """)

        db.execSQL("""
            CREATE TABLE IF NOT EXISTS sync_peers (
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
        """)

        db.execSQL("""
            CREATE TABLE IF NOT EXISTS sync_ledger (
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
        """)

        db.execSQL("CREATE INDEX IF NOT EXISTS idx_ledger_file_id ON sync_ledger(file_id);")
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_ledger_modified_at ON sync_ledger(modified_at);")
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_ledger_synced ON sync_ledger(synced_at);")

        db.execSQL("""
            CREATE TABLE IF NOT EXISTS sync_queue (
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
        """)

        db.execSQL("CREATE INDEX IF NOT EXISTS idx_queue_status ON sync_queue(status);")
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_queue_created ON sync_queue(created_at);")

        db.execSQL("""
            CREATE TABLE IF NOT EXISTS tombstone (
                file_id TEXT PRIMARY KEY,
                deleted_at INTEGER NOT NULL,
                original_path TEXT NOT NULL,
                checksum TEXT,
                synced_to_peers INTEGER DEFAULT 0
            );
        """)

        db.execSQL("CREATE INDEX IF NOT EXISTS idx_tombstone_deleted_at ON tombstone(deleted_at);")

        db.execSQL("""
            CREATE TABLE IF NOT EXISTS sync_conflicts (
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
                created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
            );
        """)

        db.execSQL("CREATE INDEX IF NOT EXISTS idx_conflicts_resolution ON sync_conflicts(resolution);")
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_conflicts_file_id ON sync_conflicts(file_id);")

        db.execSQL("""
            CREATE TABLE IF NOT EXISTS sync_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            );
        """)

        // Версия схемы
        val cv = ContentValues()
        cv.put("version", 1)
        cv.put("applied_at", System.currentTimeMillis())
        db.insertWithOnConflict("schema_version", null, cv, SQLiteDatabase.CONFLICT_IGNORE)
    }

    // ==================== Sync Peers ====================

    /**
     * Вставляет или обновляет пира.
     */
    fun upsertPeer(peer: PeerData): Long {
        val db = writableDatabase
        val cv = ContentValues().apply {
            put("id", peer.id)
            put("name", peer.name)
            put("device_type", peer.deviceType)
            put("mac_address", peer.macAddress)
            put("last_seen_at", peer.lastSeenAt)
            put("first_seen_at", peer.firstSeenAt)
            put("trust_status", peer.trustStatus)
            put("public_key", peer.publicKey)
            put("protocol_version", peer.protocolVersion)
            put("is_paired", if (peer.isPaired) 1 else 0)
        }
        return db.insertWithOnConflict("sync_peers", null, cv, SQLiteDatabase.CONFLICT_REPLACE)
    }

    /**
     * Получает пира по ID.
     */
    fun getPeer(id: String): PeerData? {
        val db = readableDatabase
        val cursor = db.rawQuery("SELECT * FROM sync_peers WHERE id = ?", arrayOf(id))
        return cursor.use {
            if (it.moveToFirst()) readPeer(it) else null
        }
    }

    /**
     * Получает всех пиров.
     */
    fun getAllPeers(): List<PeerData> {
        val db = readableDatabase
        val cursor = db.rawQuery("SELECT * FROM sync_peers ORDER BY last_seen_at DESC", null)
        return cursor.use {
            val peers = mutableListOf<PeerData>()
            while (it.moveToNext()) {
                peers.add(readPeer(it))
            }
            peers
        }
    }

    /**
     * Получает доверенных пиров.
     */
    fun getTrustedPeers(): List<PeerData> {
        val db = readableDatabase
        val cursor = db.rawQuery(
            "SELECT * FROM sync_peers WHERE trust_status = 'trusted' ORDER BY last_seen_at DESC",
            null
        )
        return cursor.use {
            val peers = mutableListOf<PeerData>()
            while (it.moveToNext()) {
                peers.add(readPeer(it))
            }
            peers
        }
    }

    /**
     * Удаляет пира.
     */
    fun deletePeer(id: String): Int {
        val db = writableDatabase
        return db.delete("sync_peers", "id = ?", arrayOf(id))
    }

    // ==================== Sync Ledger ====================

    /**
     * Получает последнюю запись ledger для файла.
     */
    fun getLatestLedgerEntry(fileId: String): LedgerEntryData? {
        val db = readableDatabase
        val cursor = db.rawQuery(
            "SELECT * FROM sync_ledger WHERE file_id = ? ORDER BY version DESC LIMIT 1",
            arrayOf(fileId)
        )
        return cursor.use {
            if (it.moveToFirst()) readLedgerEntry(it) else null
        }
    }

    /**
     * Получает последнюю версию каждого файла.
     */
    fun getAllLatestLedgerEntries(): List<LedgerEntryData> {
        val db = readableDatabase
        val cursor = db.rawQuery("""
            SELECT l.* FROM sync_ledger l
            INNER JOIN (
                SELECT file_id, MAX(version) as max_version
                FROM sync_ledger
                GROUP BY file_id
            ) latest ON l.file_id = latest.file_id AND l.version = latest.max_version
            ORDER BY l.modified_at DESC
        """, null)
        return cursor.use {
            val entries = mutableListOf<LedgerEntryData>()
            while (it.moveToNext()) {
                entries.add(readLedgerEntry(it))
            }
            entries
        }
    }

    /**
     * Добавляет запись в ledger.
     */
    fun addLedgerEntry(entry: LedgerEntryInput): Long {
        val db = writableDatabase
        val cv = ContentValues().apply {
            put("file_id", entry.fileId)
            put("file_path", entry.filePath)
            put("version", entry.version)
            put("checksum", entry.checksum)
            put("size_bytes", entry.sizeBytes)
            put("modified_at", entry.modifiedAt)
            put("modified_by", entry.modifiedBy)
            put("operation", entry.operation)
            put("parent_version", entry.parentVersion)
        }
        return db.insert("sync_ledger", null, cv)
    }

    /**
     * Отмечает запись в ledger как синхронизированную.
     */
    fun markLedgerSynced(fileId: String, version: Int) {
        val db = writableDatabase
        val cv = ContentValues().apply {
            put("synced_at", System.currentTimeMillis())
        }
        db.update("sync_ledger", cv, "file_id = ? AND version = ?", arrayOf(fileId, version.toString()))
    }

    // ==================== Sync Queue ====================

    /**
     * Добавляет запись в очередь исходящих изменений.
     */
    fun addToQueue(entry: QueueEntryInput): Long {
        val db = writableDatabase
        val cv = ContentValues().apply {
            put("file_id", entry.fileId)
            put("file_path", entry.filePath)
            put("operation", entry.operation)
            put("local_version", entry.localVersion)
            put("checksum", entry.checksum)
            put("created_at", System.currentTimeMillis())
            put("status", "pending")
            put("target_peer_id", entry.targetPeerId)
        }
        return db.insert("sync_queue", null, cv)
    }

    /**
     * Получает ожидающие обработки записи из очереди.
     */
    fun getPendingQueueEntries(limit: Int = 50): List<QueueEntryData> {
        val db = readableDatabase
        val cursor = db.rawQuery(
            "SELECT * FROM sync_queue WHERE status IN ('pending', 'failed') ORDER BY created_at ASC LIMIT ?",
            arrayOf(limit.toString())
        )
        return cursor.use {
            val entries = mutableListOf<QueueEntryData>()
            while (it.moveToNext()) {
                entries.add(readQueueEntry(it))
            }
            entries
        }
    }

    /**
     * Обновляет статус записи в очереди.
     */
    fun updateQueueStatus(id: Long, status: String, error: String? = null) {
        val db = writableDatabase
        val cv = ContentValues().apply {
            put("status", status)
            put("last_error", error)
        }
        db.update("sync_queue", cv, "id = ?", arrayOf(id.toString()))
    }

    /**
     * Очищает выполненные записи из очереди.
     */
    fun clearCompletedQueue() {
        val db = writableDatabase
        db.delete("sync_queue", "status = 'done'", null)
    }

    // ==================== Tombstones ====================

    /**
     * Добавляет tombstone (запись об удалении файла).
     */
    fun addTombstone(fileId: String, originalPath: String, checksum: String? = null) {
        val db = writableDatabase
        val cv = ContentValues().apply {
            put("file_id", fileId)
            put("deleted_at", System.currentTimeMillis())
            put("original_path", originalPath)
            put("checksum", checksum)
        }
        db.insertWithOnConflict("tombstone", null, cv, SQLiteDatabase.CONFLICT_REPLACE)
    }

    /**
     * Получает tombstone по fileId.
     */
    fun getTombstone(fileId: String): TombstoneData? {
        val db = readableDatabase
        val cursor = db.rawQuery("SELECT * FROM tombstone WHERE file_id = ?", arrayOf(fileId))
        return cursor.use {
            if (it.moveToFirst()) readTombstone(it) else null
        }
    }

    /**
     * Получает все tombstones, которые ещё не были отправлены пирам.
     */
    fun getAllTombstones(): List<TombstoneData> {
        val db = readableDatabase
        val cursor = db.rawQuery(
            "SELECT * FROM tombstone WHERE synced_to_peers = 0 ORDER BY deleted_at DESC",
            null
        )
        return cursor.use {
            val tombstones = mutableListOf<TombstoneData>()
            while (it.moveToNext()) {
                tombstones.add(readTombstone(it))
            }
            tombstones
        }
    }

    /**
     * Отмечает tombstone как отправленный пирам.
     */
    fun markTombstoneSynced(fileId: String) {
        val db = writableDatabase
        val cv = ContentValues().apply {
            put("synced_to_peers", 1)
        }
        db.update("tombstone", cv, "file_id = ?", arrayOf(fileId))
    }

    /**
     * Удаляет старые tombstones (TTL по умолчанию 30 дней).
     */
    fun cleanupOldTombstones(ttlDays: Int = 30) {
        val cutoff = System.currentTimeMillis() - ttlDays * 24L * 60L * 60L * 1000L
        val db = writableDatabase
        db.delete("tombstone", "deleted_at < ?", arrayOf(cutoff.toString()))
    }

    // ==================== Conflicts ====================

    /**
     * Добавляет конфликт. Возвращает id созданной записи.
     */
    fun addConflict(conflict: ConflictInput): Long {
        val db = writableDatabase
        val cv = ContentValues().apply {
            put("file_id", conflict.fileId)
            put("file_path", conflict.filePath)
            put("local_version", conflict.localVersion)
            put("remote_version", conflict.remoteVersion)
            put("local_checksum", conflict.localChecksum)
            put("remote_checksum", conflict.remoteChecksum)
            put("local_modified_at", conflict.localModifiedAt)
            put("remote_modified_at", conflict.remoteModifiedAt)
            put("local_content", conflict.localContent)
            put("remote_content", conflict.remoteContent)
            put("resolution", "pending")
            put("created_at", System.currentTimeMillis())
        }
        return db.insert("sync_conflicts", null, cv)
    }

    /**
     * Получает конфликты. Можно отфильтровать по статусу resolution.
     */
    fun getConflicts(resolution: String? = null): List<ConflictData> {
        val db = readableDatabase
        val cursor = if (resolution != null) {
            db.rawQuery(
                "SELECT * FROM sync_conflicts WHERE resolution = ? ORDER BY created_at DESC",
                arrayOf(resolution)
            )
        } else {
            db.rawQuery("SELECT * FROM sync_conflicts ORDER BY created_at DESC", null)
        }
        return cursor.use {
            val conflicts = mutableListOf<ConflictData>()
            while (it.moveToNext()) {
                conflicts.add(readConflict(it))
            }
            conflicts
        }
    }

    /**
     * Разрешает конфликт (обновляет статус).
     */
    fun resolveConflict(id: Long, resolution: String, resolvedBy: String) {
        val db = writableDatabase
        val cv = ContentValues().apply {
            put("resolution", resolution)
            put("resolved_by", resolvedBy)
            put("resolved_at", System.currentTimeMillis())
        }
        db.update("sync_conflicts", cv, "id = ?", arrayOf(id.toString()))
    }

    // ==================== Settings ====================

    /**
     * Получает настройку по ключу.
     */
    fun getSetting(key: String): String? {
        val db = readableDatabase
        val cursor = db.rawQuery("SELECT value FROM sync_settings WHERE key = ?", arrayOf(key))
        return cursor.use {
            if (it.moveToFirst()) it.getString(0) else null
        }
    }

    /**
     * Устанавливает настройку.
     */
    fun setSetting(key: String, value: String) {
        val db = writableDatabase
        val cv = ContentValues().apply {
            put("key", key)
            put("value", value)
            put("updated_at", System.currentTimeMillis())
        }
        db.insertWithOnConflict("sync_settings", null, cv, SQLiteDatabase.CONFLICT_REPLACE)
    }

    /**
     * Получает все настройки.
     */
    fun getAllSettings(): Map<String, String> {
        val db = readableDatabase
        val cursor = db.rawQuery("SELECT key, value FROM sync_settings", null)
        return cursor.use {
            val settings = mutableMapOf<String, String>()
            while (it.moveToNext()) {
                settings[it.getString(0)] = it.getString(1)
            }
            settings
        }
    }

    /**
     * Получает время последней синхронизации.
     */
    fun getLastSyncTime(): Long? {
        val value = getSetting("last_sync_time")
        return value?.toLongOrNull()
    }

    /**
     * Обновляет время последней синхронизации.
     */
    fun updateLastSyncTime(timestamp: Long) {
        setSetting("last_sync_time", timestamp.toString())
    }

    // ==================== Статистика ====================

    /**
     * Возвращает статистику БД.
     */
    fun getStats(): DbStats {
        val db = readableDatabase
        val peersCount = getCount(db, "sync_peers")
        val ledgerEntries = getCount(db, "sync_ledger")
        val queuePending = getCountWhere(db, "sync_queue", "status IN ('pending', 'failed')")
        val conflictsPending = getCountWhere(db, "sync_conflicts", "resolution = 'pending'")
        val tombstonesCount = getCount(db, "tombstone")
        return DbStats(peersCount, ledgerEntries, queuePending, conflictsPending, tombstonesCount)
    }

    // ==================== Private Helpers ====================

    private fun getCount(db: SQLiteDatabase, table: String): Int {
        val cursor = db.rawQuery("SELECT COUNT(*) FROM $table", null)
        return cursor.use { if (it.moveToFirst()) it.getInt(0) else 0 }
    }

    private fun getCountWhere(db: SQLiteDatabase, table: String, where: String): Int {
        val cursor = db.rawQuery("SELECT COUNT(*) FROM $table WHERE $where", null)
        return cursor.use { if (it.moveToFirst()) it.getInt(0) else 0 }
    }

    private fun readPeer(c: Cursor): PeerData {
        return PeerData(
            id = c.getString(c.getColumnIndexOrThrow("id")),
            name = c.getString(c.getColumnIndexOrThrow("name")),
            deviceType = c.getString(c.getColumnIndexOrThrow("device_type")),
            macAddress = c.getString(c.getColumnIndexOrThrow("mac_address")),
            lastSeenAt = c.getLong(c.getColumnIndexOrThrow("last_seen_at")),
            firstSeenAt = c.getLong(c.getColumnIndexOrThrow("first_seen_at")),
            trustStatus = c.getString(c.getColumnIndexOrThrow("trust_status")),
            publicKey = c.getString(c.getColumnIndexOrThrow("public_key")),
            protocolVersion = c.getInt(c.getColumnIndexOrThrow("protocol_version")),
            isPaired = c.getInt(c.getColumnIndexOrThrow("is_paired")) == 1
        )
    }

    private fun readLedgerEntry(c: Cursor): LedgerEntryData {
        return LedgerEntryData(
            id = c.getLong(c.getColumnIndexOrThrow("id")),
            fileId = c.getString(c.getColumnIndexOrThrow("file_id")),
            filePath = c.getString(c.getColumnIndexOrThrow("file_path")),
            version = c.getInt(c.getColumnIndexOrThrow("version")),
            checksum = c.getString(c.getColumnIndexOrThrow("checksum")),
            sizeBytes = c.getInt(c.getColumnIndexOrThrow("size_bytes")),
            modifiedAt = c.getLong(c.getColumnIndexOrThrow("modified_at")),
            modifiedBy = c.getString(c.getColumnIndexOrThrow("modified_by")),
            operation = c.getString(c.getColumnIndexOrThrow("operation")),
            parentVersion = if (c.isNull(c.getColumnIndexOrThrow("parent_version"))) null else c.getInt(c.getColumnIndexOrThrow("parent_version")),
            syncedAt = if (c.isNull(c.getColumnIndexOrThrow("synced_at"))) null else c.getLong(c.getColumnIndexOrThrow("synced_at"))
        )
    }

    private fun readQueueEntry(c: Cursor): QueueEntryData {
        return QueueEntryData(
            id = c.getLong(c.getColumnIndexOrThrow("id")),
            fileId = c.getString(c.getColumnIndexOrThrow("file_id")),
            filePath = c.getString(c.getColumnIndexOrThrow("file_path")),
            operation = c.getString(c.getColumnIndexOrThrow("operation")),
            localVersion = c.getInt(c.getColumnIndexOrThrow("local_version")),
            checksum = c.getString(c.getColumnIndexOrThrow("checksum")),
            createdAt = c.getLong(c.getColumnIndexOrThrow("created_at")),
            status = c.getString(c.getColumnIndexOrThrow("status")),
            retryCount = c.getInt(c.getColumnIndexOrThrow("retry_count")),
            lastError = c.getString(c.getColumnIndexOrThrow("last_error")),
            targetPeerId = c.getString(c.getColumnIndexOrThrow("target_peer_id"))
        )
    }

    private fun readTombstone(c: Cursor): TombstoneData {
        return TombstoneData(
            fileId = c.getString(c.getColumnIndexOrThrow("file_id")),
            deletedAt = c.getLong(c.getColumnIndexOrThrow("deleted_at")),
            originalPath = c.getString(c.getColumnIndexOrThrow("original_path")),
            checksum = c.getString(c.getColumnIndexOrThrow("checksum")),
            syncedToPeers = c.getInt(c.getColumnIndexOrThrow("synced_to_peers"))
        )
    }

    private fun readConflict(c: Cursor): ConflictData {
        return ConflictData(
            id = c.getLong(c.getColumnIndexOrThrow("id")),
            fileId = c.getString(c.getColumnIndexOrThrow("file_id")),
            filePath = c.getString(c.getColumnIndexOrThrow("file_path")),
            localVersion = c.getInt(c.getColumnIndexOrThrow("local_version")),
            remoteVersion = c.getInt(c.getColumnIndexOrThrow("remote_version")),
            localChecksum = c.getString(c.getColumnIndexOrThrow("local_checksum")),
            remoteChecksum = c.getString(c.getColumnIndexOrThrow("remote_checksum")),
            localModifiedAt = c.getLong(c.getColumnIndexOrThrow("local_modified_at")),
            remoteModifiedAt = c.getLong(c.getColumnIndexOrThrow("remote_modified_at")),
            localContent = c.getString(c.getColumnIndexOrThrow("local_content")),
            remoteContent = c.getString(c.getColumnIndexOrThrow("remote_content")),
            resolution = c.getString(c.getColumnIndexOrThrow("resolution")),
            resolvedAt = if (c.isNull(c.getColumnIndexOrThrow("resolved_at"))) null else c.getLong(c.getColumnIndexOrThrow("resolved_at")),
            resolvedBy = c.getString(c.getColumnIndexOrThrow("resolved_by")),
            createdAt = c.getLong(c.getColumnIndexOrThrow("created_at"))
        )
    }
}

// ==================== Data Classes ====================

data class PeerData(
    val id: String,
    val name: String,
    val deviceType: String,
    val macAddress: String?,
    val lastSeenAt: Long,
    val firstSeenAt: Long,
    val trustStatus: String,
    val publicKey: String?,
    val protocolVersion: Int,
    val isPaired: Boolean
)

data class LedgerEntryData(
    val id: Long,
    val fileId: String,
    val filePath: String,
    val version: Int,
    val checksum: String,
    val sizeBytes: Int,
    val modifiedAt: Long,
    val modifiedBy: String?,
    val operation: String,
    val parentVersion: Int?,
    val syncedAt: Long?
)

data class LedgerEntryInput(
    val fileId: String,
    val filePath: String,
    val version: Int,
    val checksum: String,
    val sizeBytes: Int,
    val modifiedAt: Long,
    val modifiedBy: String?,
    val operation: String,
    val parentVersion: Int?
)

data class QueueEntryData(
    val id: Long,
    val fileId: String,
    val filePath: String,
    val operation: String,
    val localVersion: Int,
    val checksum: String?,
    val createdAt: Long,
    val status: String,
    val retryCount: Int,
    val lastError: String?,
    val targetPeerId: String?
)

data class QueueEntryInput(
    val fileId: String,
    val filePath: String,
    val operation: String,
    val localVersion: Int,
    val checksum: String?,
    val targetPeerId: String? = null
)

data class TombstoneData(
    val fileId: String,
    val deletedAt: Long,
    val originalPath: String,
    val checksum: String?,
    val syncedToPeers: Int
)

data class ConflictData(
    val id: Long,
    val fileId: String,
    val filePath: String?,
    val localVersion: Int,
    val remoteVersion: Int,
    val localChecksum: String?,
    val remoteChecksum: String?,
    val localModifiedAt: Long,
    val remoteModifiedAt: Long,
    val localContent: String?,
    val remoteContent: String?,
    val resolution: String,
    val resolvedAt: Long?,
    val resolvedBy: String?,
    val createdAt: Long
)

data class ConflictInput(
    val fileId: String,
    val filePath: String?,
    val localVersion: Int,
    val remoteVersion: Int,
    val localChecksum: String?,
    val remoteChecksum: String?,
    val localModifiedAt: Long,
    val remoteModifiedAt: Long,
    val localContent: String?,
    val remoteContent: String?
)

data class DbStats(
    val peersCount: Int,
    val ledgerEntries: Int,
    val queuePending: Int,
    val conflictsPending: Int,
    val tombstonesCount: Int
)
