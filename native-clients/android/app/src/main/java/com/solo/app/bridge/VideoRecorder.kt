package com.solo.app.bridge

import android.content.Context
import androidx.camera.core.CameraSelector
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.video.FileOutputOptions
import androidx.camera.video.Quality
import androidx.camera.video.QualitySelector
import androidx.camera.video.Recorder
import androidx.camera.video.Recording
import androidx.camera.video.VideoCapture
import androidx.camera.video.VideoRecordEvent
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import java.io.File
import java.util.concurrent.Executor

/**
 * Records a square (1:1) video memo with audio using CameraX.
 *
 * The recorded resolution is chosen by the [Quality] selector (a standard 4:3 or
 * 16:9 size); the note renders it square via `object-fit: cover`, matching the
 * desktop look.
 */
class VideoRecorder(
    private val context: Context,
    private val lifecycleOwner: LifecycleOwner,
    private val previewView: PreviewView,
) {
    companion object {
        private val QUALITY = Quality.SD
    }

    @Volatile
    private var activeRecording: Recording? = null

    @Volatile
    private var videoCapture: VideoCapture<Recorder>? = null

    @Volatile
    private var recording = false

    @Volatile
    private var paused = false

    @Volatile
    private var onFinish: ((File?) -> Unit)? = null

    private val mainExecutor: Executor = ContextCompat.getMainExecutor(context)

    fun isRecording(): Boolean = recording

    fun isPaused(): Boolean = paused

    /**
     * Starts the camera preview + recording into [outputFile]. [onFinish] is
     * invoked on the main thread with the recorded file (or null on error) once
     * the recording is finalized.
     */
    fun start(outputFile: File, onFinish: (File?) -> Unit): Boolean {
        if (recording) return false
        this.onFinish = onFinish
        recording = true
        paused = false

        return try {
            val providerFuture = ProcessCameraProvider.getInstance(context)
            providerFuture.addListener({
                try {
                    val provider = providerFuture.get()

                    val preview = Preview.Builder()
                        .build()
                    // PreviewView provides its own surface; attach it to the Preview
                    // use case. (The square look is produced by the note's CSS
                    // `object-fit: cover`, not by the preview aspect ratio.)
                    preview.setSurfaceProvider(mainExecutor, previewView.getSurfaceProvider())

                    val recorder = Recorder.Builder()
                        .setQualitySelector(QualitySelector.from(QUALITY))
                        .build()
                    val capture = VideoCapture.withOutput(recorder)
                    videoCapture = capture

                    provider.unbindAll()
                    val selector = if (provider.hasCamera(CameraSelector.DEFAULT_FRONT_CAMERA)) {
                        CameraSelector.DEFAULT_FRONT_CAMERA
                    } else {
                        CameraSelector.DEFAULT_BACK_CAMERA
                    }
                    provider.bindToLifecycle(lifecycleOwner, selector, preview, capture)

                    val outputOptions = FileOutputOptions.Builder(outputFile).build()
                    val pending = capture.output
                        .prepareRecording(context, outputOptions)
                        .withAudioEnabled()

                    activeRecording = pending.start(mainExecutor) { event ->
                        when (event) {
                            is VideoRecordEvent.Finalize -> {
                                val saved = if (event.hasError()) null else outputFile
                                recording = false
                                paused = false
                                activeRecording = null
                                val callback = this.onFinish
                                this.onFinish = null
                                callback?.invoke(saved)
                            }
                            else -> Unit
                        }
                    }
                } catch (e: Exception) {
                    recording = false
                    paused = false
                    val callback = this.onFinish
                    this.onFinish = null
                    callback?.invoke(null)
                }
            }, mainExecutor)
            true
        } catch (e: Exception) {
            recording = false
            paused = false
            this.onFinish = null
            false
        }
    }

    fun pause(): Boolean {
        if (!recording || paused) return false
        return try {
            activeRecording?.pause()
            paused = true
            true
        } catch (e: Exception) {
            false
        }
    }

    fun resume(): Boolean {
        if (!recording || !paused) return false
        return try {
            activeRecording?.resume()
            paused = false
            true
        } catch (e: Exception) {
            false
        }
    }

    /** Stops recording; the [start] callback fires with the final file. */
    fun stop(): Boolean {
        if (!recording) return false
        return try {
            activeRecording?.stop()
            true
        } catch (e: Exception) {
            false
        }
    }

    /** Releases the camera; safe to call when not recording. */
    fun release() {
        // Clear the callback first so the Finalize event (triggered by stop())
        // doesn't fire it during teardown.
        onFinish = null
        try {
            activeRecording?.stop()
        } catch (_: Exception) {
            // ignore
        }
        activeRecording = null
        videoCapture = null
        recording = false
        paused = false
        try {
            val providerFuture = ProcessCameraProvider.getInstance(context)
            if (providerFuture.isDone) {
                providerFuture.get().unbindAll()
            }
        } catch (_: Exception) {
            // ignore
        }
    }
}
