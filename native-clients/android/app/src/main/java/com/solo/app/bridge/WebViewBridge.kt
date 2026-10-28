package com.solo.app.bridge

import android.webkit.JavascriptInterface
import com.solo.app.MainActivity
import com.solo.app.utils.SecurityUtils
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL

class WebViewBridge(
    private val activity: MainActivity,
    private val fileSystemManager: FileSystemManager,
    private val audioPlayer: AudioPlayer,
    private val audioRecorder: AudioRecorder,
    private val transcriptionManager: TranscriptionManager,
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
    fun uploadAudio(base64Data: String, fileName: String): String {
        return try {
            val url = fileSystemManager.saveAudio(base64Data, fileName)
            """{"success":true,"url":"${SecurityUtils.escapeJson(url)}"}"""
        } catch (e: Exception) {
            """{"success":false,"error":"${SecurityUtils.escapeJson(e.message ?: "Unknown error")}"}"""
        }
    }

    @JavascriptInterface
    fun deleteAsset(url: String): String {
        return try {
            val ok = fileSystemManager.deleteAsset(url)
            """{"success":$ok}"""
        } catch (e: Exception) {
            """{"success":false,"error":"${SecurityUtils.escapeJson(e.message ?: "Unknown error")}"}"""
        }
    }

    @JavascriptInterface
    fun transcribeAudio(fileName: String): String {
        return try {
            val pcm = fileSystemManager.readVoicePcm(fileName)
                ?: return """{"success":false,"error":"Voice memo not found"}"""
            val result = transcriptionManager.transcribe(pcm.samples, pcm.sampleRate.toFloat())
            if (result.text.isEmpty()) {
                """{"success":false,"error":"Transcription returned no text"}"""
            } else {
                val wordsJson = result.words.joinToString(",") { w ->
                    """{"word":"${SecurityUtils.escapeJson(w.word)}","start":${w.start},"end":${w.end}}"""
                }
                val prosodyJson = result.prosody.joinToString(",") { p ->
                    """{"f0":${p.f0},"energy":${p.energy}}"""
                }
                """{"success":true,"text":"${SecurityUtils.escapeJson(result.text)}","words":[$wordsJson],"prosody":[$prosodyJson]}"""
            }
        } catch (e: Exception) {
            """{"success":false,"error":"${SecurityUtils.escapeJson(e.message ?: "Transcription failed")}"}"""
        }
    }

    @JavascriptInterface
    fun startRecording(): String {
        return try {
            if (!activity.hasRecordAudioPermission()) {
                """{"success":false,"error":"Microphone permission not granted"}"""
            } else if (audioRecorder.start()) {
                """{"success":true}"""
            } else {
                """{"success":false,"error":"Failed to start recording"}"""
            }
        } catch (e: Exception) {
            """{"success":false,"error":"${SecurityUtils.escapeJson(e.message ?: "Unknown error")}"}"""
        }
    }

    @JavascriptInterface
    fun stopRecording(): String {
        return try {
            val pcm = audioRecorder.stop()
            if (pcm == null || pcm.isEmpty()) {
                """{"success":false,"error":"Nothing was recorded"}"""
            } else {
                val fileName = makeMemoFileName()
                val url = fileSystemManager.saveRecording(pcm, AudioRecorder.SAMPLE_RATE, fileName)
                val duration = (pcm.size / 2L) * 1000L / AudioRecorder.SAMPLE_RATE
                """{"success":true,"url":"${SecurityUtils.escapeJson(url)}","duration":$duration}"""
            }
        } catch (e: Exception) {
            """{"success":false,"error":"${SecurityUtils.escapeJson(e.message ?: "Unknown error")}"}"""
        }
    }

    @JavascriptInterface
    fun pauseRecording(): String {
        return try {
            if (audioRecorder.pause()) """{"success":true}"""
            else """{"success":false,"error":"Not recording"}"""
        } catch (e: Exception) {
            """{"success":false,"error":"${SecurityUtils.escapeJson(e.message ?: "Unknown error")}"}"""
        }
    }

    @JavascriptInterface
    fun resumeRecording(): String {
        return try {
            if (audioRecorder.resume()) """{"success":true}"""
            else """{"success":false,"error":"Not paused"}"""
        } catch (e: Exception) {
            """{"success":false,"error":"${SecurityUtils.escapeJson(e.message ?: "Unknown error")}"}"""
        }
    }

    @JavascriptInterface
    fun uploadVideo(base64Data: String, fileName: String): String {
        return try {
            val url = fileSystemManager.saveVideo(base64Data, fileName)
            """{"success":true,"url":"${SecurityUtils.escapeJson(url)}"}"""
        } catch (e: Exception) {
            """{"success":false,"error":"${SecurityUtils.escapeJson(e.message ?: "Unknown error")}"}"""
        }
    }

    @JavascriptInterface
    fun startVideoRecording(): String {
        return try {
            activity.startVideoRecording()
        } catch (e: Exception) {
            """{"success":false,"error":"${SecurityUtils.escapeJson(e.message ?: "Unknown error")}"}"""
        }
    }

    @JavascriptInterface
    fun stopVideoRecording(): String {
        return try {
            activity.stopVideoRecording()
        } catch (e: Exception) {
            """{"success":false,"error":"${SecurityUtils.escapeJson(e.message ?: "Unknown error")}"}"""
        }
    }

    @JavascriptInterface
    fun pauseVideoRecording(): String {
        return try {
            activity.pauseVideoRecording()
        } catch (e: Exception) {
            """{"success":false,"error":"${SecurityUtils.escapeJson(e.message ?: "Unknown error")}"}"""
        }
    }

    @JavascriptInterface
    fun resumeVideoRecording(): String {
        return try {
            activity.resumeVideoRecording()
        } catch (e: Exception) {
            """{"success":false,"error":"${SecurityUtils.escapeJson(e.message ?: "Unknown error")}"}"""
        }
    }

    @JavascriptInterface
    fun transcribeVideo(fileName: String): String {
        return try {
            val file = fileSystemManager.getVideoFile(fileName)
                ?: return """{"success":false,"error":"Video memo not found"}"""
            val pcm = AudioExtractor.extractPcm16k(file)
                ?: return """{"success":false,"error":"Video has no audio track"}"""
            val result = transcriptionManager.transcribe(pcm.samples, 16000f)
            if (result.text.isEmpty()) {
                """{"success":false,"error":"Transcription returned no text"}"""
            } else {
                val wordsJson = result.words.joinToString(",") { w ->
                    """{"word":"${SecurityUtils.escapeJson(w.word)}","start":${w.start},"end":${w.end}}"""
                }
                val prosodyJson = result.prosody.joinToString(",") { p ->
                    """{"f0":${p.f0},"energy":${p.energy}}"""
                }
                """{"success":true,"text":"${SecurityUtils.escapeJson(result.text)}","words":[$wordsJson],"prosody":[$prosodyJson]}"""
            }
        } catch (e: Exception) {
            """{"success":false,"error":"${SecurityUtils.escapeJson(e.message ?: "Transcription failed")}"}"""
        }
    }

    private fun makeMemoFileName(): String {
        val now = java.util.Date()
        val format = { pattern: String -> java.text.SimpleDateFormat(pattern, java.util.Locale.US).format(now) }
        return "memo-${format("yyyy")}-${format("MM")}-${format("dd")}-${format("HHmmss")}.wav"
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

    @JavascriptInterface
    fun fetchUrl(url: String): String {
        return try {
            val result = fetchArticle(url)
            if (result.success) {
                """{"success":true,"content":${SecurityUtils.toJsonString(result.content)},"finalUrl":${SecurityUtils.toJsonString(result.finalUrl)},"contentType":${SecurityUtils.toJsonString(result.contentType)}}"""
            } else {
                """{"success":false,"error":"${SecurityUtils.escapeJson(result.error)}"}"""
            }
        } catch (e: Exception) {
            """{"success":false,"error":"${SecurityUtils.escapeJson(e.message ?: "Unknown error")}"}"""
        }
    }

    private fun fetchArticle(url: String): FetchResult {
        var currentUrl = url
        var redirects = 0

        while (redirects < 5) {
            val connection = URL(currentUrl).openConnection() as HttpURLConnection
            connection.instanceFollowRedirects = false
            connection.connectTimeout = 15000
            connection.readTimeout = 20000
            connection.setRequestProperty(
                "User-Agent",
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
            )

            try {
                val code = connection.responseCode
                if (code in 300..399) {
                    val location = connection.getHeaderField("Location")
                        ?: return FetchResult(false, "", currentUrl, "", "Redirect without Location header")
                    currentUrl = URI(currentUrl).resolve(location).toString()
                    redirects++
                    connection.disconnect()
                    continue
                }

                val contentType = connection.contentType ?: ""
                val stream = if (code in 200..299) connection.inputStream else connection.errorStream
                val content = if (stream != null) String(readBounded(stream, 5 * 1024 * 1024), Charsets.UTF_8) else ""
                connection.disconnect()

                if (code !in 200..299) {
                    return FetchResult(false, "", currentUrl, contentType, "Request failed with status $code")
                }
                return FetchResult(true, content, currentUrl, contentType, "")
            } catch (e: Exception) {
                connection.disconnect()
                throw e
            }
        }

        return FetchResult(false, "", currentUrl, "", "Too many redirects")
    }

    private fun readBounded(stream: InputStream, maxBytes: Int): ByteArray {
        val buffer = ByteArrayOutputStream()
        val chunk = ByteArray(8192)
        var total = 0
        while (true) {
            val read = stream.read(chunk)
            if (read < 0) break
            total += read
            if (total > maxBytes) throw IllegalStateException("Response is too large")
            buffer.write(chunk, 0, read)
        }
        return buffer.toByteArray()
    }
}

private data class FetchResult(
    val success: Boolean,
    val content: String,
    val finalUrl: String,
    val contentType: String,
    val error: String
)
