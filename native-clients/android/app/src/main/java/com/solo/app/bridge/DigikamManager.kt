package com.solo.app.bridge

import android.content.SharedPreferences
import android.database.sqlite.SQLiteDatabase
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

class DigikamManager(private val prefs: SharedPreferences) {
    fun setSoloRoot(root: File): String {
        val canonicalRoot = root.canonicalFile
        require(canonicalRoot.isDirectory && File(canonicalRoot, "digikam4.db").isFile) {
            "Select the photo folder containing digikam4.db"
        }
        prefs.edit().putString(SOLO_ROOT, canonicalRoot.path).apply()
        return File(canonicalRoot, "digikam4.db").path
    }

    fun setNineByFifteenRoot(root: File) {
        require(root.canonicalFile.isDirectory) { "9x15 photo folder is unavailable" }
        prefs.edit().putString(NINE_BY_FIFTEEN_ROOT, root.canonicalPath).apply()
    }

    fun tags(dbPath: String): JSONArray = openDatabase(dbPath) { db ->
        JSONArray().apply {
            db.rawQuery("SELECT id, pid, name FROM Tags WHERE id != 0 ORDER BY name", null).use { cursor ->
                while (cursor.moveToNext()) {
                    put(JSONObject().apply {
                        put("id", cursor.getInt(0))
                        put("parentId", if (cursor.isNull(1)) JSONObject.NULL else cursor.getInt(1))
                        put("name", cursor.getString(2))
                    })
                }
            }
        }
    }

    fun imagesByTag(dbPath: String, tagId: Int, limit: Int): JSONObject = openDatabase(dbPath) { db ->
        val tagName = db.rawQuery("SELECT name FROM Tags WHERE id = ?", arrayOf(tagId.toString())).use { cursor ->
            if (cursor.moveToFirst()) cursor.getString(0) else ""
        }
        val images = JSONArray()
        db.rawQuery(
            "SELECT DISTINCT i.id, i.name, a.relativePath FROM Images i " +
                "JOIN ImageTags t ON t.imageid = i.id JOIN Albums a ON a.id = i.album " +
                "WHERE t.tagid = ? ORDER BY i.modificationDate ASC LIMIT ?",
            arrayOf(tagId.toString(), limit.coerceIn(1, 100).toString()),
        ).use { cursor ->
            while (cursor.moveToNext()) {
                val relative = cursor.getString(2).trim('/')
                images.put(JSONObject().apply {
                    put("id", cursor.getInt(0))
                    put("name", cursor.getString(1))
                    put("relativePath", if (relative.isEmpty()) "" else "/$relative")
                    put("specificPath", "")
                })
            }
        }
        JSONObject().put("images", images).put("digikamTag", tagName)
    }

    fun imageFile(library: String, relativePath: String): File? {
        val key = when (library) {
            "solo" -> SOLO_ROOT
            "9x15" -> NINE_BY_FIFTEEN_ROOT
            else -> return null
        }
        val root = prefs.getString(key, null)?.let(::File)?.canonicalFile ?: return null
        if (!root.isDirectory || relativePath.isBlank() || relativePath.startsWith('/')) return null
        val file = File(root, relativePath).canonicalFile
        if (!file.path.startsWith(root.path + File.separator) || !file.isFile) return null
        if (file.extension.lowercase() !in IMAGE_EXTENSIONS) return null
        return file
    }

    /** Returns the root-relative path when `file` is an image under the connected digiKam photo folder. */
    fun classifySoloImage(file: File): String? {
        val root = prefs.getString(SOLO_ROOT, null)?.let(::File)?.canonicalFile ?: return null
        if (!root.isDirectory) return null
        val canonical = file.canonicalFile
        if (!canonical.isFile) return null
        if (!canonical.path.startsWith(root.path + File.separator)) return null
        if (canonical.extension.lowercase() !in IMAGE_EXTENSIONS) return null
        return canonical.relativeTo(root).invariantSeparatorsPath
    }

    private fun <T> openDatabase(dbPath: String, query: (SQLiteDatabase) -> T): T {
        val root = prefs.getString(SOLO_ROOT, null)?.let(::File)?.canonicalFile
            ?: error("Connect a digiKam photo folder first")
        val database = File(root, "digikam4.db").canonicalFile
        require(dbPath == database.path && database.isFile) { "Configured digiKam database is unavailable" }
        return SQLiteDatabase.openDatabase(database.path, null, SQLiteDatabase.OPEN_READONLY).use(query)
    }

    companion object {
        private const val SOLO_ROOT = "digikam_solo_root"
        private const val NINE_BY_FIFTEEN_ROOT = "digikam_9x15_root"
        private val IMAGE_EXTENSIONS = setOf("jpg", "jpeg", "png", "gif", "webp", "bmp", "avif", "heic", "heif")
    }
}
