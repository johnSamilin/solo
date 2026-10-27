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

    fun isRecording(): Boolean = recording

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
        record.startRecording()

        recordingThread = Thread {
            val buffer = ByteArray(minBuffer)
            while (recording) {
                val read = record.read(buffer, 0, buffer.size)
                if (read > 0) output?.write(buffer, 0, read)
            }
        }
        recordingThread?.start()
        return true
    }

    fun stop(): ByteArray? {
        if (!recording) return null

        recording = false
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
