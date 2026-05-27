package com.solo.app.bridge

import android.webkit.JavascriptInterface
import com.solo.app.MainActivity
import com.solo.app.utils.SecurityUtils

class WebViewBridge(
    private val activity: MainActivity,
    private val fileSystemManager: FileSystemManager,
    private val audioPlayer: AudioPlayer,
    private val searchEngine: SearchEngine
) {
    @JavascriptInterface
    fun selectFolder() {
        activity.runOnUiThread { activity.launchFolderPicker() }
    }

    @JavascriptInterface
    fun getDataFolder(): String {
        return try {
            val path = fileSystemManager.getRootFolderPath()
            if (path != null) {
                """{"success":true,"path":"${SecurityUtils.escapeJson(path)}"}"""
            } else {
                """{"success":true,"path":null}"""
            }
        } catch (e: Exception) {
            """{"success":false,"error":"${SecurityUtils.escapeJson(e.message ?: "Unknown error")}"}"""
        }
    }

    @JavascriptInterface
    fun openFile(relativePath: String): String {
        return try {
            val content = fileSystemManager.openFile(relativePath)
            """{"success":true,"content":${SecurityUtils.toJsonString(content)}}"""
        } catch (e: Exception) {
            """{"success":false,"error":"${SecurityUtils.escapeJson(e.message ?: "Unknown error")}"}"""
        }
    }

    @JavascriptInterface
    fun updateFile(relativePath: String, content: String): String {
        return try {
            fileSystemManager.updateFile(relativePath, content)
            """{"success":true}"""
        } catch (e: Exception) {
            """{"success":false,"error":"${SecurityUtils.escapeJson(e.message ?: "Unknown error")}"}"""
        }
    }

    @JavascriptInterface
    fun readStructure(): String {
        return try {
            val structureJson = fileSystemManager.readStructureJson()
            """{"success":true,"structure":$structureJson}"""
        } catch (e: Exception) {
            """{"success":false,"error":"${SecurityUtils.escapeJson(e.message ?: "Unknown error")}"}"""
        }
    }

    @JavascriptInterface
    fun updateMetadata(relativePath: String, metadataJson: String): String {
        return try {
            fileSystemManager.updateMetadata(relativePath, metadataJson)
            """{"success":true}"""
        } catch (e: Exception) {
            """{"success":false,"error":"${SecurityUtils.escapeJson(e.message ?: "Unknown error")}"}"""
        }
    }

    @JavascriptInterface
    fun scanAllTags(): String {
        return try {
            val tags = fileSystemManager.scanAllTags()
            val tagsJson = tags.joinToString(",") { "\"${SecurityUtils.escapeJson(it)}\"" }
            """{"success":true,"tags":[$tagsJson]}"""
        } catch (e: Exception) {
            """{"success":false,"error":"${SecurityUtils.escapeJson(e.message ?: "Unknown error")}"}"""
        }
    }

    @JavascriptInterface
    fun createNote(parentPath: String, name: String): String {
        return try {
            val result = fileSystemManager.createNote(parentPath, name)
            """{"success":true,"id":"${SecurityUtils.escapeJson(result.id)}","htmlPath":"${SecurityUtils.escapeJson(result.htmlPath)}"}"""
        } catch (e: Exception) {
            """{"success":false,"error":"${SecurityUtils.escapeJson(e.message ?: "Unknown error")}"}"""
        }
    }

    @JavascriptInterface
    fun createNotebook(parentPath: String, name: String): String {
        return try {
            val path = fileSystemManager.createNotebook(parentPath, name)
            """{"success":true,"path":"${SecurityUtils.escapeJson(path)}"}"""
        } catch (e: Exception) {
            """{"success":false,"error":"${SecurityUtils.escapeJson(e.message ?: "Unknown error")}"}"""
        }
    }

    @JavascriptInterface
    fun deleteNote(relativePath: String): String {
        return try {
            fileSystemManager.deleteNote(relativePath)
            """{"success":true}"""
        } catch (e: Exception) {
            """{"success":false,"error":"${SecurityUtils.escapeJson(e.message ?: "Unknown error")}"}"""
        }
    }

    @JavascriptInterface
    fun deleteNotebook(relativePath: String): String {
        return try {
            fileSystemManager.deleteNotebook(relativePath)
            """{"success":true}"""
        } catch (e: Exception) {
            """{"success":false,"error":"${SecurityUtils.escapeJson(e.message ?: "Unknown error")}"}"""
        }
    }

    @JavascriptInterface
    fun renameNote(relativePath: String, newName: String): String {
        return try {
            val newPath = fileSystemManager.renameNote(relativePath, newName)
            """{"success":true,"newPath":"${SecurityUtils.escapeJson(newPath)}"}"""
        } catch (e: Exception) {
            """{"success":false,"error":"${SecurityUtils.escapeJson(e.message ?: "Unknown error")}"}"""
        }
    }

    @JavascriptInterface
    fun renameNotebook(relativePath: String, newName: String): String {
        return try {
            val newPath = fileSystemManager.renameNotebook(relativePath, newName)
            """{"success":true,"newPath":"${SecurityUtils.escapeJson(newPath)}"}"""
        } catch (e: Exception) {
            """{"success":false,"error":"${SecurityUtils.escapeJson(e.message ?: "Unknown error")}"}"""
        }
    }

    @JavascriptInterface
    fun uploadImage(base64Data: String, fileName: String): String {
        return try {
            val url = fileSystemManager.saveImage(base64Data, fileName)
            """{"success":true,"url":"${SecurityUtils.escapeJson(url)}"}"""
        } catch (e: Exception) {
            """{"success":false,"error":"${SecurityUtils.escapeJson(e.message ?: "Unknown error")}"}"""
        }
    }

    @JavascriptInterface
    fun playTypewriterSound() {
        audioPlayer.play()
    }

    @JavascriptInterface
    fun search(query: String, tagsJson: String): String {
        return try {
            searchEngine.searchJson(query, tagsJson)
        } catch (e: Exception) {
            """{"success":false,"error":"${SecurityUtils.escapeJson(e.message ?: "Unknown error")}"}"""
        }
    }

    @JavascriptInterface
    fun toggleZenMode(enable: Boolean): String {
        activity.toggleZenMode(enable)
        return """{"success":true,"isZenMode":$enable}"""
    }
    
    @JavascriptInterface
    fun openPdfFile(relativePath: String): String {
        return try {
            val content = fileSystemManager.openFile(relativePath)
            """{"success":true,"data":"${SecurityUtils.escapeJson(content)}"}"""
        } catch (e: Exception) {
            """{"success":false,"error":"${SecurityUtils.escapeJson(e.message ?: "Unknown error")}"}"""
        }
    }

    // ============================================================
    // Sync State Database (SQLite)
    // ============================================================

    private var syncDb: android.database.sqlite.SQLiteDatabase? = null

    private fun ensureSyncDb(): android.database.sqlite.SQLiteDatabase {
        syncDb?.let { return it }

        val dbPath = activity.getDatabasePath("sync.db").absolutePath
        // Ensure parent directory exists
        activity.getDatabasePath("sync.db").parentFile?.mkdirs()

        val db = android.database.sqlite.SQLiteDatabase.openOrCreateDatabase(dbPath, null)

        db.execSQL("""
            CREATE TABLE IF NOT EXISTS sync_files (
                file_id TEXT PRIMARY KEY,
                note_id TEXT NOT NULL DEFAULT '',
                device_id TEXT NOT NULL,
                version INTEGER NOT NULL DEFAULT 1,
                content_hash TEXT NOT NULL DEFAULT '',
                mtime INTEGER NOT NULL,
                deleted INTEGER NOT NULL DEFAULT 0,
                file_type TEXT NOT NULL DEFAULT 'html'
            )
        """)
        db.execSQL("""
            CREATE TABLE IF NOT EXISTS sync_peers (
                device_id TEXT PRIMARY KEY,
                device_name TEXT NOT NULL DEFAULT '',
                last_seen INTEGER NOT NULL DEFAULT 0,
                last_version_map TEXT NOT NULL DEFAULT '{}',
                address TEXT NOT NULL DEFAULT '',
                transport TEXT NOT NULL DEFAULT 'wifi'
            )
        """)
        db.execSQL("""
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
            )
        """)
        db.execSQL("""
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
            )
        """)
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_sync_files_note_id ON sync_files(note_id)")
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_sync_files_device_id ON sync_files(device_id)")
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_sync_operations_note_id ON sync_operations(note_id)")
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_sync_operations_file_id ON sync_operations(file_id)")
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_sync_operations_applied ON sync_operations(applied)")
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_sync_conflicts_file_id ON sync_conflicts(file_id)")
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_sync_conflicts_resolved ON sync_conflicts(resolved)")

        syncDb = db
        return db
    }

    /** Преобразует Cursor из sync_files в JSON-объект */
    private fun cursorToFileRow(c: android.database.Cursor): String {
        return """{"fileId":"${SecurityUtils.escapeJson(c.getString(c.getColumnIndexOrThrow("file_id")))}","noteId":"${SecurityUtils.escapeJson(c.getString(c.getColumnIndexOrThrow("note_id")))}","deviceId":"${SecurityUtils.escapeJson(c.getString(c.getColumnIndexOrThrow("device_id")))}","version":${c.getInt(c.getColumnIndexOrThrow("version"))},"contentHash":"${SecurityUtils.escapeJson(c.getString(c.getColumnIndexOrThrow("content_hash")))}","mtime":${c.getLong(c.getColumnIndexOrThrow("mtime"))},"deleted":${c.getInt(c.getColumnIndexOrThrow("deleted")) == 1},"fileType":"${SecurityUtils.escapeJson(c.getString(c.getColumnIndexOrThrow("file_type")))}"}"""
    }

    /** Преобразует Cursor из sync_peers в JSON-объект */
    private fun cursorToPeerRow(c: android.database.Cursor): String {
        return """{"deviceId":"${SecurityUtils.escapeJson(c.getString(c.getColumnIndexOrThrow("device_id")))}","deviceName":"${SecurityUtils.escapeJson(c.getString(c.getColumnIndexOrThrow("device_name")))}","lastSeen":${c.getLong(c.getColumnIndexOrThrow("last_seen"))},"lastVersionMap":"${SecurityUtils.escapeJson(c.getString(c.getColumnIndexOrThrow("last_version_map")))}","address":"${SecurityUtils.escapeJson(c.getString(c.getColumnIndexOrThrow("address")))}","transport":"${SecurityUtils.escapeJson(c.getString(c.getColumnIndexOrThrow("transport")))}"}"""
    }

    /** Преобразует Cursor из sync_operations в JSON-объект */
    private fun cursorToOpRow(c: android.database.Cursor): String {
        val oldPath = c.getString(c.getColumnIndexOrThrow("old_path"))
        val newPath = c.getString(c.getColumnIndexOrThrow("new_path"))
        return """{"opId":"${SecurityUtils.escapeJson(c.getString(c.getColumnIndexOrThrow("op_id")))}","noteId":"${SecurityUtils.escapeJson(c.getString(c.getColumnIndexOrThrow("note_id")))}","fileId":"${SecurityUtils.escapeJson(c.getString(c.getColumnIndexOrThrow("file_id")))}","opType":"${SecurityUtils.escapeJson(c.getString(c.getColumnIndexOrThrow("op_type")))}","oldPath":${if (oldPath != null) "\"${SecurityUtils.escapeJson(oldPath)}\"" else "null"},"newPath":${if (newPath != null) "\"${SecurityUtils.escapeJson(newPath)}\"" else "null"},"timestamp":${c.getLong(c.getColumnIndexOrThrow("timestamp"))},"deviceId":"${SecurityUtils.escapeJson(c.getString(c.getColumnIndexOrThrow("device_id")))}","applied":${c.getInt(c.getColumnIndexOrThrow("applied")) == 1}}"""
    }

    /** Преобразует Cursor из sync_conflicts в JSON-объект */
    private fun cursorToConflictRow(c: android.database.Cursor): String {
        val resolution = c.getString(c.getColumnIndexOrThrow("resolution"))
        return """{"conflictId":"${SecurityUtils.escapeJson(c.getString(c.getColumnIndexOrThrow("conflict_id")))}","fileId":"${SecurityUtils.escapeJson(c.getString(c.getColumnIndexOrThrow("file_id")))}","noteId":"${SecurityUtils.escapeJson(c.getString(c.getColumnIndexOrThrow("note_id")))}","localVersion":${c.getInt(c.getColumnIndexOrThrow("local_version"))},"remoteVersion":${c.getInt(c.getColumnIndexOrThrow("remote_version"))},"localContentHash":"${SecurityUtils.escapeJson(c.getString(c.getColumnIndexOrThrow("local_content_hash")))}","remoteContentHash":"${SecurityUtils.escapeJson(c.getString(c.getColumnIndexOrThrow("remote_content_hash")))}","resolved":${c.getInt(c.getColumnIndexOrThrow("resolved")) == 1},"resolution":${if (resolution != null) "\"${SecurityUtils.escapeJson(resolution)}\"" else "null"},"createdAt":${c.getLong(c.getColumnIndexOrThrow("created_at"))}}"""
    }

    @JavascriptInterface
    fun syncDBInvoke(operation: String, paramsJson: String): String {
        return try {
            val db = ensureSyncDb()
            val args = org.json.JSONArray(paramsJson)

            when (operation) {
                // ============================================================
                // Sync Files
                // ============================================================
                "getFile" -> {
                    val fileId = args.getString(0)
                    val c = db.rawQuery("SELECT * FROM sync_files WHERE file_id = ?", arrayOf(fileId))
                    val result = if (c.moveToFirst()) cursorToFileRow(c) else "null"
                    c.close()
                    """{"success":true,"data":$result}"""
                }

                "getAllFiles" -> {
                    val c = db.rawQuery("SELECT * FROM sync_files", null)
                    val rows = mutableListOf<String>()
                    while (c.moveToNext()) rows.add(cursorToFileRow(c))
                    c.close()
                    """{"success":true,"data":[${rows.joinToString(",")}]}"""
                }

                "putFile" -> {
                    val obj = org.json.JSONObject(args.getString(0))
                    db.execSQL("""
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
                    """, arrayOf(
                        obj.getString("fileId"),
                        obj.getString("noteId"),
                        obj.getString("deviceId"),
                        obj.getInt("version"),
                        obj.getString("contentHash"),
                        obj.getLong("mtime"),
                        if (obj.getBoolean("deleted")) 1 else 0,
                        obj.getString("fileType"),
                    ))
                    """{"success":true}"""
                }

                "deleteFile" -> {
                    db.execSQL("DELETE FROM sync_files WHERE file_id = ?", arrayOf(args.getString(0)))
                    """{"success":true}"""
                }

                "getFilesByNoteId" -> {
                    val c = db.rawQuery("SELECT * FROM sync_files WHERE note_id = ?", arrayOf(args.getString(0)))
                    val rows = mutableListOf<String>()
                    while (c.moveToNext()) rows.add(cursorToFileRow(c))
                    c.close()
                    """{"success":true,"data":[${rows.joinToString(",")}]}"""
                }

                // ============================================================
                // Version Map
                // ============================================================
                "buildVersionMap" -> {
                    val deviceId = args.getString(0)
                    val c = db.rawQuery("SELECT * FROM sync_files", null)
                    val entries = mutableListOf<String>()
                    while (c.moveToNext()) {
                        entries.add(""""${SecurityUtils.escapeJson(c.getString(c.getColumnIndexOrThrow("file_id")))}":{"fileId":"${SecurityUtils.escapeJson(c.getString(c.getColumnIndexOrThrow("file_id")))}","noteId":"${SecurityUtils.escapeJson(c.getString(c.getColumnIndexOrThrow("note_id")))}","deviceId":"${SecurityUtils.escapeJson(c.getString(c.getColumnIndexOrThrow("device_id")))}","version":${c.getInt(c.getColumnIndexOrThrow("version"))},"contentHash":"${SecurityUtils.escapeJson(c.getString(c.getColumnIndexOrThrow("content_hash")))}","mtime":${c.getLong(c.getColumnIndexOrThrow("mtime"))},"deleted":${c.getInt(c.getColumnIndexOrThrow("deleted")) == 1}}""")
                    }
                    c.close()
                    """{"success":true,"data":{"entries":{${entries.joinToString(",")}},"deviceId":"${SecurityUtils.escapeJson(deviceId)}","timestamp":${System.currentTimeMillis()}}}"""
                }

                // ============================================================
                // Sync Peers
                // ============================================================
                "getPeer" -> {
                    val c = db.rawQuery("SELECT * FROM sync_peers WHERE device_id = ?", arrayOf(args.getString(0)))
                    val result = if (c.moveToFirst()) cursorToPeerRow(c) else "null"
                    c.close()
                    """{"success":true,"data":$result}"""
                }

                "getAllPeers" -> {
                    val c = db.rawQuery("SELECT * FROM sync_peers", null)
                    val rows = mutableListOf<String>()
                    while (c.moveToNext()) rows.add(cursorToPeerRow(c))
                    c.close()
                    """{"success":true,"data":[${rows.joinToString(",")}]}"""
                }

                "putPeer" -> {
                    val obj = org.json.JSONObject(args.getString(0))
                    db.execSQL("""
                        INSERT INTO sync_peers (device_id, device_name, last_seen, last_version_map, address, transport)
                        VALUES (?, ?, ?, ?, ?, ?)
                        ON CONFLICT(device_id) DO UPDATE SET
                            device_name = excluded.device_name,
                            last_seen = excluded.last_seen,
                            last_version_map = excluded.last_version_map,
                            address = excluded.address,
                            transport = excluded.transport
                    """, arrayOf(
                        obj.getString("deviceId"),
                        obj.getString("deviceName"),
                        obj.getLong("lastSeen"),
                        obj.getString("lastVersionMap"),
                        obj.getString("address"),
                        obj.getString("transport"),
                    ))
                    """{"success":true}"""
                }

                "deletePeer" -> {
                    db.execSQL("DELETE FROM sync_peers WHERE device_id = ?", arrayOf(args.getString(0)))
                    """{"success":true}"""
                }

                // ============================================================
                // Sync Operations
                // ============================================================
                "getOperation" -> {
                    val c = db.rawQuery("SELECT * FROM sync_operations WHERE op_id = ?", arrayOf(args.getString(0)))
                    val result = if (c.moveToFirst()) cursorToOpRow(c) else "null"
                    c.close()
                    """{"success":true,"data":$result}"""
                }

                "getAllOperations" -> {
                    val c = db.rawQuery("SELECT * FROM sync_operations", null)
                    val rows = mutableListOf<String>()
                    while (c.moveToNext()) rows.add(cursorToOpRow(c))
                    c.close()
                    """{"success":true,"data":[${rows.joinToString(",")}]}"""
                }

                "putOperation" -> {
                    val obj = org.json.JSONObject(args.getString(0))
                    db.execSQL("""
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
                    """, arrayOf(
                        obj.getString("opId"),
                        obj.getString("noteId"),
                        obj.getString("fileId"),
                        obj.getString("opType"),
                        obj.optString("oldPath", null),
                        obj.optString("newPath", null),
                        obj.getLong("timestamp"),
                        obj.getString("deviceId"),
                        if (obj.getBoolean("applied")) 1 else 0,
                    ))
                    """{"success":true}"""
                }

                "getUnappliedOperations" -> {
                    val c = db.rawQuery("SELECT * FROM sync_operations WHERE applied = 0", null)
                    val rows = mutableListOf<String>()
                    while (c.moveToNext()) rows.add(cursorToOpRow(c))
                    c.close()
                    """{"success":true,"data":[${rows.joinToString(",")}]}"""
                }

                "markOperationApplied" -> {
                    db.execSQL("UPDATE sync_operations SET applied = 1 WHERE op_id = ?", arrayOf(args.getString(0)))
                    """{"success":true}"""
                }

                // ============================================================
                // Sync Conflicts
                // ============================================================
                "getConflict" -> {
                    val c = db.rawQuery("SELECT * FROM sync_conflicts WHERE conflict_id = ?", arrayOf(args.getString(0)))
                    val result = if (c.moveToFirst()) cursorToConflictRow(c) else "null"
                    c.close()
                    """{"success":true,"data":$result}"""
                }

                "getAllConflicts" -> {
                    val c = db.rawQuery("SELECT * FROM sync_conflicts", null)
                    val rows = mutableListOf<String>()
                    while (c.moveToNext()) rows.add(cursorToConflictRow(c))
                    c.close()
                    """{"success":true,"data":[${rows.joinToString(",")}]}"""
                }

                "getUnresolvedConflicts" -> {
                    val c = db.rawQuery("SELECT * FROM sync_conflicts WHERE resolved = 0", null)
                    val rows = mutableListOf<String>()
                    while (c.moveToNext()) rows.add(cursorToConflictRow(c))
                    c.close()
                    """{"success":true,"data":[${rows.joinToString(",")}]}"""
                }

                "putConflict" -> {
                    val obj = org.json.JSONObject(args.getString(0))
                    db.execSQL("""
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
                    """, arrayOf(
                        obj.getString("conflictId"),
                        obj.getString("fileId"),
                        obj.getString("noteId"),
                        obj.getInt("localVersion"),
                        obj.getInt("remoteVersion"),
                        obj.getString("localContentHash"),
                        obj.getString("remoteContentHash"),
                        if (obj.getBoolean("resolved")) 1 else 0,
                        obj.optString("resolution", null),
                        obj.getLong("createdAt"),
                    ))
                    """{"success":true}"""
                }

                "resolveConflict" -> {
                    db.execSQL("UPDATE sync_conflicts SET resolved = 1, resolution = ? WHERE conflict_id = ?", arrayOf(args.getString(1), args.getString(0)))
                    """{"success":true}"""
                }

                // ============================================================
                // Cleanup
                // ============================================================
                "clearAll" -> {
                    db.execSQL("DELETE FROM sync_files")
                    db.execSQL("DELETE FROM sync_peers")
                    db.execSQL("DELETE FROM sync_operations")
                    db.execSQL("DELETE FROM sync_conflicts")
                    """{"success":true}"""
                }

                else -> """{"success":false,"error":"Unknown sync-db operation: ${SecurityUtils.escapeJson(operation)}"}"""
            }
        } catch (e: Exception) {
            """{"success":false,"error":"${SecurityUtils.escapeJson(e.message ?: "Unknown error in syncDBInvoke")}"}"""
        }
    }
}
