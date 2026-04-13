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
}
