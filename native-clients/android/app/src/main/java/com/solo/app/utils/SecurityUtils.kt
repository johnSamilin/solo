package com.solo.app.utils

import android.content.Context
import android.net.Uri
import android.os.Environment
import android.provider.DocumentsContract
import java.io.File

object SecurityUtils {

    fun validatePath(file: File, root: File) {
        val rootPath = root.canonicalPath
        val filePath = file.canonicalPath
        if (!filePath.startsWith(rootPath)) {
            throw SecurityException("Path traversal attempt detected")
        }
    }

    fun sanitizeFileName(name: String): String {
        return name
            .replace(Regex("[/\\\\:*?\"<>|]"), "_")
            .replace(Regex("\\.\\."), "_")
            .trim()
            .ifEmpty { "untitled" }
    }

    fun escapeJson(value: String): String {
        return value
            .replace("\\", "\\\\")
            .replace("\"", "\\\"")
            .replace("\n", "\\n")
            .replace("\r", "\\r")
            .replace("\t", "\\t")
    }

    fun escapeJsString(value: String): String {
        return value
            .replace("\\", "\\\\")
            .replace("'", "\\'")
            .replace("\n", "\\n")
            .replace("\r", "\\r")
    }

    fun toJsonString(value: String): String {
        val sb = StringBuilder("\"")
        for (ch in value) {
            when (ch) {
                '\\' -> sb.append("\\\\")
                '"' -> sb.append("\\\"")
                '\n' -> sb.append("\\n")
                '\r' -> sb.append("\\r")
                '\t' -> sb.append("\\t")
                '\b' -> sb.append("\\b")
                '\u000C' -> sb.append("\\f")
                else -> {
                    if (ch.code < 0x20) {
                        sb.append("\\u%04x".format(ch.code))
                    } else {
                        sb.append(ch)
                    }
                }
            }
        }
        sb.append("\"")
        return sb.toString()
    }

    fun getPathFromUri(context: Context, uri: Uri): String? {
        if (DocumentsContract.isTreeUri(uri)) {
            val docId = DocumentsContract.getTreeDocumentId(uri)

            if (docId.startsWith("primary:")) {
                val relativePath = docId.removePrefix("primary:")
                return "${Environment.getExternalStorageDirectory().absolutePath}/$relativePath"
            }

            val parts = docId.split(":")
            if (parts.size == 2) {
                val storageId = parts[0]
                val relativePath = parts[1]

                val storageDirs = context.getExternalFilesDirs(null)
                for (dir in storageDirs) {
                    if (dir != null) {
                        val storageRoot = dir.absolutePath.split("/Android/")[0]
                        if (storageRoot.contains(storageId)) {
                            return "$storageRoot/$relativePath"
                        }
                    }
                }

                return "/storage/$storageId/$relativePath"
            }
        }

        return uri.path
    }
}
