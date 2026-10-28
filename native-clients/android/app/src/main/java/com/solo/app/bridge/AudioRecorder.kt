package com.solo.app.bridge

import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import java.io.ByteArrayOutputStream

/**
 * Records raw 16-bit mono PCM from the microphone via {@link AudioRecord}.
 * Used by the native voice-memo path, which avoids the WebView `getUserMedia`
 * API (unreliable on Android) entirely.
 */
class AudioRecorder {

    companion object {
        const val SAMPLE_RATE = 16000
    }

    private var audioRecord: AudioRecord? = null
    private var recordingThread: Thread? = null
    private var output: ByteArrayOutputStream? = null

    @Volatile
    private var recording = false

    @Volatile
    private var paused = false

    fun isRecording(): Boolean = recording

    fun isPaused(): Boolean = paused

    fun start(): Boolean {
        if (recording) return false

        val minBuffer = AudioRecord.getMinBufferSize(
            SAMPLE_RATE,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT,
        )
        if (minBuffer <= 0) return false

        val record = AudioRecord(
            MediaRecorder.AudioSource.MIC,
            SAMPLE_RATE,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT,
            minBuffer,
        )
        if (record.state != AudioRecord.STATE_INITIALIZED) {
            record.release()
            return false
        }

        audioRecord = record
        output = ByteArrayOutputStream()
        recording = true
        paused = false
        record.startRecording()

        recordingThread = Thread {
            val buffer = ByteArray(minBuffer)
            while (recording) {
                // While paused, keep the AudioRecord alive but skip writing frames
                // so the pause gap is not recorded. Sleep briefly to avoid a busy loop.
                if (paused) {
                    try {
                        Thread.sleep(20)
                    } catch (_: InterruptedException) {
                        break
                    }
                    continue
                }
                val read = record.read(buffer, 0, buffer.size)
                if (read > 0) output?.write(buffer, 0, read)
            }
        }
        recordingThread?.start()
        return true
    }

    fun pause(): Boolean {
        if (!recording || paused) return false
        paused = true
        return true
    }

    fun resume(): Boolean {
        if (!recording || !paused) return false
        paused = false
        return true
    }

    fun stop(): ByteArray? {
        if (!recording) return null

        recording = false
        paused = false
        try {
            recordingThread?.join(1000)
        } catch (_: InterruptedException) {
            // ignore
        }
        recordingThread = null

        try {
            audioRecord?.stop()
        } catch (_: Exception) {
            // ignore
        }
        audioRecord?.release()
        audioRecord = null

        val bytes = output?.toByteArray()
        output = null
        return bytes
    }
}
