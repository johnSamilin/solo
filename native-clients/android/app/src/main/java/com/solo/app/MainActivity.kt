package com.solo.app

import android.annotation.SuppressLint
import android.Manifest
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.View
import android.view.WindowManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.TextView
import androidx.camera.view.PreviewView
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.File
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.solo.app.bridge.AudioPlayer
import com.solo.app.bridge.AudioRecorder
import com.solo.app.bridge.FileSystemManager
import com.solo.app.bridge.SearchEngine
import com.solo.app.bridge.TranscriptionManager
import com.solo.app.bridge.VideoRecorder
import com.solo.app.bridge.WebViewBridge
import com.solo.app.utils.SecurityUtils

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var prefs: SharedPreferences
    private lateinit var fileSystemManager: FileSystemManager
    private lateinit var audioPlayer: AudioPlayer
    private lateinit var audioRecorder: AudioRecorder
    private lateinit var transcriptionManager: TranscriptionManager
    private lateinit var searchEngine: SearchEngine
    private lateinit var bridge: WebViewBridge

    private lateinit var videoRecorder: VideoRecorder
    private lateinit var videoOverlay: FrameLayout
    private lateinit var videoPreview: PreviewView
    private lateinit var videoTimer: TextView
    private lateinit var videoPause: Button
    private lateinit var videoStop: Button
    private var videoOutputFile: File? = null
    private var videoSeconds = 0
    private val videoTimerHandler = Handler(Looper.getMainLooper())
    private val videoTimerRunnable = object : Runnable {
        override fun run() {
            videoSeconds++
            val m = videoSeconds / 60
            val s = videoSeconds % 60
            videoTimer.text = "$m:${s.toString().padStart(2, '0')}"
            videoTimerHandler.postDelayed(this, 1000)
        }
    }

    private val folderPickerLauncher = registerForActivityResult(
        ActivityResultContracts.OpenDocumentTree()
    ) { uri: Uri? ->
        handleFolderPickerResult(uri)
    }

    private val recordAudioPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { _ ->
        // Nothing to do here; the next record attempt will succeed if granted.
    }

    private val cameraPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { _ ->
        // Nothing to do here; the next record attempt will succeed if granted.
    }

    private val manageStorageLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && Environment.isExternalStorageManager()) {
            launchFolderPicker()
        } else {
            notifyFolderPickerResult(false, null, "Storage permission denied")
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS)
        window.statusBarColor = android.graphics.Color.WHITE
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
        }

        prefs = getSharedPreferences("solo_prefs", MODE_PRIVATE)

        fileSystemManager = FileSystemManager(this, prefs)
        audioPlayer = AudioPlayer(this)
        audioRecorder = AudioRecorder()
        transcriptionManager = TranscriptionManager(this)
        transcriptionManager.init()
        searchEngine = SearchEngine(fileSystemManager)

        requestRecordAudioPermission()
        requestCameraPermission()

        val savedFolder = prefs.getString("root_folder", null)
        if (savedFolder != null) {
            fileSystemManager.setRootFolder(savedFolder)
        }

        setupWebView()
        setupVideoOverlay()
        setupBackNavigation()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        webView = findViewById(R.id.webView)

        bridge = WebViewBridge(this, fileSystemManager, audioPlayer, audioRecorder, transcriptionManager, searchEngine)

        @Suppress("DEPRECATION")
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = true
            allowContentAccess = true
            allowFileAccessFromFileURLs = true
            allowUniversalAccessFromFileURLs = true
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            useWideViewPort = true
            loadWithOverviewMode = true
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
            cacheMode = WebSettings.LOAD_NO_CACHE
            mediaPlaybackRequiresUserGesture = false
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                safeBrowsingEnabled = false
            }
        }

        webView.addJavascriptInterface(bridge, "SoloBridge")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
                if (url != null && (url.startsWith("http://") || url.startsWith("https://"))) {
                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                    startActivity(intent)
                    return true
                }
                return false
            }

            override fun shouldInterceptRequest(
                view: WebView?,
                request: WebResourceRequest?
            ): WebResourceResponse? {
                val url = request?.url ?: return null
                if (url.scheme == "image") {
                    return handleImageRequest(url)
                }
                if (url.scheme == "voice") {
                    return handleVoiceRequest(url)
                }
                if (url.scheme == "video") {
                    return handleVideoRequest(url)
                }
                return super.shouldInterceptRequest(view, request)
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: android.webkit.PermissionRequest?) {
                // Grant audio capture so voice memos can record from the
                // microphone inside the WebView.
                request?.grant(request.resources)
            }
        }

        webView.loadUrl("file:///android_asset/solo/index.html")
    }

    private fun setupVideoOverlay() {
        videoOverlay = findViewById(R.id.videoOverlay)
        videoPreview = findViewById(R.id.videoPreview)
        videoTimer = findViewById(R.id.videoTimer)
        videoPause = findViewById(R.id.videoPause)
        videoStop = findViewById(R.id.videoStop)

        videoRecorder = VideoRecorder(this, this, videoPreview)

        videoPause.setOnClickListener {
            if (videoRecorder.isPaused()) {
                if (videoRecorder.resume()) {
                    videoPause.text = "Pause"
                    startVideoTimer()
                }
            } else {
                if (videoRecorder.pause()) {
                    videoPause.text = "Resume"
                    stopVideoTimer()
                }
            }
        }

        videoStop.setOnClickListener {
            stopVideoRecording()
        }
    }

    // ── Video memo recording (native CameraX) ──

    fun startVideoRecording(): String {
        if (!hasCameraPermission()) {
            return """{"success":false,"error":"Camera permission not granted"}"""
        }
        if (!hasRecordAudioPermission()) {
            return """{"success":false,"error":"Microphone permission not granted"}"""
        }
        if (videoRecorder.isRecording()) {
            return """{"success":false,"error":"Already recording"}"""
        }

        val tempFile = File(cacheDir, "video-memo-${System.currentTimeMillis()}.mp4")
        videoOutputFile = tempFile

        val started = videoRecorder.start(tempFile) { file ->
            onVideoRecordingFinished(file)
        }
        if (!started) {
            videoOutputFile = null
            return """{"success":false,"error":"Failed to start recording"}"""
        }

        runOnUiThread {
            videoOverlay.visibility = View.VISIBLE
            videoSeconds = 0
            videoTimer.text = "0:00"
            videoPause.text = "Pause"
            startVideoTimer()
        }
        return """{"success":true}"""
    }

    fun stopVideoRecording(): String {
        if (!videoRecorder.isRecording()) {
            return """{"success":false,"error":"Not recording"}"""
        }
        // The finalize callback (onVideoRecordingFinished) delivers the result.
        videoRecorder.stop()
        return """{"success":true}"""
    }

    fun pauseVideoRecording(): String {
        return if (videoRecorder.pause()) {
            runOnUiThread { videoPause.text = "Resume" }
            stopVideoTimer()
            """{"success":true}"""
        } else {
            """{"success":false,"error":"Not recording"}"""
        }
    }

    fun resumeVideoRecording(): String {
        return if (videoRecorder.resume()) {
            runOnUiThread { videoPause.text = "Pause" }
            startVideoTimer()
            """{"success":true}"""
        } else {
            """{"success":false,"error":"Not paused"}"""
        }
    }

    private fun onVideoRecordingFinished(file: File?) {
        stopVideoTimer()
        runOnUiThread { videoOverlay.visibility = View.GONE }
        videoOutputFile = null

        if (file == null || !file.exists() || file.length() == 0L) {
            notifyVideoRecordingResult(false, null, 0, null, "Nothing was recorded")
            return
        }

        Thread {
            try {
                val duration = getVideoDuration(file)
                // Capture the first frame before the video is moved (saveVideoFile
                // deletes the temp source).
                val posterBytes = capturePosterBytes(file)
                val fileName = makeVideoFileName()
                val url = fileSystemManager.saveVideoFile(file, fileName)
                val posterUrl = if (posterBytes != null) {
                    val posterName = url.removePrefix("video://").replace(".mp4", ".jpg")
                    fileSystemManager.saveVideoBytes(posterBytes, posterName)
                } else {
                    null
                }
                notifyVideoRecordingResult(true, url, duration, posterUrl, null)
            } catch (e: Exception) {
                notifyVideoRecordingResult(false, null, 0, null, e.message ?: "Failed to save video memo")
            }
        }.start()
    }

    /** Captures the first frame of a recorded video as a JPEG byte array. */
    private fun capturePosterBytes(file: File): ByteArray? {
        return try {
            val mmr = MediaMetadataRetriever()
            mmr.setDataSource(file.absolutePath)
            val frame = mmr.getFrameAtTime(0, MediaMetadataRetriever.OPTION_CLOSEST_SYNC)
            mmr.release()
            if (frame == null) return null
            val baos = ByteArrayOutputStream()
            frame.compress(Bitmap.CompressFormat.JPEG, 85, baos)
            frame.recycle()
            baos.toByteArray()
        } catch (e: Exception) {
            null
        }
    }

    private fun getVideoDuration(file: File): Long {
        return try {
            val mmr = MediaMetadataRetriever()
            mmr.setDataSource(file.absolutePath)
            val duration = mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLong() ?: 0L
            mmr.release()
            duration
        } catch (e: Exception) {
            0L
        }
    }

    private fun makeVideoFileName(): String {
        val now = java.util.Date()
        val format = { pattern: String -> java.text.SimpleDateFormat(pattern, java.util.Locale.US).format(now) }
        return "video-${format("yyyy")}-${format("MM")}-${format("dd")}-${format("HHmmss")}.mp4"
    }

    private fun notifyVideoRecordingResult(
        success: Boolean,
        url: String?,
        duration: Long,
        posterUrl: String?,
        error: String?,
    ) {
        val json = if (success) {
            val poster = if (posterUrl != null) ""","poster":"${SecurityUtils.escapeJson(posterUrl)}"""" else ""
            """{"success":true,"url":"${SecurityUtils.escapeJson(url ?: "")}","duration":$duration$poster}"""
        } else {
            """{"success":false,"error":"${SecurityUtils.escapeJson(error ?: "Unknown error")}"}"""
        }
        runOnUiThread {
            webView.evaluateJavascript(
                "if(window.__soloVideoRecordingResult){window.__soloVideoRecordingResult('${SecurityUtils.escapeJsString(json)}');}",
                null
            )
        }
    }

    private fun startVideoTimer() {
        videoTimerHandler.removeCallbacks(videoTimerRunnable)
        videoTimerHandler.postDelayed(videoTimerRunnable, 1000)
    }

    private fun stopVideoTimer() {
        videoTimerHandler.removeCallbacks(videoTimerRunnable)
    }

    /**
     * Serves video memos referenced with the custom `video://<fileName>` protocol
     * used inside notes. Mirrors {@link #handleVoiceRequest(android.net.Uri)} but
     * resolves against the `<rootFolder>/assets/video` directory.
     */
    private fun handleVideoRequest(uri: Uri): WebResourceResponse? {
        val raw = uri.toString()
        val fileName = raw
            .removePrefix("video://")
            .substringBefore('?')
            .substringBefore('#')
            .trimStart('/')
            .takeIf { it.isNotEmpty() }
            ?: return null

        val bytes = fileSystemManager.readVideoAsset(fileName) ?: return WebResourceResponse(
            "text/plain",
            "utf-8",
            404,
            "Not Found",
            emptyMap(),
            ByteArrayInputStream(ByteArray(0))
        )

        val mimeType = fileSystemManager.guessMimeType(fileName)
        val headers = mapOf("Access-Control-Allow-Origin" to "*")

        return WebResourceResponse(
            mimeType,
            null,
            200,
            "OK",
            headers,
            ByteArrayInputStream(bytes)
        )
    }

    /**
     * Serves images referenced with the custom `image://<fileName>` protocol used
     * inside notes. Mirrors the Electron `protocol.handle('image', ...)` handler:
     * the file name is resolved against the `<rootFolder>/assets` directory.
     */
    private fun handleImageRequest(uri: Uri): WebResourceResponse? {
        // Parse the file name from the raw URL rather than uri.host, because
        // Uri.host lowercases the authority which would break file names that
        // contain uppercase letters. Format: image://<fileName>[/...]
        val raw = uri.toString()
        val fileName = raw
            .removePrefix("image://")
            .substringBefore('?')
            .substringBefore('#')
            .trimStart('/')
            .takeIf { it.isNotEmpty() }
            ?: return null

        val bytes = fileSystemManager.readAsset(fileName) ?: return WebResourceResponse(
            "text/plain",
            "utf-8",
            404,
            "Not Found",
            emptyMap(),
            ByteArrayInputStream(ByteArray(0))
        )

        val mimeType = fileSystemManager.guessMimeType(fileName)
        val headers = mapOf("Access-Control-Allow-Origin" to "*")

        return WebResourceResponse(
            mimeType,
            null,
            200,
            "OK",
            headers,
            ByteArrayInputStream(bytes)
        )
    }

    /**
     * Serves voice memos referenced with the custom `voice://<fileName>` protocol
     * used inside notes. Mirrors {@link #handleImageRequest(android.net.Uri)} but
     * resolves against the `<rootFolder>/assets/voice` directory.
     */
    private fun handleVoiceRequest(uri: Uri): WebResourceResponse? {
        val raw = uri.toString()
        val fileName = raw
            .removePrefix("voice://")
            .substringBefore('?')
            .substringBefore('#')
            .trimStart('/')
            .takeIf { it.isNotEmpty() }
            ?: return null

        val bytes = fileSystemManager.readVoiceAsset(fileName) ?: return WebResourceResponse(
            "text/plain",
            "utf-8",
            404,
            "Not Found",
            emptyMap(),
            ByteArrayInputStream(ByteArray(0))
        )

        val mimeType = fileSystemManager.guessMimeType(fileName)
        val headers = mapOf("Access-Control-Allow-Origin" to "*")

        return WebResourceResponse(
            mimeType,
            null,
            200,
            "OK",
            headers,
            ByteArrayInputStream(bytes)
        )
    }

    private fun setupBackNavigation() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })
    }

    fun launchFolderPicker() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            if (!Environment.isExternalStorageManager()) {
                val intent = Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION)
                manageStorageLauncher.launch(intent)
                return
            }
        }
        folderPickerLauncher.launch(null)
    }

    private fun handleFolderPickerResult(uri: Uri?) {
        if (uri == null) {
            notifyFolderPickerResult(false, null, "Folder selection cancelled")
            return
        }

        contentResolver.takePersistableUriPermission(
            uri,
            Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
        )

        val path = SecurityUtils.getPathFromUri(this, uri)
        if (path != null) {
            prefs.edit().putString("root_folder", path).apply()
            fileSystemManager.setRootFolder(path)
            notifyFolderPickerResult(true, path, null)
        } else {
            notifyFolderPickerResult(false, null, "Failed to resolve folder path")
        }
    }

    private fun notifyFolderPickerResult(success: Boolean, path: String?, error: String?) {
        val json = if (success) {
            """{"success":true,"path":"${SecurityUtils.escapeJson(path ?: "")}"}"""
        } else {
            """{"success":false,"error":"${SecurityUtils.escapeJson(error ?: "Unknown error")}"}"""
        }

        runOnUiThread {
            webView.evaluateJavascript(
                "if(window.__soloSelectFolderCallback){window.__soloSelectFolderCallback('${SecurityUtils.escapeJsString(json)}');}",
                null
            )
        }
    }

    fun toggleZenMode(enable: Boolean) {
        runOnUiThread {
            if (enable) {
                window.decorView.systemUiVisibility = (
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        or View.SYSTEM_UI_FLAG_FULLSCREEN
                        or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                )
            } else {
                window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
            }
        }
    }

    fun hasRecordAudioPermission(): Boolean {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.M ||
            checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
    }

    private fun hasCameraPermission(): Boolean {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.M ||
            checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
    }

    private fun requestRecordAudioPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M &&
            checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED
        ) {
            recordAudioPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
        }
    }

    private fun requestCameraPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M &&
            checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED
        ) {
            cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }

    override fun onDestroy() {
        audioPlayer.release()
        audioRecorder.stop()
        videoRecorder.release()
        webView.destroy()
        super.onDestroy()
    }
}
