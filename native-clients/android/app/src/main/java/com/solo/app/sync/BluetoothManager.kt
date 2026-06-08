package com.solo.app.sync

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothServerSocket
import android.bluetooth.BluetoothSocket
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Handler
import android.os.Looper
import kotlinx.coroutines.*
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream
import java.nio.ByteBuffer
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean

/**
 * BluetoothManager для Android.
 *
 * Предоставляет:
 * - Сканирование устройств (BroadcastReceiver)
 * - Клиентские подключения (RFCOMM)
 * - Серверный сокет (приём входящих подключений)
 * - Фрейминг протокола (5-байтовый заголовок + payload)
 * - Колбэки onConnected, onDisconnected, onDataReceived, onConnectionFailed
 */
class BluetoothManager(private val context: Context) {
    companion object {
        // UUID сервиса Solo Sync
        val SOLO_SYNC_UUID: UUID = UUID.fromString("a1b2c3d4-e5f6-7890-abcd-ef1234567890")
        // Стандартный UUID SPP (для совместимости)
        val SPP_UUID: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")

        private const val BUFFER_SIZE = 4096
        private const val HEADER_SIZE = 5
        private const val SERVER_NAME = "SoloSync"
    }

    private val bluetoothAdapter: BluetoothAdapter? = BluetoothAdapter.getDefaultAdapter()
    private val activeConnections = ConcurrentHashMap<String, BluetoothSocket>()
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var serverSocket: BluetoothServerSocket? = null
    private var isListening = AtomicBoolean(false)

    // Колбэки
    var onDeviceFoundCallback: ((BluetoothDevice) -> Unit)? = null
    var onDiscoveryCompleteCallback: (() -> Unit)? = null
    var onDiscoveryFailedCallback: ((String) -> Unit)? = null
    var onConnectedCallback: ((address: String) -> Unit)? = null
    var onDisconnectedCallback: ((address: String) -> Unit)? = null
    var onConnectionFailedCallback: ((address: String, error: String) -> Unit)? = null
    var onDataReceivedCallback: ((address: String, data: ByteArray) -> Unit)? = null

