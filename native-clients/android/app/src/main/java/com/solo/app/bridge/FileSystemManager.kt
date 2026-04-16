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
        
        // Check if it's a PDF file
        if (file.name.endsWith(".pdf")) {
            // Read PDF as binary data and convert to Base64
            val fileBytes = file.readBytes()
            val base64Content = Base64.encodeToString(fileBytes, Base64.NO_WRAP)
            return base64Content
        } else {
            // Handle as text file (HTML, JSON, etc.)
            return file.readText(Charsets.UTF_8)
        }
    }

    fun updateFile(relativePath: String, content: String) {
        val file = resolveAndValidate(relativePath)
        file.parentFile?.mkdirs()
        
        // Check if it's a PDF file
        if (file.name.endsWith(".pdf")) {
            // Decode base64 content and write as binary data
            val fileBytes = Base64.decode(content, Base64.NO_WRAP)
            file.writeBytes(fileBytes)
        } else {
            // Handle as text file (HTML, JSON, etc.)
            file.writeText(content, Charsets.UTF_8)
        }
    }

    fun updateMetadata(relativePath: String, metadataJson: String) {
        val noteFile = resolveAndValidate(relativePath)
        val jsonFileExtension = if (noteFile.name.endsWith(".pdf")) ".json" else ".html.json"
        val metadataFile = if (noteFile.name.endsWith(".pdf")) {
            File(noteFile.absolutePath.replace(".pdf", ".json"))
        } else {
            File(noteFile.absolutePath.replace(".html", ".json"))
        }
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

        if (file.isFile && (file.name.endsWith(".html") || file.name.endsWith(".pdf"))) {
            val node = JSONObject().apply {
                put("name", file.name)
                put("type", "file")
                put("path", relativePath)
            }
            
            // Handle CSS path only for HTML files
            if (file.name.endsWith(".html")) {
                val cssFile = File(file.absolutePath.replace(".html", ".css"))
                if (cssFile.exists()) {
                    node.put("cssPath", relativePath.replace(".html", ".css"))
                }
            }

            val metadataFile = if (file.name.endsWith(".html")) {
                File(file.absolutePath.replace(".html", ".json"))
            } else {
                File(file.absolutePath.replace(".pdf", ".json"))
            }
            
            if (metadataFile.exists()) {
                try {
                    val metadataContent = metadataFile.readText(Charsets.UTF_8)
                    val metadata = JSONObject(metadataContent)
                    node.put("metadata", metadata)
                    
                    // Add file type for both HTML and PDF files
                    val fileType = if (file.name.endsWith(".pdf")) "pdf" else "html"
                    node.put("fileType", fileType)
                } catch (_: Exception) {
                }
            } else {
                // Add file type for files without metadata
                val fileType = if (file.name.endsWith(".pdf")) "pdf" else "html"
                node.put("fileType", fileType)
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
        
        // Determine if this is a PDF file based on the name
        val isPdfFile = sanitizedName.lowercase().endsWith(".pdf")
        val fileName = if (isPdfFile) sanitizedName else "$sanitizedName.html"
        
        val noteFile = File(parentDir, fileName)
        val jsonFile = File(parentDir, if (isPdfFile) sanitizedName.replace(".pdf", ".json") else "$sanitizedName.json")

        // Initialize the file with appropriate content
        if (isPdfFile) {
            // For PDF files, we don't initialize with content since it will be loaded externally
            noteFile.writeBytes(ByteArray(0)) // Empty file
        } else {
            noteFile.writeText("", Charsets.UTF_8)
        }

        val metadata = JSONObject().apply {
            put("id", noteFile.relativeTo(root).path)
            put("tags", JSONArray())
            put("createdAt", java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).format(java.util.Date()))
            put("paragraphTags", JSONArray())
            if (isPdfFile) {
                put("fileType", "pdf")
            }
        }
        jsonFile.writeText(metadata.toString(2), Charsets.UTF_8)

        val relativePath = noteFile.relativeTo(root).path
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
        val noteFile = resolveAndValidate(relativePath)
        val jsonFile = if (noteFile.name.endsWith(".pdf")) {
            File(noteFile.absolutePath.replace(".pdf", ".json"))
        } else {
            File(noteFile.absolutePath.replace(".html", ".json"))
        }
        val cssFile = File(noteFile.absolutePath.replace(".html", ".css"))

        noteFile.delete()

        if (jsonFile.exists()) jsonFile.delete()
        if (cssFile.exists() && cssFile.name != noteFile.name.replace(".pdf", ".css")) cssFile.delete()
    }
    fun deleteNotebook(relativePath: String) {
        val dir = resolveAndValidate(relativePath)
        if (dir.isDirectory) {
            dir.deleteRecursively()
        }
    }

    fun renameNote(relativePath: String, newName: String): String {
        val root = rootFolder ?: throw IllegalStateException("Root folder not set")
        val noteFile = resolveAndValidate(relativePath)
        val parentDir = noteFile.parentFile ?: throw IllegalStateException("Cannot determine parent directory")

        val sanitizedName = SecurityUtils.sanitizeFileName(newName)
        
        // Determine if this is a PDF file
        val isPdfFile = noteFile.name.endsWith(".pdf")
        val newFileName = if (isPdfFile) sanitizedName else "$sanitizedName.html"
        
        val newNoteFile = File(parentDir, newFileName)
        val newJsonFile = File(parentDir, if (isPdfFile) sanitizedName.replace(".pdf", ".json") else "$sanitizedName.json")
        val newCssFile = File(parentDir, "$sanitizedName.css")

        noteFile.renameTo(newNoteFile)

        val oldJsonFile = if (isPdfFile) {
            File(noteFile.absolutePath.replace(".pdf", ".json"))
        } else {
            File(noteFile.absolutePath.replace(".html", ".json"))
        }
        if (oldJsonFile.exists()) oldJsonFile.renameTo(newJsonFile)

        val oldCssFile = File(noteFile.absolutePath.replace(".html", ".css"))
        if (oldCssFile.exists()) oldCssFile.renameTo(newCssFile)

        return newNoteFile.relativeTo(root).path
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
