package com.solo.app.sync

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.*

/**
 * SyncService — Android Foreground Service для фоновой синхронизации.
 *
 * Обеспечивает:
 * - Работу синхронизации в фоновом режиме
 * - Уведомление о статусе синхронизации
 * - Wake lock для предотвращения сна устройства во время синхронизации
 * - Управление жизненным циклом SyncEngine
 */
class SyncService : Service() {

    companion object {
        private const val CHANNEL_ID = "solo_sync_channel"
        private const val NOTIFICATION_ID = 1001
        private const val TAG = "SyncService"

        /**
         * Запускает сервис синхронизации.
         */
        fun start(context: Context) {
            val intent = Intent(context, SyncService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        /**
         * Останавливает сервис синхронизации.
         */
        fun stop(context: Context) {
            val intent = Intent(context, SyncService::class.java)
            context.stopService(intent)
        }
    }

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var syncEngine: SyncEngine? = null
    private var wakeLock: PowerManager.WakeLock? = null

    // Статус синхронизации для уведомления
    @Volatile
    private var syncStatus = "idle"
    @Volatile
    private var syncProgress = ""

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        acquireWakeLock()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notification = buildNotification("Initializing...", "")
        startForeground(NOTIFICATION_ID, notification)

        // Инициализируем SyncEngine
        scope.launch {
            try {
                val dataDir = filesDir.absolutePath
                syncEngine = SyncEngine(this@SyncService, dataDir).apply {
                    onStatusChanged = { status, progress ->
                        updateSyncStatus(status, progress)
                    }
                }

                // Boot scan
                updateSyncStatus("scanning", "Boot scan...")
                syncEngine?.initialize()

                // Запускаем FileWatcher
                syncEngine?.startFileWatcher()

                // Запускаем сервер Bluetooth
                val btStarted = syncEngine?.startBluetoothServer() ?: false

                if (btStarted) {
                    updateSyncStatus("listening", "Waiting for peers...")
                } else {
                    updateSyncStatus("error", "Bluetooth unavailable")
                }

                // Периодическая синхронизация с доверенными пирами
                launchPeriodicSync()
            } catch (e: Exception) {
                updateSyncStatus("error", e.message ?: "Initialization failed")
            }
        }

        // Если сервис убит, перезапускаем
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        scope.cancel()
        syncEngine?.destroy()
        releaseWakeLock()
        super.onDestroy()
    }

    /**
     * Периодическая синхронизация каждые 5 минут.
     */
    private suspend fun launchPeriodicSync() {
        while (true) {
            delay(5 * 60 * 1000L) // 5 минут
            try {
                syncEngine?.autoSync()
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    /**
     * Обновляет статус в уведомлении.
     */
    private fun updateSyncStatus(status: String, progress: String) {
        syncStatus = status
        syncProgress = progress

        val notification = buildNotification(status, progress)

        scope.launch(Dispatchers.Main) {
            try {
                val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
                manager.notify(NOTIFICATION_ID, notification)
            } catch (_: Exception) {}
        }
    }

    /**
     * Создаёт notification channel для Android 8+.
     */
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Solo Sync",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Background sync status"
                setShowBadge(false)
            }

            val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    /**
     * Строит notification с текущим статусом.
     */
    private fun buildNotification(status: String, progress: String): Notification {
        val title = when (status) {
            "scanning" -> "Scanning files..."
            "syncing" -> "Syncing..."
            "listening" -> "Solo Sync"
            "error" -> "Sync error"
            "connected" -> "Connected"
            else -> "Solo Sync"
        }

        val text = when (status) {
            "idle" -> "Ready"
            "scanning" -> progress
            "syncing" -> progress
            "listening" -> "Waiting for Bluetooth peers"
            "error" -> progress
            "connected" -> "Connected to peer"
            else -> progress
        }

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_menu_share)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .setSilent(true)
            .build()
    }

    /**
     * Захватывает wake lock для предотвращения сна во время sync.
     */
    private fun acquireWakeLock() {
        try {
            val powerManager = getSystemService(POWER_SERVICE) as PowerManager
            wakeLock = powerManager.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                "SoloSync:WakeLock"
            )
            wakeLock?.acquire(10 * 60 * 1000L) // 10 минут
        } catch (_: Exception) {}
    }

    /**
     * Освобождает wake lock.
     */
    private fun releaseWakeLock() {
        try {
            wakeLock?.release()
        } catch (_: Exception) {}
        wakeLock = null
    }
}
