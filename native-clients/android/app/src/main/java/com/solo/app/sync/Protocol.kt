package com.solo.app.sync

import org.json.JSONArray
import org.json.JSONObject
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * Protocol — кодирование/декодирование бинарных сообщений для P2P Bluetooth-синхронизации.
 *
 * Формат сообщения:
 * ┌──────────────────────────────────────────┐
 * │ Byte 0: Message Type (1 byte)            │
 * │ Byte 1-4: Payload Length (4 bytes, BE)   │
 * │ Byte 5+: Payload (JSON, UTF-8)           │
 * └──────────────────────────────────────────┘
 */
object Protocol {
    const val HEADER_SIZE = 5 // 1 byte type + 4 bytes length

    // ========== Message Types (0x01–0x0B, 0xFE, 0xFF) ==========
    const val TYPE_HANDSHAKE           = 0x01
    const val TYPE_HANDSHAKE_ACK       = 0x02
    const val TYPE_MANIFEST            = 0x03
    const val TYPE_MANIFEST_DIFF       = 0x04
    const val TYPE_FILE                = 0x05
    const val TYPE_FILE_ACK            = 0x06
    const val TYPE_TOMBSTONE           = 0x07
    const val TYPE_TOMBSTONE_ACK       = 0x08
    const val TYPE_SYNC_COMPLETE       = 0x09
    const val TYPE_DISCONNECT          = 0x0A
    const val TYPE_CONFLICT_RESOLUTION = 0x0B
    const val TYPE_PING                = 0xFE
    const val TYPE_ERROR               = 0xFF

    data class SyncMessage(
        val type: Int,
        val payload: JSONObject
    )

    /**
     * Кодирует сообщение в бинарный массив для отправки по RFCOMM.
     */
    fun encode(message: SyncMessage): ByteArray {
        val payloadStr = message.payload.toString()
        val payloadBytes = payloadStr.toByteArray(Charsets.UTF_8)

        val buffer = ByteBuffer.allocate(HEADER_SIZE + payloadBytes.size)
        buffer.order(ByteOrder.BIG_ENDIAN)

        // Byte 0: Message Type
        buffer.put(message.type.toByte())

        // Bytes 1-4: Payload Length (big-endian, uint32)
        buffer.putInt(payloadBytes.size)

        // Bytes 5+: Payload
        if (payloadBytes.isNotEmpty()) {
            buffer.put(payloadBytes)
        }

        return buffer.array()
    }

    /**
     * Декодирует бинарный массив в сообщение.
     * Возвращает null, если данных недостаточно.
     */
    fun decode(data: ByteArray): SyncMessage? {
        if (data.size < HEADER_SIZE) return null

        val buffer = ByteBuffer.wrap(data)
        buffer.order(ByteOrder.BIG_ENDIAN)

        val type = buffer.get().toInt() and 0xFF
        val payloadLength = buffer.getInt()

        if (data.size < HEADER_SIZE + payloadLength) return null

        val payload: JSONObject = if (payloadLength > 0) {
            val payloadBytes = ByteArray(payloadLength)
            buffer.get(payloadBytes)
            val payloadStr = String(payloadBytes, Charsets.UTF_8)
            JSONObject(payloadStr)
        } else {
            JSONObject()
        }

        return SyncMessage(type, payload)
    }

    /**
     * Пытается декодировать сообщение из массива байт, начиная с offset.
     * Возвращает пару (сообщение, размер_сообщения) или null если данных недостаточно.
     * Используется для потокового чтения, когда в одном буфере может быть несколько сообщений.
     */
    fun decodeFromBuffer(data: ByteArray, offset: Int = 0): Pair<SyncMessage, Int>? {
        val remaining = data.size - offset
        if (remaining < HEADER_SIZE) return null

        val sizeBuffer = ByteBuffer.wrap(data, offset, HEADER_SIZE)
        sizeBuffer.order(ByteOrder.BIG_ENDIAN)

        val type = sizeBuffer.get().toInt() and 0xFF
        val payloadLength = sizeBuffer.getInt()

        val totalSize = HEADER_SIZE + payloadLength
        if (remaining < totalSize) return null

        val payloadBytes = ByteArray(payloadLength)
        System.arraycopy(data, offset + HEADER_SIZE, payloadBytes, 0, payloadLength)
        val payloadStr = String(payloadBytes, Charsets.UTF_8)
        val payload = if (payloadLength > 0) JSONObject(payloadStr) else JSONObject()

        return Pair(SyncMessage(type, payload), totalSize)
    }

    // ========== Factory Methods ==========

