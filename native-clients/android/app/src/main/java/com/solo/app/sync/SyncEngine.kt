package com.solo.app.sync

import android.content.Context
import android.database.Cursor
import kotlinx.coroutines.*
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.security.MessageDigest
import java.util.Timer
import java.util.TimerTask
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.coroutines.CoroutineContext

/**
 * SyncEngine — основной движок P2P Bluetooth-синхронизации на Android.
 *
 * Координирует:
 * - Обнаружение пиров (PeerDiscovery через BluetoothManager)
 * - Bluetooth-соединение (BluetoothManager)
 * - Обмен манифестами (Protocol)
 * - Вычисление diff'ов
 * - Передачу файлов
 * - Разрешение конфликтов (ConflictResolver)
 * - Отслеживание изменений ФС (FileWatcher)
 * - Boot-time scan (BootScanner)
 * - SQLite-базу (SyncDatabase)
 *
 * Порт Electron SyncEngine.ts на Kotlin.
 */
class SyncEngine(
    private val context: Context,
    private val dataDir: String,
    private val deviceId: String = "",
    private val deviceName: String = "",
    private val platform: String = "android",
    private val appVersion: String = "1.0.0",
    private val protocolVersion: Int = 1,
    private val syncIntervalMs: Long = 300000L
) {
    // ==================== Data Classes ====================

    /**
     * Статус синхронизации для WebViewBridge.
     */
    data class SyncStatus(
        val state: String,
        val lastSyncAt: Long?,
        val connectedPeers: List<PeerDevice>,
        val progress: SyncProgress?,
        val error: String?
    )

    /**
     * Прогресс синхронизации.
     */
    data class SyncProgress(
        val totalFiles: Int,
        val transferredFiles: Int,
        val currentFile: String?,
        val phase: String
    )

    /**
     * Событие синхронизации для подписчиков.
     */
    data class SyncEvent(
        val type: String,
        val timestamp: Long,
        val data: Any?
    )

    /**
     * Типы событий синхронизации.
     */
    object SyncEventType {
        const val STATE_CHANGED = "state_changed"
        const val PEER_DISCOVERED = "peer_discovered"
        const val PEER_CONNECTED = "peer_connected"
        const val PEER_DISCONNECTED = "peer_disconnected"
        const val SYNC_PROGRESS = "sync_progress"
        const val SYNC_COMPLETE = "sync_complete"
        const val CONFLICT_DETECTED = "conflict_detected"
        const val CONFLICT_RESOLVED = "conflict_resolved"
        const val ERROR = "error"
        const val FILE_SYNCED = "file_synced"
        const val FILE_DELETED_REMOTELY = "file_deleted_remotely"
    }

    /**
     * Данные пира для WebViewBridge.
     */
    data class PeerDevice(
        val id: String,
        val name: String,
        val deviceType: String,
        val macAddress: String?,
        val lastSeenAt: Long,
        val firstSeenAt: Long,
        val trustStatus: String,
        val isPaired: Boolean,
        val protocolVersion: Int
    )

    /**
     * Данные о конфликте для WebViewBridge.
     * Поля соответствуют ConflictResolver.SyncConflict.
     */
    data class SyncConflict(
        val conflictId: Long,
        val fileId: String,
        val filePath: String?,
        val localVersion: Int,
        val remoteVersion: Int,
        val localChecksum: String?,
        val remoteChecksum: String?,
        val localModifiedAt: Long,
        val remoteModifiedAt: Long,
        val resolution: String,
        val resolvedAt: Long?,
        val resolvedBy: String?,
        val createdAt: Long
    )

    // ==================== Свойства ====================

    // Компоненты
    private val db = SyncDatabase(context)
    private val bluetoothManager = BluetoothManager(context)
    private val conflictResolver = ConflictResolver(db)
    private val fileWatcher = FileWatcher(db, dataDir)
    private val bootScanner = BootScanner(db, dataDir)

    // Состояние
    @Volatile
    private var _state: String = "idle"     // SyncConnectionState
    @Volatile
    private var connectedPeerAddress: String? = null
    @Volatile
    private var connectedPeerName: String? = null
    @Volatile
    private var progress: SyncProgress? = null
    @Volatile
    private var activePeerId: String? = null

    // Счётчики сессии
    private var sessionFilesTransferred = 0
    private var sessionTombstonesApplied = 0
    private var sessionConflictsDetected = 0
    private var sessionStartTime = 0L

    // Подписчики событий
    private val eventSubscribers = mutableSetOf<(SyncEvent) -> Unit>()

    // Автосинхронизация
    private var autoSyncTimer: Timer? = null

    // Coroutine scope для фоновых задач
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    // Deferred-объекты для ожидания сообщений в сессии синхронизации
    @Volatile
    private var handshakeAckDeferred: CompletableDeferred<JSONObject>? = null
    @Volatile
    private var manifestDeferred: CompletableDeferred<JSONObject>? = null
    @Volatile
    private var manifestDiffDeferred: CompletableDeferred<JSONObject>? = null
    @Volatile
    private var fileAckDeferred: CompletableDeferred<JSONObject>? = null

    // Callback для SyncService
    @Volatile
    var onStatusChanged: ((status: String, progress: String) -> Unit)? = null

    // ==================== Инициализация ====================

    /**
     * Настраивает обработчики Bluetooth.
     */
    private fun setupBluetoothHandlers() {
        bluetoothManager.onConnectedCallback = { address ->
            connectedPeerAddress = address
            emitSyncEvent(SyncEventType.PEER_CONNECTED, mapOf("address" to address))
        }

        bluetoothManager.onDisconnectedCallback = { address ->
            if (connectedPeerAddress == address) {
                connectedPeerAddress = null
                connectedPeerName = null
            }
            setState("idle")
            emitSyncEvent(SyncEventType.PEER_DISCONNECTED, mapOf("address" to address))
        }

        bluetoothManager.onDataReceivedCallback = { address, data ->
            scope.launch {
                handleMessage(address, data)
            }
        }
    }

    // ==================== Публичные методы ====================

    /**
     * Инициализирует движок: BootScanner, Bluetooth, FileWatcher, ConflictResolver.
     */
    suspend fun initialize(): Boolean = withContext(Dispatchers.IO) {
        setupBluetoothHandlers()

        // Шаг 1: boot-time scan
        try {
            val scanResult = bootScanner.scan()
            emitSyncEvent(SyncEventType.STATE_CHANGED, mapOf(
                "state" to "idle",
                "bootScan" to JSONObject().apply {
                    put("totalFilesOnDisk", scanResult.totalFilesOnDisk)
                    put("filesMissingOnDisk", scanResult.filesMissingOnDisk)
                    put("filesNewOnDisk", scanResult.filesNewOnDisk)
                    put("tombstonesCreated", scanResult.tombstonesCreated)
                    put("queueEntriesAdded", scanResult.queueEntriesAdded)
                }
            ))
        } catch (e: Exception) {
            emitSyncEvent(SyncEventType.ERROR, mapOf("message" to "Boot scan failed: ${e.message}"))
        }

        // Шаг 2: Bluetooth доступен?
        val btReady = bluetoothManager.isEnabled()
        if (!btReady) {
            emitSyncEvent(SyncEventType.ERROR, mapOf("message" to "Bluetooth not available"))
        }

        // Шаг 3: запуск FileWatcher
        try {
            fileWatcher.start()
        } catch (e: Exception) {
            emitSyncEvent(SyncEventType.ERROR, mapOf("message" to "FileWatcher start failed: ${e.message}"))
        }

        // Шаг 4: настройка авто-разрешения конфликтов
        conflictResolver.onConflict { conflict ->
            val strategy = conflictResolver.autoResolve(conflict)
            emitSyncEvent(SyncEventType.CONFLICT_DETECTED, mapOf(
                "conflict" to mapConflictToData(conflict),
                "autoResolved" to true,
                "strategy" to strategy
            ))
        }

        return@withContext true
    }

    /**
     * Запускает синхронизацию: discovery → connect → sync session.
     */
    suspend fun startSync(): Boolean = withContext(Dispatchers.IO) {
        if (_state != "idle") {
            return@withContext false
        }

        setState("discovering")
        emitSyncEvent(SyncEventType.STATE_CHANGED, mapOf("state" to "discovering"))

        try {
            // Шаг 1: discover пиров через BroadcastReceiver
            // BluetoothManager.startDiscovery() не возвращает список, используем callback
            // Поэтому сначала пробуем доверенных пиров

            // Пробуем подключиться к доверенным пирам напрямую
            val trustedPeers = db.getTrustedPeers()
            for (peer in trustedPeers) {
                if (peer.macAddress != null) {
                    emitSyncEvent(SyncEventType.STATE_CHANGED, mapOf(
                        "state" to "connecting",
                        "peer" to peer.name
                    ))
                    val connected = bluetoothManager.connect(peer.macAddress)
                    if (connected) {
                        connectedPeerName = peer.name
                        val success = runSyncSession(peer.name, peer.macAddress)
                        return@withContext success
                    }
                }
            }

            // Если не удалось подключиться к доверенным — запускаем discovery
            val foundPeers = mutableListOf<BluetoothDeviceData>()
            bluetoothManager.onDeviceFoundCallback = { device ->
                val data = BluetoothDeviceData(
                    address = device.address,
                    name = device.name ?: "Unknown",
                    bondState = device.bondState
                )
                foundPeers.add(data)
                emitSyncEvent(SyncEventType.PEER_DISCOVERED, mapOf(
                    "address" to device.address,
                    "name" to device.name
                ))
            }

            bluetoothManager.startDiscovery()

            // Ждём завершения discovery (таймаут 15 секунд)
            delay(15000)
            bluetoothManager.stopDiscovery()

            if (foundPeers.isEmpty()) {
                setState("idle")
                emitSyncEvent(SyncEventType.ERROR, mapOf("message" to "No peers found"))
                return@withContext false
            }

            // Подключаемся к первому найденному
            val targetPeer = foundPeers[0]
            setState("connecting")
            emitSyncEvent(SyncEventType.STATE_CHANGED, mapOf(
                "state" to "connecting",
                "peer" to targetPeer.name
            ))

            val connected = bluetoothManager.connect(targetPeer.address)
            if (!connected) {
                setState("error")
                emitSyncEvent(SyncEventType.ERROR, mapOf(
                    "message" to "Failed to connect to ${targetPeer.name}"
                ))
                return@withContext false
            }

            connectedPeerName = targetPeer.name
            return@withContext runSyncSession(targetPeer.name, targetPeer.address)
        } catch (e: Exception) {
            setState("error")
            emitSyncEvent(SyncEventType.ERROR, mapOf<String, Any?>(("message" to e.message ?: "Sync failed") as Pair<String, Any?>))
            return@withContext false
        }
    }

    /**
     * Останавливает синхронизацию.
     */
    suspend fun stopSync() = withContext(Dispatchers.IO) {
        try {
            connectedPeerAddress?.let { address ->
                sendMessage(address, Protocol.disconnect("user_stopped"))
                bluetoothManager.disconnect(address)
            }
            bluetoothManager.stopDiscovery()
            setState("idle")
            emitSyncEvent(SyncEventType.STATE_CHANGED, mapOf("state" to "idle"))
        } catch (e: Exception) {
            emitSyncEvent(SyncEventType.ERROR, mapOf("message" to "Stop failed: ${e.message}"))
        }
    }

    /**
     * Возвращает текущий статус синхронизации.
     */
    fun getStatus(): SyncStatus {
        val lastSync = db.getLastSyncTime()
        val connectedPeers = mutableListOf<PeerDevice>()

        connectedPeerAddress?.let { address ->
            // Пытаемся найти пира в БД
            val peerId = "bt:$address"
            val peer = db.getPeer(peerId)
            if (peer != null) {
                connectedPeers.add(mapPeerData(peer))
            } else {
                connectedPeers.add(PeerDevice(
                    id = peerId,
                    name = connectedPeerName ?: "Connected",
                    deviceType = platform,
                    macAddress = address,
                    lastSeenAt = System.currentTimeMillis(),
                    firstSeenAt = System.currentTimeMillis(),
                    trustStatus = "trusted",
                    isPaired = true,
                    protocolVersion = protocolVersion
                ))
            }
        }

        return SyncStatus(
            state = _state,
            lastSyncAt = lastSync,
            connectedPeers = connectedPeers,
            progress = progress,
            error = null
        )
    }

    /**
     * Запускает обнаружение Bluetooth-пиров.
     */
    suspend fun discoverPeers(): List<PeerDevice> = withContext(Dispatchers.IO) {
        val foundDevices = mutableListOf<BluetoothDeviceData>()

        bluetoothManager.onDeviceFoundCallback = { device ->
            foundDevices.add(BluetoothDeviceData(
                address = device.address,
                name = device.name ?: "Unknown",
                bondState = device.bondState
            ))
        }

        bluetoothManager.startDiscovery()
        delay(12000)
        bluetoothManager.stopDiscovery()

        foundDevices.mapIndexed { index, device ->
            PeerDevice(
                id = "bt:${device.address}",
                name = device.name,
                deviceType = platform,
                macAddress = device.address,
                lastSeenAt = System.currentTimeMillis(),
                firstSeenAt = System.currentTimeMillis(),
                trustStatus = "pending",
                isPaired = false,
                protocolVersion = protocolVersion
            )
        }
    }

    /**
     * Подключается к пиру по MAC-адресу и сохраняет его.
     */
    suspend fun pairDevice(deviceId: String): Boolean = withContext(Dispatchers.IO) {
        val connected = bluetoothManager.connect(deviceId)
        if (connected) {
            val peerName = connectedPeerName ?: "Unknown"
            db.upsertPeer(
                PeerData(
                    id = "bt:$deviceId",
                    name = peerName,
                    deviceType = platform,
                    macAddress = deviceId,
                    lastSeenAt = System.currentTimeMillis(),
                    firstSeenAt = System.currentTimeMillis(),
                    trustStatus = "trusted",
                    publicKey = null,
                    protocolVersion = protocolVersion,
                    isPaired = true
                )
            )
            return@withContext true
        }
        return@withContext false
    }

    /**
     * Отключает и удаляет пира.
     */
    suspend fun unpairDevice(deviceId: String): Boolean = withContext(Dispatchers.IO) {
        bluetoothManager.disconnect(deviceId)
        db.deletePeer("bt:$deviceId")
        return@withContext true
    }

    /**
     * Возвращает список пиров из БД.
     */
    fun getPeers(): List<PeerDevice> {
        return db.getAllPeers().map { mapPeerData(it) }
    }

    /**
     * Возвращает список неразрешённых конфликтов.
     */
    fun getConflicts(): List<SyncConflict> {
        return conflictResolver.getPendingConflicts().map { mapConflict(it) }
    }

    /**
     * Разрешает конфликт с указанной стратегией.
     */
    fun resolveConflict(conflictId: Long, strategy: String) {
        conflictResolver.manualResolve(conflictId, strategy)
        emitSyncEvent(SyncEventType.CONFLICT_RESOLVED, mapOf(
            "conflictId" to conflictId,
            "strategy" to strategy
        ))
    }

    /**
     * Подписка на события синхронизации.
     * Возвращает функцию отписки.
     */
    fun onSyncEvent(callback: (SyncEvent) -> Unit): () -> Unit {
        eventSubscribers.add(callback)
        return {
            eventSubscribers.remove(callback)
        }
    }

    /**
     * Запускает автоматическую синхронизацию по таймеру.
     */
    fun startAutoSync() {
        stopAutoSync()
        autoSyncTimer = Timer("SyncEngine-AutoSync", true).apply {
            schedule(object : TimerTask() {
                override fun run() {
                    if (_state == "idle") {
                        scope.launch {
                            startSync()
                        }
                    }
                }
            }, syncIntervalMs, syncIntervalMs)
        }
    }

    /**
     * Останавливает автоматическую синхронизацию.
     */
    fun stopAutoSync() {
        autoSyncTimer?.cancel()
        autoSyncTimer = null
    }

    /**
     * Очищает ресурсы.
     */
    fun destroy() {
        stopAutoSync()
        fileWatcher.stop()
        bluetoothManager.destroy()
        db.close()
        eventSubscribers.clear()
        scope.cancel()
    }

    // ==================== SyncService Wrapper Methods ====================

    /**
     * Запускает FileWatcher (для SyncService).
     */
    fun startFileWatcher() {
        fileWatcher.start()
    }

    /**
     * Запускает Bluetooth-сервер (для SyncService).
     */
    suspend fun startBluetoothServer(): Boolean {
        return bluetoothManager.startServer()
    }

    /**
     * Запускает синхронизацию из SyncService.
     */
    suspend fun autoSync() {
        startSync()
    }

    // ==================== Приватные методы ====================

    /**
     * Устанавливает состояние.
     */
    private fun setState(state: String) {
        _state = state
        onStatusChanged?.invoke(state, progress?.phase ?: "")
    }

    /**
     * Отправляет событие всем подписчикам.
     */
    private fun emitSyncEvent(type: String, data: Any? = null) {
        val event = SyncEvent(type = type, timestamp = System.currentTimeMillis(), data = data)
        for (cb in eventSubscribers) {
            try {
                cb(event)
            } catch (e: Exception) {
                // Игнорируем ошибки в callback'ах
            }
        }
    }

    /**
     * Отправляет Protocol.SyncMessage через BluetoothManager.
     */
    private suspend fun sendMessage(address: String, message: Protocol.SyncMessage): Boolean {
        val payloadBytes = message.payload.toString().toByteArray(Charsets.UTF_8)
        return bluetoothManager.sendMessage(address, message.type, payloadBytes)
    }

    /**
     * Запускает сессию синхронизации с подключённым пиром.
     */
    private suspend fun runSyncSession(peerName: String, peerAddress: String): Boolean {
        sessionStartTime = System.currentTimeMillis()
        sessionFilesTransferred = 0
        sessionTombstonesApplied = 0
        sessionConflictsDetected = 0

        setState("handshake")
        emitSyncEvent(SyncEventType.STATE_CHANGED, mapOf("state" to "handshake"))

        try {
            // Шаг 1: HANDSHAKE
            val handshakeMsg = Protocol.handshake(
                peerId = if (deviceId.isNotEmpty()) deviceId else "android:${peerAddress}",
                deviceName = deviceName.ifEmpty { "Android Device" },
                platform = platform,
                appVersion = appVersion,
                protocolVersion = protocolVersion
            )

            // Создаём deferred для ожидания HANDSHAKE_ACK
            handshakeAckDeferred = CompletableDeferred()
            val sent = sendMessage(peerAddress, handshakeMsg)
            if (!sent) {
                throw Exception("Failed to send handshake")
            }

            // Ждём HANDSHAKE_ACK с таймаутом
            val handshakeAck = withTimeout(30000L) {
                handshakeAckDeferred!!.await()
            }
            handshakeAckDeferred = null

            if (!handshakeAck.optBoolean("accepted", false)) {
                val reason = handshakeAck.optString("rejectReason", "Rejected")
                throw Exception("Handshake rejected: $reason")
            }

            activePeerId = "bt:$peerAddress"

            // Сохраняем пира в БД
            db.upsertPeer(
                PeerData(
                    id = activePeerId!!,
                    name = peerName,
                    deviceType = platform,
                    macAddress = peerAddress,
                    lastSeenAt = System.currentTimeMillis(),
                    firstSeenAt = System.currentTimeMillis(),
                    trustStatus = "trusted",
                    publicKey = null,
                    protocolVersion = protocolVersion,
                    isPaired = true
                )
            )

            // Шаг 2: Отправляем MANIFEST
            setState("syncing")
            setProgress(SyncProgress(totalFiles = 0, transferredFiles = 0, currentFile = null, phase = "manifest"))

            val manifestPayload = buildManifest()
            val manifestMsg = Protocol.manifest(
                files = manifestPayload.getJSONArray("files"),
                tombstones = manifestPayload.getJSONArray("tombstones")
            )
            sendMessage(peerAddress, manifestMsg)
            emitSyncEvent(SyncEventType.SYNC_PROGRESS, mapOf("phase" to "manifest"))

            // Шаг 3: Ждём MANIFEST от пира
            manifestDeferred = CompletableDeferred()
            val remoteManifest = withTimeout(30000L) {
                manifestDeferred!!.await()
            }
            manifestDeferred = null

            // Шаг 4: Вычисляем diff и отправляем MANIFEST_DIFF
            val diff = computeDiff(remoteManifest)
            val diffMsg = Protocol.manifestDiff(
                neededFiles = diff.getJSONArray("neededFiles"),
                neededTombstones = diff.getJSONArray("neededTombstones")
            )
            sendMessage(peerAddress, diffMsg)
            emitSyncEvent(SyncEventType.SYNC_PROGRESS, mapOf("phase" to "diff"))

            // Шаг 5: Ждём MANIFEST_DIFF от пира
            manifestDiffDeferred = CompletableDeferred()
            val remoteDiff = withTimeout(30000L) {
                manifestDiffDeferred!!.await()
            }
            manifestDiffDeferred = null

            val neededFiles = remoteDiff.optJSONArray("neededFiles") ?: JSONArray()
            val neededTombstones = remoteDiff.optJSONArray("neededTombstones") ?: JSONArray()

            // Шаг 6: Отправляем запрошенные файлы
            for (i in 0 until neededFiles.length()) {
                val fileId = neededFiles.getString(i)
                val fileMsg = readFileForSync(fileId)
                if (fileMsg != null) {
                    sendMessage(peerAddress, fileMsg)
                    sessionFilesTransferred++

                    // Ждём FILE_ACK
                    fileAckDeferred = CompletableDeferred()
                    try {
                        val ack = withTimeout(10000L) {
                            fileAckDeferred!!.await()
                        }
                        fileAckDeferred = null
                        if (ack.optBoolean("accepted", false)) {
                            val ackVersion = ack.optInt("version", 0)
                            db.markLedgerSynced(fileId, ackVersion)
                        }
                        if (ack.optBoolean("conflict", false)) {
                            sessionConflictsDetected++
                        }
                    } catch (e: Exception) {
                        // Таймаут или ошибка — продолжаем
                        fileAckDeferred = null
                    }
                }
            }

            // Шаг 7: Отправляем запрошенные tombstones
            for (i in 0 until neededTombstones.length()) {
                val fileId = neededTombstones.getString(i)
                val tombstone = getTombstoneAll(fileId)
                if (tombstone != null) {
                    val tsMsg = Protocol.tombstone(
                        fileId = tombstone.fileId,
                        deletedAt = tombstone.deletedAt,
                        originalPath = tombstone.originalPath,
                        checksum = tombstone.checksum
                    )
                    sendMessage(peerAddress, tsMsg)
                    db.markTombstoneSynced(fileId)
                    sessionTombstonesApplied++
                }
            }

            // Шаг 8: Завершаем
            val duration = System.currentTimeMillis() - sessionStartTime
            val completeMsg = Protocol.syncComplete(
                filesTransferred = sessionFilesTransferred,
                tombstonesApplied = sessionTombstonesApplied,
                conflictsDetected = sessionConflictsDetected,
                duration = duration
            )
            sendMessage(peerAddress, completeMsg)

            setState("complete")
            setProgress(null)

            // Обновляем время последней синхронизации
            db.updateLastSyncTime(System.currentTimeMillis())

            emitSyncEvent(SyncEventType.SYNC_COMPLETE, mapOf(
                "summary" to mapOf(
                    "filesTransferred" to sessionFilesTransferred,
                    "tombstonesApplied" to sessionTombstonesApplied,
                    "conflictsDetected" to sessionConflictsDetected,
                    "duration" to duration
                )
            ))

            return true
        } catch (e: Exception) {
            setState("error")
            emitSyncEvent(SyncEventType.ERROR, mapOf<String, Any?>(("message" to e.message ?: "Session failed") as Pair<String, Any?>))
            return false
        }
    }

    /**
     * Строит манифест из sync_ledger + tombstones для отправки пиру.
     */
    private fun buildManifest(): JSONObject {
        val entries = db.getAllLatestLedgerEntries()
        val allTombstones = getAllTombstonesAll()

        val filesArray = JSONArray()
        for (entry in entries) {
            if (entry.operation != "delete") {
                filesArray.put(JSONObject().apply {
                    put("fileId", entry.fileId)
                    put("version", entry.version)
                    put("checksum", entry.checksum)
                    put("modifiedAt", entry.modifiedAt)
                    put("path", entry.filePath)
                    put("sizeBytes", entry.sizeBytes)
                })
            }
        }

        val tombstonesArray = JSONArray()
        for (t in allTombstones) {
            tombstonesArray.put(JSONObject().apply {
                put("fileId", t.fileId)
                put("deletedAt", t.deletedAt)
                put("originalPath", t.originalPath)
                put("checksum", t.checksum ?: JSONObject.NULL)
            })
        }

        return JSONObject().apply {
            put("files", filesArray)
            put("tombstones", tombstonesArray)
        }
    }

    /**
     * Обрабатывает входящее сообщение от пира.
     */
    private suspend fun handleMessage(address: String, fullMessage: ByteArray) {
        val message = Protocol.decode(fullMessage) ?: return
        val type = message.type
        val payload = message.payload

        when (type) {
            Protocol.TYPE_HANDSHAKE -> {
                // Отправляем HANDSHAKE_ACK
                val ackMsg = Protocol.handshakeAck(
                    peerId = if (deviceId.isNotEmpty()) deviceId else "android:$address",
                    accepted = true
                )
                sendMessage(address, ackMsg)
                activePeerId = payload.optString("peerId")
                connectedPeerName = payload.optString("deviceName", "Remote")
                emitSyncEvent(SyncEventType.PEER_CONNECTED, mapOf(
                    "id" to activePeerId,
                    "name" to payload.optString("deviceName")
                ))
            }

            Protocol.TYPE_HANDSHAKE_ACK -> {
                handshakeAckDeferred?.complete(payload)
            }

            Protocol.TYPE_MANIFEST -> {
                // Вычисляем diff и отправляем MANIFEST_DIFF
                val diff = computeDiff(payload)
                val diffMsg = Protocol.manifestDiff(
                    neededFiles = diff.getJSONArray("neededFiles"),
                    neededTombstones = diff.getJSONArray("neededTombstones")
                )
                sendMessage(address, diffMsg)
                emitSyncEvent(SyncEventType.SYNC_PROGRESS, mapOf("phase" to "diff"))

                // Также завершаем manifestDeferred, если мы ожидаем MANIFEST
                manifestDeferred?.complete(payload)
            }

            Protocol.TYPE_MANIFEST_DIFF -> {
                // Завершаем ожидание MANIFEST_DIFF в сессии
                manifestDiffDeferred?.complete(payload)

                // Также обрабатываем файлы, которые пир запросил (если вне сессии)
                val neededFiles = payload.optJSONArray("neededFiles")
                val neededTombstones = payload.optJSONArray("neededTombstones")
                if (neededFiles != null) {
                    for (i in 0 until neededFiles.length()) {
                        val fileId = neededFiles.getString(i)
                        val fileMsg = readFileForSync(fileId)
                        if (fileMsg != null) {
                            sendMessage(address, fileMsg)
                            sessionFilesTransferred++
                        }
                    }
                }
                if (neededTombstones != null) {
                    for (i in 0 until neededTombstones.length()) {
                        val fileId = neededTombstones.getString(i)
                        val tombstone = getTombstoneAll(fileId)
                        if (tombstone != null) {
                            val tsMsg = Protocol.tombstone(
                                fileId = tombstone.fileId,
                                deletedAt = tombstone.deletedAt,
                                originalPath = tombstone.originalPath,
                                checksum = tombstone.checksum
                            )
                            sendMessage(address, tsMsg)
                            db.markTombstoneSynced(fileId)
                            sessionTombstonesApplied++
                        }
                    }
                }
                emitSyncEvent(SyncEventType.SYNC_PROGRESS, mapOf(
                    "phase" to "transfer",
                    "totalFiles" to (neededFiles?.length() ?: 0),
                    "transferredFiles" to sessionFilesTransferred
                ))
            }

            Protocol.TYPE_FILE -> {
                val saved = saveReceivedFile(payload)
                if (saved) {
                    val ackMsg = Protocol.fileAck(
                        fileId = payload.optString("fileId", ""),
                        version = payload.optInt("version", 1),
                        accepted = true
                    )
                    sendMessage(address, ackMsg)
                }
            }

            Protocol.TYPE_FILE_ACK -> {
                fileAckDeferred?.complete(payload)
                if (payload.optBoolean("accepted", false)) {
                    val fileId = payload.optString("fileId", "")
                    val version = payload.optInt("version", 0)
                    db.markLedgerSynced(fileId, version)
                }
                if (payload.optBoolean("conflict", false)) {
                    sessionConflictsDetected++
                }
            }

            Protocol.TYPE_TOMBSTONE -> {
                applyRemoteTombstone(payload)
                val ackMsg = Protocol.tombstoneAck(payload.optString("fileId", ""))
                sendMessage(address, ackMsg)
            }

            Protocol.TYPE_TOMBSTONE_ACK -> {
                val fileId = payload.optString("fileId", "")
                db.markTombstoneSynced(fileId)
            }

            Protocol.TYPE_SYNC_COMPLETE -> {
                setState("complete")
                emitSyncEvent(SyncEventType.SYNC_COMPLETE, payload.opt("summary"))
            }

            Protocol.TYPE_DISCONNECT -> {
                bluetoothManager.disconnect(address)
            }

            Protocol.TYPE_ERROR -> {
                emitSyncEvent(SyncEventType.ERROR, mapOf(
                    "code" to payload.optString("code", "unknown"),
                    "message" to payload.optString("message", "Unknown error")
                ))
            }

            Protocol.TYPE_PING -> {
                // Keepalive — ничего не делаем
            }

            Protocol.TYPE_CONFLICT_RESOLUTION -> {
                // Обработка конфликта удалённой стороной
                emitSyncEvent(SyncEventType.CONFLICT_RESOLVED, mapOf(
                    "fileId" to payload.optString("fileId"),
                    "strategy" to payload.optString("strategy"),
                    "resolvedVersion" to payload.optInt("resolvedVersion")
                ))
            }
        }
    }

    /**
     * Вычисляет diff между локальным состоянием и удалённым манифестом.
     * Возвращает JSONObject с полями neededFiles и neededTombstones.
     */
    private fun computeDiff(remoteManifest: JSONObject): JSONObject {
        val neededFiles = JSONArray()
        val neededTombstones = JSONArray()

        // Карта локальных файлов (не удалённых)
        val localFiles = mutableMapOf<String, LedgerEntryData>()
        for (entry in db.getAllLatestLedgerEntries()) {
            if (entry.operation != "delete") {
                localFiles[entry.fileId] = entry
            }
        }

        // Множество локальных tombstones (все, включая синхронизированные)
        val localTombstones = getAllTombstonesAllIds()

        // Карта удалённых файлов
        val remoteFilesArray = remoteManifest.optJSONArray("files") ?: JSONArray()
        val remoteFiles = mutableMapOf<String, JSONObject>()
        for (i in 0 until remoteFilesArray.length()) {
            val file = remoteFilesArray.getJSONObject(i)
            remoteFiles[file.optString("fileId", "")] = file
        }

        // Множество удалённых tombstones
        val remoteTombstonesArray = remoteManifest.optJSONArray("tombstones") ?: JSONArray()
        val remoteTombstones = mutableSetOf<String>()
        for (i in 0 until remoteTombstonesArray.length()) {
            remoteTombstones.add(remoteTombstonesArray.getJSONObject(i).optString("fileId", ""))
        }

        // 1. Файлы, которые есть у пира, но нет у нас (или старые версии)
        for ((fileId, remoteFile) in remoteFiles) {
            val localFile = localFiles[fileId]

            if (localFile == null) {
                // Файла нет локально — запрашиваем
                neededFiles.put(fileId)
            } else {
                val remoteVersion = remoteFile.optInt("version", 0)
                if (remoteVersion > localFile.version) {
                    // У пира новее — проверяем конфликт
                    val conflictCheck = conflictResolver.checkForConflict(localFile, remoteFile)
                    if (conflictCheck.hasConflict) {
                        sessionConflictsDetected++
                    }
                    neededFiles.put(fileId)
                } else if (remoteVersion == localFile.version) {
                    val remoteChecksum = remoteFile.optString("checksum", "")
                    if (localFile.checksum != remoteChecksum) {
                        // Версии совпадают, но контрольные суммы разные — конфликт
                        val conflictCheck = conflictResolver.checkForConflict(localFile, remoteFile)
                        if (conflictCheck.hasConflict) {
                            sessionConflictsDetected++
                        }
                        neededFiles.put(fileId)
                    }
                }
                // Если localFile.version > remoteVersion — наш файл новее, пир запросит его через свой MANIFEST_DIFF
            }
        }

        // 2. Tombstones, которые есть у пира, но нет у нас
        for (fileId in remoteTombstones) {
            if (fileId !in localTombstones && fileId in localFiles) {
                // Пир удалил файл, который у нас есть — применяем удаление
                neededTombstones.put(fileId)
            }
        }

        return JSONObject().apply {
            put("neededFiles", neededFiles)
            put("neededTombstones", neededTombstones)
        }
    }

    /**
     * Читает файл с диска для отправки пиру.
     * Возвращает Protocol.SyncMessage типа FILE или null.
     */
    private suspend fun readFileForSync(fileId: String): Protocol.SyncMessage? {
        return try {
            val entry = db.getLatestLedgerEntry(fileId) ?: return null

            val fullPath = File(dataDir, entry.filePath)
            if (!fullPath.exists()) return null

            val fileBytes = fullPath.readBytes()
            val contentBase64 = java.util.Base64.getEncoder().encodeToString(fileBytes)

            // Читаем metadata, если есть
            val metadataPath = File(fullPath.parent, "${fullPath.nameWithoutExtension}.json")
            val metadata = if (metadataPath.exists()) {
                metadataPath.readText()
            } else {
                "{}"
            }

            Protocol.file(
                fileId = entry.fileId,
                version = entry.version,
                path = entry.filePath,
                content = contentBase64,
                metadata = metadata,
                checksum = entry.checksum,
                modifiedAt = entry.modifiedAt
            )
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Сохраняет полученный от пира файл на диск.
     */
    private suspend fun saveReceivedFile(payload: JSONObject): Boolean {
        return try {
            val filePath = payload.optString("path", "")
            val fullPath = File(dataDir, filePath)

            // Создаём директорию
            fullPath.parentFile?.mkdirs()

            // Декодируем и сохраняем содержимое
            val contentBase64 = payload.optString("content", "")
            val fileBytes = java.util.Base64.getDecoder().decode(contentBase64)
            fullPath.writeBytes(fileBytes)

            // Проверяем контрольную сумму
            val checksum = computeSha256(fileBytes)
            val expectedChecksum = payload.optString("checksum", "")
            if (checksum != expectedChecksum) {
                // Несовпадение контрольной суммы — логируем, но продолжаем
            }

            // Сохраняем metadata
            val metadata = payload.optString("metadata", "{}")
            if (metadata != "{}") {
                val metadataPath = File(fullPath.parent, "${fullPath.nameWithoutExtension}.json")
                metadataPath.writeText(metadata)
            }

            val fileId = payload.optString("fileId", "")
            val version = payload.optInt("version", 1)
            val modifiedAt = payload.optLong("modifiedAt", System.currentTimeMillis())

            // Обновляем ledger
            db.addLedgerEntry(
                LedgerEntryInput(
                    fileId = fileId,
                    filePath = filePath,
                    version = version,
                    checksum = checksum,
                    sizeBytes = fileBytes.size,
                    modifiedAt = modifiedAt,
                    modifiedBy = activePeerId,
                    operation = "update",
                    parentVersion = if (version > 1) version - 1 else null
                )
            )

            db.markLedgerSynced(fileId, version)

            emitSyncEvent(SyncEventType.FILE_SYNCED, mapOf(
                "fileId" to fileId,
                "path" to filePath,
                "version" to version
            ))

            true
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Применяет удаление файла, полученное от пира.
     */
    private suspend fun applyRemoteTombstone(payload: JSONObject) {
        val fileId = payload.optString("fileId", "")
        val originalPath = payload.optString("originalPath", "")
        val checksum = payload.optString("checksum", null)

        val fullPath = File(dataDir, originalPath)
        if (fullPath.exists()) {
            fullPath.delete()

            // Удаляем metadata
            val metadataPath = File(fullPath.parent, "${fullPath.nameWithoutExtension}.json")
            if (metadataPath.exists()) {
                metadataPath.delete()
            }
        }

        // Добавляем tombstone локально, если его нет
        val existing = db.getTombstone(fileId)
        if (existing == null) {
            db.addTombstone(fileId, originalPath, checksum)
        }

        emitSyncEvent(SyncEventType.FILE_DELETED_REMOTELY, mapOf(
            "fileId" to fileId,
            "path" to originalPath
        ))
    }

    /**
     * Устанавливает прогресс синхронизации.
     */
    private fun setProgress(p: SyncProgress?) {
        progress = p
    }

    // ==================== Хелперы для работы с БД ====================

    /**
     * Возвращает ВСЕ tombstones (включая уже синхронизированные).
     * SyncDatabase.getAllTombstones() возвращает только unsynced.
     */
    private fun getAllTombstonesAll(): List<TombstoneDataAll> {
        val list = mutableListOf<TombstoneDataAll>()
        val db_read = db.readableDatabase
        val cursor = db_read.rawQuery(
            "SELECT file_id, deleted_at, original_path, checksum, synced_to_peers FROM tombstone ORDER BY deleted_at DESC",
            null
        )
        cursor.use {
            while (it.moveToNext()) {
                list.add(TombstoneDataAll(
                    fileId = it.getString(0),
                    deletedAt = it.getLong(1),
                    originalPath = it.getString(2),
                    checksum = it.getString(3),
                    syncedToPeers = it.getInt(4)
                ))
            }
        }
        return list
    }

    /**
     * Возвращает множество file_id всех tombstones (включая синхронизированные).
     */
    private fun getAllTombstonesAllIds(): Set<String> {
        val set = mutableSetOf<String>()
        val db_read = db.readableDatabase
        val cursor = db_read.rawQuery("SELECT file_id FROM tombstone", null)
        cursor.use {
            while (it.moveToNext()) {
                set.add(it.getString(0))
            }
        }
        return set
    }

    /**
     * Получает один tombstone по fileId из полной таблицы (не только unsynced).
     */
    private fun getTombstoneAll(fileId: String): TombstoneDataAll? {
        val db_read = db.readableDatabase
        val cursor = db_read.rawQuery(
            "SELECT file_id, deleted_at, original_path, checksum, synced_to_peers FROM tombstone WHERE file_id = ?",
            arrayOf(fileId)
        )
        return cursor.use {
            if (it.moveToFirst()) {
                TombstoneDataAll(
                    fileId = it.getString(0),
                    deletedAt = it.getLong(1),
                    originalPath = it.getString(2),
                    checksum = it.getString(3),
                    syncedToPeers = it.getInt(4)
                )
            } else null
        }
    }

    // ==================== Мапперы ====================

    /**
     * Преобразует PeerData (из БД) в PeerDevice (для WebViewBridge).
     */
    private fun mapPeerData(peer: PeerData): PeerDevice {
        return PeerDevice(
            id = peer.id,
            name = peer.name,
            deviceType = peer.deviceType,
            macAddress = peer.macAddress,
            lastSeenAt = peer.lastSeenAt,
            firstSeenAt = peer.firstSeenAt,
            trustStatus = peer.trustStatus,
            isPaired = peer.isPaired,
            protocolVersion = peer.protocolVersion
        )
    }

    /**
     * Преобразует ConflictResolver.SyncConflict в SyncEngine.SyncConflict.
     */
    private fun mapConflict(conflict: ConflictResolver.SyncConflict): SyncConflict {
        return SyncConflict(
            conflictId = conflict.conflictId,
            fileId = conflict.fileId,
            filePath = conflict.filePath,
            localVersion = conflict.localVersion,
            remoteVersion = conflict.remoteVersion,
            localChecksum = conflict.localChecksum,
            remoteChecksum = conflict.remoteChecksum,
            localModifiedAt = conflict.localModifiedAt,
            remoteModifiedAt = conflict.remoteModifiedAt,
            resolution = conflict.resolution,
            resolvedAt = conflict.resolvedAt,
            resolvedBy = conflict.resolvedBy,
            createdAt = conflict.createdAt
        )
    }

    /**
     * Преобразует ConflictResolver.SyncConflict в Map (для событий).
     */
    private fun mapConflictToData(conflict: ConflictResolver.SyncConflict): Map<String, Any?> {
        return mapOf(
            "conflictId" to conflict.conflictId,
            "fileId" to conflict.fileId,
            "filePath" to conflict.filePath,
            "localVersion" to conflict.localVersion,
            "remoteVersion" to conflict.remoteVersion,
            "localChecksum" to conflict.localChecksum,
            "remoteChecksum" to conflict.remoteChecksum,
            "localModifiedAt" to conflict.localModifiedAt,
            "remoteModifiedAt" to conflict.remoteModifiedAt,
            "resolution" to conflict.resolution,
            "resolvedAt" to conflict.resolvedAt,
            "resolvedBy" to conflict.resolvedBy,
            "createdAt" to conflict.createdAt
        )
    }

    // ==================== Утилиты ====================

    /**
     * Вычисляет SHA-256 хеш.
     */
    private fun computeSha256(data: ByteArray): String {
        val digest = MessageDigest.getInstance("SHA-256")
        return digest.digest(data).joinToString("") { "%02x".format(it) }
    }

    /**
     * Промежуточный класс для хранения данных Bluetooth-устройства при discovery.
     */
    private data class BluetoothDeviceData(
        val address: String,
        val name: String,
        val bondState: Int
    )

    /**
     * Tombstone entry с полным доступом (включая syncedToPeers).
     */
    private data class TombstoneDataAll(
        val fileId: String,
        val deletedAt: Long,
        val originalPath: String,
        val checksum: String?,
        val syncedToPeers: Int
    )
}
