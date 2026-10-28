package com.solo.app.bridge

import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import java.io.ByteArrayOutputStream
import java.io.File

/**
 * Extracts and decodes the first audio track of an mp4/webm video into 16-bit
 * mono PCM at 16 kHz, the sample rate expected by the Vosk model. Used for
 * transcribing video memos (option B — audio is pulled from the video, no
 * separate audio file is kept).
 */
object AudioExtractor {

    fun extractPcm16k(file: File): PcmAudio? {
        val extractor = MediaExtractor()
        var codec: MediaCodec? = null
        return try {
            extractor.setDataSource(file.absolutePath)

            var audioTrack = -1
            var format: MediaFormat? = null
            for (i in 0 until extractor.trackCount) {
                val f = extractor.getTrackFormat(i)
                val mime = f.getString(MediaFormat.KEY_MIME) ?: continue
                if (mime.startsWith("audio/")) {
                    audioTrack = i
                    format = f
                    break
                }
            }
            if (audioTrack < 0 || format == null) {
                return null
            }

            extractor.selectTrack(audioTrack)

            val sampleRate = if (format.containsKey(MediaFormat.KEY_SAMPLE_RATE)) {
                format.getInteger(MediaFormat.KEY_SAMPLE_RATE)
            } else {
                48000
            }
            val channelCount = if (format.containsKey(MediaFormat.KEY_CHANNEL_COUNT)) {
                format.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
            } else {
                1
            }
            val mime = format.getString(MediaFormat.KEY_MIME) ?: return null

            codec = MediaCodec.createDecoderByType(mime)
            codec.configure(format, null, null, 0)
            codec.start()

            val pcm = decodeToPcm(extractor, codec)
            val resampled = if (sampleRate == 16000 && channelCount == 1) {
                pcm
            } else {
                resampleTo16kMono(pcm, sampleRate, channelCount)
            }
            PcmAudio(resampled, 16000)
        } catch (e: Exception) {
            null
        } finally {
            try {
                codec?.stop()
            } catch (_: Exception) {
            }
            try {
                codec?.release()
            } catch (_: Exception) {
            }
            try {
                extractor.release()
            } catch (_: Exception) {
            }
        }
    }

    private fun decodeToPcm(extractor: MediaExtractor, codec: MediaCodec): ByteArray {
        val output = ByteArrayOutputStream()
        val info = MediaCodec.BufferInfo()
        var inputDone = false
        val timeoutUs = 10_000L

        while (true) {
            if (!inputDone) {
                val inIndex = codec.dequeueInputBuffer(timeoutUs)
                if (inIndex >= 0) {
                    val inBuf = codec.getInputBuffer(inIndex)
                    val sampleSize = if (inBuf != null) extractor.readSampleData(inBuf, 0) else 0
                    if (sampleSize < 0) {
                        codec.queueInputBuffer(inIndex, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                        inputDone = true
                    } else {
                        codec.queueInputBuffer(inIndex, 0, sampleSize, extractor.sampleTime, 0)
                        extractor.advance()
                    }
                }
            }

            val outIndex = codec.dequeueOutputBuffer(info, timeoutUs)
            when {
                outIndex >= 0 -> {
                    val outBuf = codec.getOutputBuffer(outIndex)
                    if (outBuf != null && info.size > 0) {
                        val bytes = ByteArray(info.size)
                        outBuf.position(info.offset)
                        outBuf.get(bytes, 0, info.size)
                        output.write(bytes)
                    }
                    codec.releaseOutputBuffer(outIndex, false)
                    if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) break
                }
                outIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
                    // ignore; format already known
                }
            }
        }

        return output.toByteArray()
    }

    /**
     * Downmixes interleaved 16-bit PCM to mono and resamples to 16 kHz using
     * linear interpolation.
     */
    private fun resampleTo16kMono(input: ByteArray, srcRate: Int, channels: Int): ByteArray {
        val frameCount = input.size / 2 / channels
        if (frameCount == 0) return ByteArray(0)

        val mono = FloatArray(frameCount)
        for (i in 0 until frameCount) {
            var sum = 0f
            for (c in 0 until channels) {
                val idx = (i * channels + c) * 2
                val s = ((input[idx + 1].toInt() shl 8) or (input[idx].toInt() and 0xFF)).toShort()
                sum += s / 32768f
            }
            mono[i] = sum / channels
        }

        val ratio = srcRate.toFloat() / 16000f
        val outFrames = (mono.size / ratio).toInt()
        val out = ByteArray(outFrames * 2)
        var outIdx = 0
        for (i in 0 until outFrames) {
            val pos = i * ratio
            val i0 = pos.toInt()
            val i1 = minOf(i0 + 1, mono.size - 1)
            val frac = pos - i0
            val v = mono[i0] * (1f - frac) + mono[i1] * frac
            val s = (v.coerceIn(-1f, 1f) * 32767f).toInt()
            out[outIdx++] = (s and 0xFF).toByte()
            out[outIdx++] = ((s shr 8) and 0xFF).toByte()
        }
        return out
    }
}