    /**
     * Создаёт HANDSHAKE сообщение.
     */
    fun handshake(peerId: String, deviceName: String, platform: String, appVersion: String, protocolVersion: Int): SyncMessage {
        return SyncMessage(TYPE_HANDSHAKE, JSONObject().apply {
            put("peerId", peerId)
            put("deviceName", deviceName)
            put("platform", platform)
            put("appVersion", appVersion)
            put("protocolVersion", protocolVersion)
        })
    }

    /**
     * Создаёт HANDSHAKE_ACK сообщение.
     */
    fun handshakeAck(peerId: String, accepted: Boolean, rejectReason: String? = null): SyncMessage {
        return SyncMessage(TYPE_HANDSHAKE_ACK, JSONObject().apply {
            put("peerId", peerId)
            put("accepted", accepted)
            rejectReason?.let { put("rejectReason", it) }
        })
    }

    /**
     * Создаёт MANIFEST сообщение.
     */
    fun manifest(files: JSONArray, tombstones: JSONArray): SyncMessage {
        return SyncMessage(TYPE_MANIFEST, JSONObject().apply {
            put("files", files)
            put("tombstones", tombstones)
        })
    }

    /**
     * Создаёт MANIFEST_DIFF сообщение.
     */
    fun manifestDiff(neededFiles: JSONArray, neededTombstones: JSONArray): SyncMessage {
        return SyncMessage(TYPE_MANIFEST_DIFF, JSONObject().apply {
            put("neededFiles", neededFiles)
            put("neededTombstones", neededTombstones)
        })
    }

    /**
     * Создаёт FILE сообщение.
     */
    fun file(fileId: String, version: Int, path: String, content: String, metadata: String, checksum: String, modifiedAt: Long): SyncMessage {
        return SyncMessage(TYPE_FILE, JSONObject().apply {
            put("fileId", fileId)
            put("version", version)
            put("path", path)
            put("content", content)
            put("metadata", metadata)
            put("checksum", checksum)
            put("modifiedAt", modifiedAt)
        })
    }

    /**
     * Создаёт FILE_ACK сообщение.
     */
    fun fileAck(fileId: String, version: Int, accepted: Boolean, conflict: Boolean = false): SyncMessage {
        return SyncMessage(TYPE_FILE_ACK, JSONObject().apply {
            put("fileId", fileId)
            put("version", version)
            put("accepted", accepted)
            put("conflict", conflict)
        })
    }

    /**
     * Создаёт TOMBSTONE сообщение.
     */
    fun tombstone(fileId: String, deletedAt: Long, originalPath: String, checksum: String? = null): SyncMessage {
        return SyncMessage(TYPE_TOMBSTONE, JSONObject().apply {
            put("fileId", fileId)
            put("deletedAt", deletedAt)
            put("originalPath", originalPath)
            checksum?.let { put("checksum", it) }
        })
    }

    /**
     * Создаёт TOMBSTONE_ACK сообщение.
     */
    fun tombstoneAck(fileId: String, accepted: Boolean = true): SyncMessage {
        return SyncMessage(TYPE_TOMBSTONE_ACK, JSONObject().apply {
            put("fileId", fileId)
            put("accepted", accepted)
        })
    }

    /**
     * Создаёт SYNC_COMPLETE сообщение.
     */
    fun syncComplete(filesTransferred: Int, tombstonesApplied: Int, conflictsDetected: Int, duration: Long): SyncMessage {
        return SyncMessage(TYPE_SYNC_COMPLETE, JSONObject().apply {
            put("summary", JSONObject().apply {
                put("filesTransferred", filesTransferred)
                put("tombstonesApplied", tombstonesApplied)
                put("conflictsDetected", conflictsDetected)
                put("duration", duration)
            })
        })
    }

    /**
     * Создаёт DISCONNECT сообщение.
     */
    fun disconnect(reason: String): SyncMessage {
        return SyncMessage(TYPE_DISCONNECT, JSONObject().apply {
            put("reason", reason)
        })
    }

    /**
     * Создаёт CONFLICT_RESOLUTION сообщение.
     */
    fun conflictResolution(fileId: String, strategy: String, resolvedVersion: Int): SyncMessage {
        return SyncMessage(TYPE_CONFLICT_RESOLUTION, JSONObject().apply {
            put("fileId", fileId)
            put("strategy", strategy)
            put("resolvedVersion", resolvedVersion)
        })
    }

    /**
     * Создаёт PING сообщение (keepalive).
     */
    fun ping(): SyncMessage {
        return SyncMessage(TYPE_PING, JSONObject())
    }

    /**
     * Создаёт ERROR сообщение.
     */
    fun error(code: String, message: String): SyncMessage {
        return SyncMessage(TYPE_ERROR, JSONObject().apply {
            put("code", code)
            put("message", message)
        })
    }
}
