package com.solo.app.bridge

import android.content.Context
import org.json.JSONObject
import org.vosk.Model
import org.vosk.Recognizer
import java.io.File
import java.io.FileOutputStream
import java.util.zip.ZipInputStream

/**
 * On-device Russian speech recognition backed by the Vosk AAR.
 *
 * The model is shipped as a single ZIP at `assets/model-ru.zip` (the standard
 * Vosk `vosk-model-small-ru-0.22` model). On first use it is unpacked to the
 * app's files dir, then reused on subsequent launches.
 *
 * We unpack ourselves rather than using `org.vosk.android.StorageService`
 * because the latter expects the model to be an already-unpacked *folder* in
 * assets with a `uuid` file — an awkward layout for a single ZIP artifact.
 */
class TranscriptionManager(private val context: Context) {

    companion object {
        private const val MODEL_ASSET = "model-ru.zip" // assets/model-ru.zip
        private const val MODEL_DIR = "vosk-model-ru" // filesDir/vosk-model-ru/
        private const val CHUNK_BYTES = 32000
    }

    @Volatile
    private var model: Model? = null

    @Volatile
    private var loadError: String? = null

    /** Unpacks/loads the model in the background. Call once at startup. */
    fun init() {
        Thread {
            try {
                val modelRoot = ensureModel()
                model = Model(modelRoot.absolutePath)
            } catch (e: Exception) {
                loadError = e.message
            }
        }.start()
    }

    /**
     * Transcribes 16-bit mono PCM and returns the recognized text.
     * Throws if the model is not ready or recognition fails.
     */
    fun transcribe(pcmBytes: ByteArray, sampleRate: Float): String {
        val m = model ?: throw IllegalStateException(loadError ?: "Speech model is still loading")

        val recognizer = Recognizer(m, sampleRate)
        return try {
            var offset = 0
            while (offset < pcmBytes.size) {
                val end = minOf(offset + CHUNK_BYTES, pcmBytes.size)
                val chunk = pcmBytes.copyOfRange(offset, end)
                recognizer.acceptWaveForm(chunk, chunk.size)
                offset = end
            }
            val text = JSONObject(recognizer.finalResult).optString("text", "").trim()
            recognizer.close()
            text
        } catch (e: Exception) {
            recognizer.close()
            throw e
        }
    }

    /** Returns an already-unpacked model dir, or unpacks the asset if needed. */
    private fun ensureModel(): File {
        val base = File(context.filesDir, MODEL_DIR)

        // Look for an existing unpacked model (at `base` or one directory down).
        val candidates = mutableListOf(base)
        base.listFiles()?.filter { it.isDirectory }?.let { candidates.addAll(it) }
        for (dir in candidates) {
            if (File(dir, "am").isDirectory) return dir
        }

        // Not unpacked yet — wipe and re-unpack the asset.
        base.deleteRecursively()
        base.mkdirs()
        return unzipModel(MODEL_ASSET, base)
    }

    /**
     * Unzips `assets/<assetName>` into `targetDir` and returns the model root.
     * If the archive wraps everything in a single top-level folder (as the
     * official Vosk model zips do), that folder is returned instead.
     */
    private fun unzipModel(assetName: String, targetDir: File): File {
        val topLevelEntries = mutableSetOf<String>()

        context.assets.open(assetName).use { input ->
            ZipInputStream(input).use { zis ->
                var entry = zis.nextEntry
                while (entry != null) {
                    val name = entry.name.removePrefix("/")
                    val topLevel = name.substringBefore("/")
                    if (topLevel != name) topLevelEntries.add(topLevel)

                    val outFile = File(targetDir, name)
                    if (entry.isDirectory) {
                        outFile.mkdirs()
                    } else {
                        outFile.parentFile?.mkdirs()
                        FileOutputStream(outFile).use { out -> zis.copyTo(out) }
                    }
                    zis.closeEntry()
                    entry = zis.nextEntry
                }
            }
        }

        return if (topLevelEntries.size == 1) File(targetDir, topLevelEntries.first()) else targetDir
    }
}
