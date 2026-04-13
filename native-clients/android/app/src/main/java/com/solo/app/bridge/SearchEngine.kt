package com.solo.app.bridge

import com.solo.app.utils.SecurityUtils
import org.json.JSONArray
import org.json.JSONObject

class SearchEngine(private val fileSystemManager: FileSystemManager) {

    fun searchJson(query: String, tagsJson: String): String {
        val tags = try {
            val arr = JSONArray(tagsJson)
            (0 until arr.length()).map { arr.getString(it) }
        } catch (_: Exception) {
            emptyList()
        }

        val results = search(query.trim(), tags)
        val jsonArray = JSONArray()
        results.forEach { jsonArray.put(it) }

        return """{"success":true,"results":$jsonArray}"""
    }

    private fun search(query: String, tags: List<String>): List<JSONObject> {
        val rootPath = fileSystemManager.getRootFolderPath() ?: return emptyList()
        val root = java.io.File(rootPath)
        if (!root.exists()) return emptyList()

        val results = mutableListOf<JSONObject>()

        root.walk()
            .filter { it.isFile && it.name.endsWith(".html") && !it.name.startsWith(".") }
            .forEach { htmlFile ->
                val relativePath = htmlFile.relativeTo(root).path
                val title = htmlFile.nameWithoutExtension

                val jsonFile = java.io.File(htmlFile.absolutePath.replace(".html", ".json"))
                var noteTags = emptyList<String>()
                var paragraphTags = emptyList<String>()
                var createdAt = ""

                if (jsonFile.exists()) {
                    try {
                        val metadata = JSONObject(jsonFile.readText(Charsets.UTF_8))
                        if (metadata.has("tags")) {
                            val arr = metadata.getJSONArray("tags")
                            noteTags = (0 until arr.length()).map { arr.getString(it) }
                        }
                        if (metadata.has("paragraphTags")) {
                            val arr = metadata.getJSONArray("paragraphTags")
                            paragraphTags = (0 until arr.length()).map { arr.getString(it) }
                        }
                        if (metadata.has("createdAt")) {
                            createdAt = metadata.getString("createdAt")
                        }
                    } catch (_: Exception) {
                    }
                }

                val allTags = noteTags + paragraphTags
                val matchesTags = matchesTagFilters(allTags, tags)

                val hasQuery = query.isNotEmpty()
                val hasTags = tags.isNotEmpty()

                if (!hasQuery && !hasTags) return@forEach

                var matchesQuery = !hasQuery

                if (hasQuery) {
                    if (fuzzyMatch(title, query)) {
                        matchesQuery = true
                    } else {
                        try {
                            val content = htmlFile.readText(Charsets.UTF_8)
                            val textContent = stripHtml(content)
                            if (fuzzyMatch(textContent, query)) {
                                matchesQuery = true
                            }
                        } catch (_: Exception) {
                        }
                    }
                }

                if (matchesQuery && (!hasTags || matchesTags)) {
                    results.add(JSONObject().apply {
                        put("path", relativePath)
                        put("title", title)
                        put("createdAt", createdAt)
                        put("tags", JSONArray(noteTags))
                    })
                }
            }

        return results.sortedByDescending { it.optString("createdAt", "") }
    }

    private fun fuzzyMatch(text: String, query: String): Boolean {
        if (query.isEmpty()) return true
        val normalizedText = text.lowercase()
        val normalizedQuery = query.lowercase()

        var queryIndex = 0
        for (char in normalizedText) {
            if (char == normalizedQuery[queryIndex]) {
                queryIndex++
                if (queryIndex == normalizedQuery.length) return true
            }
        }
        return false
    }

    private fun matchesTagFilters(allTags: List<String>, filterTags: List<String>): Boolean {
        if (filterTags.isEmpty()) return true
        return filterTags.any { filter ->
            allTags.any { tag -> tag.contains(filter) }
        }
    }

    private fun stripHtml(html: String): String {
        return html.replace(Regex("<[^>]*>"), " ")
            .replace(Regex("&[a-zA-Z]+;"), " ")
            .replace(Regex("\\s+"), " ")
            .trim()
    }
}
