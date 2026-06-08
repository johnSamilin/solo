package com.solo.app

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.Settings
import android.view.View
import android.view.WindowManager
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.solo.app.BuildConfig
import kotlinx.coroutines.launch
import com.solo.app.bridge.AudioPlayer
import com.solo.app.bridge.FileSystemManager
import com.solo.app.bridge.SearchEngine
import com.solo.app.bridge.WebViewBridge
import com.solo.app.sync.SyncEngine
import com.solo.app.utils.SecurityUtils

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var prefs: SharedPreferences
    private lateinit var fileSystemManager: FileSystemManager
    private lateinit var audioPlayer: AudioPlayer
    private lateinit var searchEngine: SearchEngine
    private lateinit var bridge: WebViewBridge
    private var syncEngine: SyncEngine? = null

    private val folderPickerLauncher = registerForActivityResult(
        ActivityResultContracts.OpenDocumentTree()
    ) { uri: Uri? ->
        handleFolderPickerResult(uri)
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
        searchEngine = SearchEngine(fileSystemManager)

        val savedFolder = prefs.getString("root_folder", null)
        if (savedFolder != null) {
            fileSystemManager.setRootFolder(savedFolder)
        }

        // Инициализируем SyncEngine
        initSyncEngine()

        setupWebView()
        setupBackNavigation()
    }

     private fun initSyncEngine() {
         try {
             // Проверяем, доступен ли Bluetooth адаптер
             val bluetoothManager = getSystemService(Context.BLUETOOTH_SERVICE) as? android.bluetooth.BluetoothManager
             val bluetoothAdapter = bluetoothManager?.adapter ?: android.bluetooth.BluetoothAdapter.getDefaultAdapter()
             
             if (bluetoothAdapter == null) {
                 android.util.Log.e("MainActivity", "Bluetooth is not supported on this device")
                 // Создаем SyncEngine без Bluetooth функциональности
                 val dataDir = filesDir.absolutePath
                 syncEngine = SyncEngine(
                     context = this,
                     dataDir = dataDir,
                     deviceId = android.provider.Settings.Secure.getString(
                         contentResolver, android.provider.Settings.Secure.ANDROID_ID
                     ) ?: "android-unknown",
                     deviceName = android.os.Build.MODEL,
                     platform = "android",
                     appVersion = BuildConfig.VERSION_NAME ?: "1.0.0"
                 )
                 return
             }
             
             // Проверяем, включен ли Bluetooth
             if (!bluetoothAdapter.isEnabled) {
                 android.util.Log.w("MainActivity", "Bluetooth is not enabled, initializing SyncEngine without Bluetooth")
             }
             
             val dataDir = filesDir.absolutePath
             syncEngine = SyncEngine(
                 context = this,
                 dataDir = dataDir,
                 deviceId = android.provider.Settings.Secure.getString(
                     contentResolver, android.provider.Settings.Secure.ANDROID_ID
                 ) ?: "android-unknown",
                 deviceName = android.os.Build.MODEL,
                 platform = "android",
                 appVersion = BuildConfig.VERSION_NAME ?: "1.0.0"
             )
         } catch (e: Exception) {
             android.util.Log.e("MainActivity", "Failed to initialize SyncEngine: ${e.message}", e)
             // Не критично - синхронизация просто не будет работать
         }
     }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        webView = findViewById(R.id.webView)

        bridge = WebViewBridge(this, fileSystemManager, audioPlayer, searchEngine, syncEngine)

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
        }

        webView.webChromeClient = WebChromeClient()

        webView.loadUrl("file:///android_asset/solo/index.html")
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

    /**
     * Публичный метод для выполнения JavaScript в WebView.
     * Используется WebViewBridge для push-событий синхронизации.
     */
    fun evaluateJavascript(script: String) {
        webView.evaluateJavascript(script, null)
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

    override fun onDestroy() {
        audioPlayer.release()
        syncEngine?.let {
            lifecycleScope.launch {
                it.stopSync()
            }
        }
        webView.destroy()
        super.onDestroy()
    }
}