    // BroadcastReceiver для обнаружения устройств
    private val discoveryReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            when (intent.action) {
                BluetoothDevice.ACTION_FOUND -> {
                    val device = intent.getParcelableExtra<BluetoothDevice>(BluetoothDevice.EXTRA_DEVICE)
                    if (device != null) {
                        onDeviceFoundCallback?.invoke(device)
                    }
                }
                BluetoothAdapter.ACTION_DISCOVERY_FINISHED -> {
                    onDiscoveryCompleteCallback?.invoke()
                }
            }
        }
    }

    /**
     * Проверяет, включён ли Bluetooth.
     */
    fun isEnabled(): Boolean = bluetoothAdapter?.isEnabled == true

    /**
     * Запрашивает включение Bluetooth.
     */
    fun enable(): Boolean {
        return bluetoothAdapter?.enable() ?: false
    }

    /**
     * Запускает сканирование устройств.
     */
    fun startDiscovery() {
        if (bluetoothAdapter?.isDiscovering == true) {
            bluetoothAdapter.cancelDiscovery()
        }

        // Регистрируем BroadcastReceiver
        val filter = IntentFilter().apply {
            addAction(BluetoothDevice.ACTION_FOUND)
            addAction(BluetoothAdapter.ACTION_DISCOVERY_FINISHED)
        }
        context.registerReceiver(discoveryReceiver, filter)

        bluetoothAdapter?.startDiscovery()
    }

    /**
     * Останавливает сканирование.
     */
    fun stopDiscovery() {
        bluetoothAdapter?.cancelDiscovery()
        try {
            context.unregisterReceiver(discoveryReceiver)
        } catch (_: IllegalArgumentException) {
            // Receiver не был зарегистрирован
        }
    }

    /**
     * Получает список спаренных устройств.
     */
    fun getBondedDevices(): List<BluetoothDevice> {
        return bluetoothAdapter?.bondedDevices?.toList() ?: emptyList()
    }

    // ==================== Клиентские подключения ====================

    /**
     * Подключается к удалённому устройству по RFCOMM.
     * Пробует SOLO_SYNC_UUID, при неудаче — SPP_UUID.
     */
    suspend fun connect(deviceAddress: String): Boolean = withContext(Dispatchers.IO) {
        try {
            val device = bluetoothAdapter?.getRemoteDevice(deviceAddress)
                ?: return@withContext false

            var socket: BluetoothSocket? = null

            // Пробуем наш кастомный UUID
            try {
                socket = device.createRfcommSocketToServiceRecord(SOLO_SYNC_UUID)
                socket.connect()
            } catch (_: IOException) {
                // Пробуем SPP UUID
                try {
                    socket?.close()
                } catch (_: Exception) {}
                try {
                    socket = device.createRfcommSocketToServiceRecord(SPP_UUID)
                    socket.connect()
                } catch (_: IOException) {
                    // Пробуем fallback через reflection
                    try {
                        socket?.close()
                    } catch (_: Exception) {}
                    socket = createRfcommSocketFallback(device)
                    socket?.connect()
                }
            }

            if (socket != null && socket.isConnected) {
                activeConnections[deviceAddress] = socket
                onConnectedCallback?.invoke(deviceAddress)
                startReading(deviceAddress, socket)
                return@withContext true
            }

            return@withContext false
        } catch (e: Exception) {
            onConnectionFailedCallback?.invoke(deviceAddress, e.message ?: "Unknown error")
            return@withContext false
        }
    }

    /**
     * Fallback-метод для создания RFCOMM-сокета через reflection.
     * Некоторые устройства не поддерживают стандартный createRfcommSocketToServiceRecord.
     */
    @Suppress("SwallowedException")
    private fun createRfcommSocketFallback(device: BluetoothDevice): BluetoothSocket? {
        return try {
            val method = device.javaClass.getMethod("createRfcommSocket", Int::class.java)
            method.invoke(device, 1) as BluetoothSocket
        } catch (_: Exception) {
            null
        }
    }

    /**
     * Отключается от устройства.
     */
    suspend fun disconnect(address: String) = withContext(Dispatchers.IO) {
        try {
            activeConnections[address]?.let { socket ->
                socket.close()
                activeConnections.remove(address)
                onDisconnectedCallback?.invoke(address)
            }
        } catch (e: IOException) {
            e.printStackTrace()
        }
    }

    /**
     * Отключается от всех устройств.
     */
    suspend fun disconnectAll() = withContext(Dispatchers.IO) {
        activeConnections.keys.toList().forEach { address ->
            disconnect(address)
        }
    }

    /**
     * Отправляет данные устройству.
     * Данные уже должны быть в формате протокола (заголовок + payload).
     */
    suspend fun send(address: String, data: ByteArray): Boolean = withContext(Dispatchers.IO) {
        try {
            val socket = activeConnections[address] ?: return@withContext false
            val outputStream: OutputStream = socket.outputStream
            outputStream.write(data)
            outputStream.flush()
            return@withContext true
        } catch (e: IOException) {
            e.printStackTrace()
            onDisconnectedCallback?.invoke(address)
            activeConnections.remove(address)
            return@withContext false
        }
    }

    /**
     * Отправляет сообщение в формате протокола (автоматически формирует заголовок).
     */
    suspend fun sendMessage(address: String, type: Int, payload: ByteArray): Boolean {
        val header = ByteBuffer.allocate(HEADER_SIZE).apply {
            put(type.toByte())
            putInt(payload.size)
        }.array()
        return send(address, header + payload)
    }

    // ==================== Серверный сокет ====================

    /**
     * Запускает серверный сокет для приёма входящих подключений.
     */
    suspend fun startServer(): Boolean = withContext(Dispatchers.IO) {
        try {
            serverSocket = bluetoothAdapter?.listenUsingRfcommWithServiceRecord(
                SERVER_NAME, SOLO_SYNC_UUID
            )
            if (serverSocket == null) return@withContext false

            isListening.set(true)
            scope.launch {
                acceptConnections()
            }
            return@withContext true
        } catch (e: IOException) {
            e.printStackTrace()
            return@withContext false
        }
    }

    /**
     * Останавливает серверный сокет.
     */
    suspend fun stopServer() = withContext(Dispatchers.IO) {
        isListening.set(false)
        try {
            serverSocket?.close()
        } catch (_: IOException) {}
        serverSocket = null
    }

    /**
     * Цикл принятия входящих подключений.
     */
    private suspend fun acceptConnections() {
        while (isListening.get()) {
            try {
                val socket = serverSocket?.accept()
                if (socket != null) {
                    val address = socket.remoteDevice.address
                    activeConnections[address] = socket
                    onConnectedCallback?.invoke(address)
                    startReading(address, socket)
                }
            } catch (e: IOException) {
                if (isListening.get()) {
                    e.printStackTrace()
                }
            }
        }
    }

    // ==================== Чтение данных с фреймингом ====================

    /**
     * Запускает чтение данных из сокета в фоновом потоке.
     * Реализует фрейминг протокола: читает 5-байтовый заголовок,
     * затем payload указанной длины.
     */
    private fun startReading(address: String, socket: BluetoothSocket) {
        scope.launch {
            try {
                val inputStream: InputStream = socket.inputStream
                val headerBuffer = ByteArray(HEADER_SIZE)

                while (socket.isConnected) {
                    // Читаем заголовок (5 байт: 1 байт type + 4 байта length)
                    var headerRead = 0
                    while (headerRead < HEADER_SIZE) {
                        val bytesRead = inputStream.read(headerBuffer, headerRead, HEADER_SIZE - headerRead)
                        if (bytesRead == -1) {
                            throw IOException("Connection closed")
                        }
                        headerRead += bytesRead
                    }

                    // Парсим заголовок
                    val type = headerBuffer[0].toInt() and 0xFF
                    val payloadLength = ByteBuffer.wrap(headerBuffer, 1, 4).int

                    // Читаем payload
                    val payload = if (payloadLength > 0) {
                        val payloadBuffer = ByteArray(payloadLength)
                        var payloadRead = 0
                        while (payloadRead < payloadLength) {
                            val bytesRead = inputStream.read(payloadBuffer, payloadRead, payloadLength - payloadRead)
                            if (bytesRead == -1) {
                                throw IOException("Connection closed")
                            }
                            payloadRead += bytesRead
                        }
                        payloadBuffer
                    } else {
                        ByteArray(0)
                    }

                    // Склеиваем заголовок + payload для колбэка
                    val fullMessage = ByteBuffer.allocate(HEADER_SIZE + payloadLength).apply {
                        put(headerBuffer)
                        put(payload)
                    }.array()

                    onDataReceivedCallback?.invoke(address, fullMessage)
                }
            } catch (e: IOException) {
                if (socket.isConnected || activeConnections.containsKey(address)) {
                    onDisconnectedCallback?.invoke(address)
                }
            } finally {
                activeConnections.remove(address)
                try {
                    if (socket.isConnected) {
                        socket.close()
                    }
                } catch (_: Exception) {}
            }
        }
    }

    // ==================== Cleanup ====================

    fun destroy() {
        scope.cancel()
        try {
            context.unregisterReceiver(discoveryReceiver)
        } catch (_: IllegalArgumentException) {}

        runBlocking {
            stopServer()
            disconnectAll()
        }

        activeConnections.clear()
    }
}
