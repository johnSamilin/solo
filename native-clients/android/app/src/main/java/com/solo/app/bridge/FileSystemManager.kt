package com.solo.app.bridge

import android.content.Context
import android.content.SharedPreferences
import android.util.Base64
import com.solo.app.utils.SecurityUtils
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

data class CreateNoteResult(
    val id: String,
    val htmlPath: String
)

class FileSystemManager(
    private val context: Context,
    private val prefs: SharedPreferences
) {
    private var rootFolder: File? = null

    fun setRootFolder(path: String) {
        val folder = File(path)
        if (folder.exists() && folder.isDirectory) {
            rootFolder = folder
        }
    }

    fun getRootFolderPath(): String? = rootFolder?.absolutePath

    fun openFile(relativePath: String): String {
        val file = resolveAndValidate(relativePath)
        if (!file.exists()) throw IllegalArgumentException("File not found: $relativePath")
        return file.readText(Charsets.UTF_8)
    }

    fun updateFile(relativePath: String, content: String) {
        val file = resolveAndValidate(relativePath)
        file.parentFile?.mkdirs()
        file.writeText(content, Charsets.UTF_8)
    }

    fun updateMetadata(relativePath: String, metadataJson: String) {
        val htmlFile = resolveAndValidate(relativePath)
        val metadataFile = File(htmlFile.absolutePath.replace(".html", ".json"))
        metadataFile.parentFile?.mkdirs()
        metadataFile.writeText(metadataJson, Charsets.UTF_8)
    }

    fun readStructureJson(): String {
        val root = rootFolder ?: return "[]"
        if (!root.exists()) return "[]"

        val result = JSONArray()
        root.listFiles()
            ?.filter { !it.name.startsWith(".") }
            ?.sortedBy { it.name.lowercase() }
            ?.forEach { child ->
                val node = buildFileNode(child, "")
                if (node != null) result.put(node)
            }
        return result.toString()
    }

    private fun buildFileNode(file: File, parentRelativePath: String): JSONObject? {
        val relativePath = if (parentRelativePath.isEmpty()) file.name
        else "$parentRelativePath/${file.name}"

        if (file.isDirectory) {
            val node = JSONObject().apply {
                put("name", file.name)
                put("type", "folder")
                put("path", relativePath)
            }

            val children = JSONArray()
            file.listFiles()
                ?.filter { !it.name.startsWith(".") }
                ?.sortedWith(compareBy<File> { !it.isDirectory }.thenBy { it.name.lowercase() })
                ?.forEach { child ->
                    val childNode = buildFileNode(child, relativePath)
                    if (childNode != null) children.put(childNode)
                }

            node.put("children", children)
            return node
        }

        if (file.isFile && file.name.endsWith(".html")) {
            val node = JSONObject().apply {
                put("name", file.name)
                put("type", "file")
                put("path", relativePath)
            }

            val cssFile = File(file.absolutePath.replace(".html", ".css"))
            if (cssFile.exists()) {
                node.put("cssPath", relativePath.replace(".html", ".css"))
            }

            val metadataFile = File(file.absolutePath.replace(".html", ".json"))
            if (metadataFile.exists()) {
                try {
                    val metadataContent = metadataFile.readText(Charsets.UTF_8)
                    val metadata = JSONObject(metadataContent)
                    node.put("metadata", metadata)
                } catch (_: Exception) {
                }
            }

            return node
        }

        return null
    }

    fun scanAllTags(): List<String> {
        val root = rootFolder ?: return emptyList()
        val tags = mutableSetOf<String>()

        root.walk()
            .filter { it.isFile && it.name.endsWith(".json") && !it.name.startsWith(".") }
            .forEach { file ->
                try {
                    val content = file.readText(Charsets.UTF_8)
                    val json = JSONObject(content)

                    if (json.has("tags")) {
                        val tagsArray = json.getJSONArray("tags")
                        for (i in 0 until tagsArray.length()) {
                            val tag = tagsArray.getString(i).trim()
                            if (tag.isNotEmpty()) tags.add(tag)
                        }
                    }

                    if (json.has("paragraphTags")) {
                        val pTagsArray = json.getJSONArray("paragraphTags")
                        for (i in 0 until pTagsArray.length()) {
                            val tag = pTagsArray.getString(i).trim()
                            if (tag.isNotEmpty()) tags.add(tag)
                        }
                    }
                } catch (_: Exception) {
                }
            }

        return tags.sorted()
    }

    fun createNote(parentPath: String, name: String): CreateNoteResult {
        val root = rootFolder ?: throw IllegalStateException("Root folder not set")
        val parentDir = if (parentPath.isEmpty()) root else resolveAndValidate(parentPath)

        if (!parentDir.exists()) parentDir.mkdirs()

        val sanitizedName = SecurityUtils.sanitizeFileName(name)
        val htmlFile = File(parentDir, "$sanitizedName.html")
        val jsonFile = File(parentDir, "$sanitizedName.json")

        htmlFile.writeText("", Charsets.UTF_8)

        val metadata = JSONObject().apply {
            put("id", htmlFile.relativeTo(root).path)
            put("tags", JSONArray())
            put("createdAt", java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).format(java.util.Date()))
            put("paragraphTags", JSONArray())
        }
        jsonFile.writeText(metadata.toString(2), Charsets.UTF_8)

        val relativePath = htmlFile.relativeTo(root).path
        return CreateNoteResult(id = relativePath, htmlPath = relativePath)
    }

    fun createNotebook(parentPath: String, name: String): String {
        val root = rootFolder ?: throw IllegalStateException("Root folder not set")
        val parentDir = if (parentPath.isEmpty()) root else resolveAndValidate(parentPath)

        val sanitizedName = SecurityUtils.sanitizeFileName(name)
        val notebookDir = File(parentDir, sanitizedName)
        notebookDir.mkdirs()

        return notebookDir.relativeTo(root).path
    }

    fun deleteNote(relativePath: String) {
        val htmlFile = resolveAndValidate(relativePath)
        val jsonFile = File(htmlFile.absolutePath.replace(".html", ".json"))
        val cssFile = File(htmlFile.absolutePath.replace(".html", ".css"))

        htmlFile.delete()
        if (jsonFile.exists()) jsonFile.delete()
        if (cssFile.exists()) cssFile.delete()
    }

    fun deleteNotebook(relativePath: String) {
        val dir = resolveAndValidate(relativePath)
        if (dir.isDirectory) {
            dir.deleteRecursively()
        }
    }

    fun renameNote(relativePath: String, newName: String): String {
        val root = rootFolder ?: throw IllegalStateException("Root folder not set")
        val htmlFile = resolveAndValidate(relativePath)
        val parentDir = htmlFile.parentFile ?: throw IllegalStateException("Cannot determine parent directory")

        val sanitizedName = SecurityUtils.sanitizeFileName(newName)

        val newHtmlFile = File(parentDir, "$sanitizedName.html")
        val newJsonFile = File(parentDir, "$sanitizedName.json")
        val newCssFile = File(parentDir, "$sanitizedName.css")

        htmlFile.renameTo(newHtmlFile)

        val oldJsonFile = File(htmlFile.absolutePath.replace(".html", ".json"))
        if (oldJsonFile.exists()) oldJsonFile.renameTo(newJsonFile)

        val oldCssFile = File(htmlFile.absolutePath.replace(".html", ".css"))
        if (oldCssFile.exists()) oldCssFile.renameTo(newCssFile)

        return newHtmlFile.relativeTo(root).path
    }

    fun renameNotebook(relativePath: String, newName: String): String {
        val root = rootFolder ?: throw IllegalStateException("Root folder not set")
        val dir = resolveAndValidate(relativePath)
        val parentDir = dir.parentFile ?: throw IllegalStateException("Cannot determine parent directory")

        val sanitizedName = SecurityUtils.sanitizeFileName(newName)
        val newDir = File(parentDir, sanitizedName)
        dir.renameTo(newDir)

        return newDir.relativeTo(root).path
    }

    fun saveImage(base64Data: String, fileName: String): String {
        val root = rootFolder ?: throw IllegalStateException("Root folder not set")

        val actualData = if (base64Data.contains(",")) {
            base64Data.substringAfter(",")
        } else {
            base64Data
        }

        val bytes = Base64.decode(actualData, Base64.DEFAULT)

        val sanitizedName = SecurityUtils.sanitizeFileName(fileName)
        val imagesDir = File(root, "assets")
        imagesDir.mkdirs()

        val imageFile = File(imagesDir, sanitizedName)
        imageFile.writeBytes(bytes)

        return "assets/$sanitizedName"
    }

    private fun resolveAndValidate(relativePath: String): File {
        val root = rootFolder ?: throw IllegalStateException("Root folder not set")
        val file = File(root, relativePath)
        SecurityUtils.validatePath(file, root)
        return file
    }
}
