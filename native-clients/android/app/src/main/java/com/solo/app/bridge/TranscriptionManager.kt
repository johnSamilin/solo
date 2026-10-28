package com.solo.app.bridge

import android.content.Context
import org.json.JSONObject
import org.vosk.Model
import org.vosk.Recognizer
import java.io.File
import java.io.FileOutputStream
import java.util.zip.ZipInputStream
import kotlin.math.sqrt

data class WordTiming(val word: String, val start: Double, val end: Double)
data class WordProsody(val f0: Double, val energy: Double)
data class TranscriptionResult(
    val text: String,
    val words: List<WordTiming>,
    val prosody: List<WordProsody>,
)

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
     * Transcribes 16-bit mono PCM and returns the recognized text plus word
     * timings and per-word prosody (pitch + energy) for punctuation restoration.
     * Throws if the model is not ready or recognition fails.
     */
    fun transcribe(pcmBytes: ByteArray, sampleRate: Float): TranscriptionResult {
        val m = model ?: throw IllegalStateException(loadError ?: "Speech model is still loading")

        val recognizer = Recognizer(m, sampleRate)
        return try {
            recognizer.setWords(true)

            var offset = 0
            while (offset < pcmBytes.size) {
                val end = minOf(offset + CHUNK_BYTES, pcmBytes.size)
                val chunk = pcmBytes.copyOfRange(offset, end)
                recognizer.acceptWaveForm(chunk, chunk.size)
                offset = end
            }

            val json = JSONObject(recognizer.finalResult)
            val text = json.optString("text", "").trim()
            recognizer.close()

            val words = mutableListOf<WordTiming>()
            val resultArr = json.optJSONArray("result")
            if (resultArr != null) {
                for (i in 0 until resultArr.length()) {
                    val obj = resultArr.optJSONObject(i) ?: continue
                    val word = obj.optString("word", "").trim()
                    if (word.isEmpty()) continue
                    words.add(WordTiming(word, obj.optDouble("start", 0.0), obj.optDouble("end", 0.0)))
                }
            }

            val prosody = computeProsody(pcmBytes, sampleRate.toInt(), words)
            TranscriptionResult(text, words, prosody)
        } catch (e: Exception) {
            recognizer.close()
            throw e
        }
    }

    // ── Prosody (pitch + energy) for punctuation restoration ──

    private fun computeRms(samples: DoubleArray): Double {
        if (samples.isEmpty()) return 0.0
        var sum = 0.0
        for (s in samples) sum += s * s
        return sqrt(sum / samples.size)
    }

    /** Autocorrelation pitch estimate in Hz; 0.0 if unvoiced/too short. */
    private fun estimateF0(samples: DoubleArray, sampleRate: Int): Double {
        val minF0 = 60.0
        val maxF0 = 400.0
        val minLag = maxOf(1, (sampleRate / maxF0).toInt())
        val maxLag = minOf(samples.size - 1, (sampleRate / minF0).toInt())
        if (samples.size < maxLag * 2) return 0.0

        val mean = samples.average()
        var energy = 0.0
        for (s in samples) {
            val x = s - mean
            energy += x * x
        }
        if (energy == 0.0) return 0.0

        var bestLag = 0
        var bestNorm = 0.0
        for (lag in minLag..maxLag) {
            var corr = 0.0
            for (i in lag until samples.size) {
                corr += (samples[i] - mean) * (samples[i - lag] - mean)
            }
            val norm = corr / energy
            if (norm > bestNorm) {
                bestNorm = norm
                bestLag = lag
            }
        }

        if (bestNorm < 0.3) return 0.0
        return sampleRate.toDouble() / bestLag
    }

    /** Per-word pitch + energy from 16-bit PCM, using each word's last ~40 ms. */
    private fun computeProsody(pcmBytes: ByteArray, sampleRate: Int, words: List<WordTiming>): List<WordProsody> {
        val windowLen = (sampleRate * 0.04).toInt()
        val sampleCount = pcmBytes.size / 2
        val result = mutableListOf<WordProsody>()

        for (w in words) {
            val endSample = minOf((w.end * sampleRate).toInt(), sampleCount)
            val startSample = maxOf(0, endSample - windowLen)
            val n = endSample - startSample

            val samples = DoubleArray(n)
            for (i in 0 until n) {
                val byteIdx = (startSample + i) * 2
                val low = pcmBytes[byteIdx].toInt() and 0xFF
                val high = pcmBytes[byteIdx + 1].toInt() and 0xFF
                samples[i] = ((high shl 8) or low).toShort().toDouble() / 32768.0
            }

            result.add(WordProsody(estimateF0(samples, sampleRate), computeRms(samples)))
        }
        return result
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
