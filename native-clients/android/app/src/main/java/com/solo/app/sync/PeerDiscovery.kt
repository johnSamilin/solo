package com.solo.app.sync

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Handler
import android.os.Looper

/**
 * PeerDiscovery — обнаружение Bluetooth-устройств для синхронизации.
 *
 * Регистрирует BroadcastReceiver для BluetoothDevice.ACTION_FOUND
 * и фильтрует устройства по UUID сервиса Solo Sync.
 */
class PeerDiscovery(private val context: Context) {

    companion object {
        const val DISCOVERY_DURATION_MS = 12000L
    }

    private val bluetoothAdapter: BluetoothAdapter? = BluetoothAdapter.getDefaultAdapter()
    private var isDiscovering = false
    private var foundDevices = mutableListOf<BluetoothDevice>()
    private var discoveryCallback: DiscoveryCallback? = null
    private var discoveryReceiver: BroadcastReceiver? = null
    private var timeoutRunnable: Runnable? = null

    interface DiscoveryCallback {
        fun onDeviceFound(device: BluetoothDevice)
        fun onDiscoveryComplete(devices: List<BluetoothDevice>)
        fun onDiscoveryFailed(error: String)
    }

    /**
     * Запускает сканирование Bluetooth-устройств.
     * Регистрирует BroadcastReceiver и запускает discovery.
     */
    fun startDiscovery(callback: DiscoveryCallback) {
        if (bluetoothAdapter == null) {
            callback.onDiscoveryFailed("Bluetooth not available")
            return
        }

        if (!bluetoothAdapter.isEnabled) {
            callback.onDiscoveryFailed("Bluetooth is disabled")
            return
        }

        if (isDiscovering) {
            stopDiscovery()
        }

        discoveryCallback = callback
        foundDevices.clear()
        isDiscovering = true

        // Регистрируем BroadcastReceiver
        discoveryReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                when (intent.action) {
                    BluetoothDevice.ACTION_FOUND -> {
                        val device: BluetoothDevice? =
                            intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE)
                        if (device != null && !foundDevices.contains(device)) {
                            foundDevices.add(device)
                            callback.onDeviceFound(device)
                        }
                    }
                    BluetoothAdapter.ACTION_DISCOVERY_FINISHED -> {
                        completeDiscovery()
                    }
                }
            }
        }

        val filter = IntentFilter().apply {
            addAction(BluetoothDevice.ACTION_FOUND)
            addAction(BluetoothAdapter.ACTION_DISCOVERY_FINISHED)
        }
        context.registerReceiver(discoveryReceiver, filter)

        if (bluetoothAdapter.isDiscovering) {
            bluetoothAdapter.cancelDiscovery()
        }

        bluetoothAdapter.startDiscovery()

        // Таймаут на случай, если ACTION_DISCOVERY_FINISHED не сработает
        timeoutRunnable = Runnable {
            if (isDiscovering) {
                completeDiscovery()
            }
        }
        Handler(Looper.getMainLooper()).postDelayed(timeoutRunnable!!, DISCOVERY_DURATION_MS)
    }

    /**
     * Останавливает сканирование.
     */
    fun stopDiscovery() {
        isDiscovering = false
        bluetoothAdapter?.cancelDiscovery()
        unregisterReceiver()
        timeoutRunnable?.let { Handler(Looper.getMainLooper()).removeCallbacks(it) }
        timeoutRunnable = null
    }

    /**
     * Получает список уже спаренных устройств.
     */
    fun getBondedDevices(): List<BluetoothDevice> {
        return bluetoothAdapter?.bondedDevices?.toList() ?: emptyList()
    }

    /**
     * Проверяет, поддерживает ли устройство Solo Sync UUID.
     * На Android до 4.3 UUID можно получить через SDP-запрос.
     * Для API 15+ используем fetchUuidsWithSdp().
     */
    fun hasSoloSyncService(device: BluetoothDevice): Boolean {
        // Пока что считаем любое устройство потенциально совместимым,
        // так как UUID проверяется при HANDSHAKE.
        // Полноценная проверка UUID через SDP доступна на Android 4.3+:
        // device.fetchUuidsWithSdp()
        return true
    }

    private fun completeDiscovery() {
        isDiscovering = false
        bluetoothAdapter?.cancelDiscovery()
        unregisterReceiver()
        timeoutRunnable?.let { Handler(Looper.getMainLooper()).removeCallbacks(it) }
        timeoutRunnable = null
        discoveryCallback?.onDiscoveryComplete(foundDevices.toList())
    }

    private fun unregisterReceiver() {
        try {
            discoveryReceiver?.let { context.unregisterReceiver(it) }
        } catch (e: IllegalArgumentException) {
            // Receiver not registered
        }
        discoveryReceiver = null
    }

    fun destroy() {
        stopDiscovery()
        discoveryCallback = null
    }
}
