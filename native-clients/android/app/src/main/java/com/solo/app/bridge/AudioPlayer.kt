package com.solo.app.bridge

import android.content.Context
import android.content.res.AssetFileDescriptor
import android.media.AudioAttributes
import android.media.SoundPool

class AudioPlayer(private val context: Context) {

    private val soundPool: SoundPool
    private var typewriterSoundId: Int = 0
    private var isLoaded = false

    init {
        val audioAttributes = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_GAME)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()

        soundPool = SoundPool.Builder()
            .setMaxStreams(4)
            .setAudioAttributes(audioAttributes)
            .build()

        soundPool.setOnLoadCompleteListener { _, _, status ->
            if (status == 0) {
                isLoaded = true
            }
        }

        try {
            val afd: AssetFileDescriptor = context.assets.openFd("typewriter.mp3")
            typewriterSoundId = soundPool.load(afd, 1)
        } catch (_: Exception) {
            try {
                val afd: AssetFileDescriptor = context.assets.openFd("solo/typewriter.mp3")
                typewriterSoundId = soundPool.load(afd, 1)
            } catch (_: Exception) {
            }
        }
    }

    fun play() {
        if (isLoaded && typewriterSoundId != 0) {
            soundPool.play(typewriterSoundId, 1.0f, 1.0f, 1, 0, 2.0f)
        }
    }

    fun release() {
        soundPool.release()
    }
}
