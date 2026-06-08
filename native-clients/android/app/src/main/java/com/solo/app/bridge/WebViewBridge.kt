package com.solo.app.bridge

import android.webkit.JavascriptInterface
import com.solo.app.MainActivity
import com.solo.app.sync.SyncEngine
import com.solo.app.utils.SecurityUtils
import org.json.JSONArray
import org.json.JSONObject

/**
 * WebViewBridge — мост между JavaScript (WebView) и нативным кодом Android.
 *
 * Предоставляет @JavascriptInterface методы, вызываемые из TypeScript-кода
 * через window.SoloBridge. Все методы возвращают JSON-строки для совместимости.
 *
 * Содержит как原有的 методы файловой системы, так и методы управления синхронизацией,
 * соответствующие интерфейсу SyncBridgeAPI (см. solo/src/shared/types.ts).
 */
class WebViewBridge(
    private val activity: MainActivity,
    private val fileSystemManager: FileSystemManager,
    private val audioPlayer: AudioPlayer,
    private val searchEngine: SearchEngine,
    private val syncEngine: SyncEngine? = null
) {
    // ==================== Файловая система ====================

    @JavascriptInterface
    fun selectFolder() {
        activity.runOnUiThread { activity.launchFolderPicker() }
    }

    @JavascriptInterface
    fun getDataFolder(): String {
        return try {
            val path = fileSystemManager.getRootFolderPath()
            if (path != null) {
                """{"success":true,"path":"${SecurityUtils.escapeJson(path)}"}"""
            } else {
                """{"success":true,"path":null}"""
            }
        } catch (e: Exception) {
            """{"success":false,"error":"${SecurityUtils.escapeJson(e.message ?: "Unknown error")}"}"""
        }
    }

    @JavascriptInterface
    fun openFile(relativePath: String): String {
        return try {
            val content = fileSystemManager.openFile(relativePath)
            """{"success":true,"content":${SecurityUtils.toJsonString(content)}}"""
        } catch (e: Exception) {
            """{"success":false,"error":"${SecurityUtils.escapeJson(e.message ?: "Unknown error")}"}"""
        }
    }

    @JavascriptInterface
    fun updateFile(relativePath: String, content: String): String {
        return try {
            fileSystemManager.updateFile(relativePath, content)
            """{"success":true}"""
        } catch (e: Exception) {
            """{"success":false,"error":"${SecurityUtils.escapeJson(e.message ?: "Unknown error")}"}"""
        }
    }

    @JavascriptInterface
    fun readStructure(): String {
        return try {
            val structureJson = fileSystemManager.readStructureJson()
            """{"success":true,"structure":$structureJson}"""
        } catch (e: Exception) {
            """{"success":false,"error":"${SecurityUtils.escapeJson(e.message ?: "Unknown error")}"}"""
        }
    }

    @JavascriptInterface
    fun updateMetadata(relativePath: String, metadataJson: String): String {
        return try {
            fileSystemManager.updateMetadata(relativePath, metadataJson)
            """{"success":true}"""
        } catch (e: Exception) {
            """{"success":false,"error":"${SecurityUtils.escapeJson(e.message ?: "Unknown error")}"}"""
        }
    }

    @JavascriptInterface
    fun scanAllTags(): String {
        return try {
            val tags = fileSystemManager.scanAllTags()
            val tagsJson = tags.joinToString(",") { "\"${SecurityUtils.escapeJson(it)}\"" }
            """{"success":true,"tags":[$tagsJson]}"""
        } catch (e: Exception) {
            """{"success":false,"error":"${SecurityUtils.escapeJson(e.message ?: "Unknown error")}"}"""
        }
    }

    @JavascriptInterface
    fun createNote(parentPath: String, name: String): String {
        return try {
            val result = fileSystemManager.createNote(parentPath, name)
            """{"success":true,"id":"${SecurityUtils.escapeJson(result.id)}","htmlPath":"${SecurityUtils.escapeJson(result.htmlPath)}"}"""
        } catch (e: Exception) {
            """{"success":false,"error":"${SecurityUtils.escapeJson(e.message ?: "Unknown error")}"}"""
        }
    }

    @JavascriptInterface
    fun createNotebook(parentPath: String, name: String): String {
        return try {
            val path = fileSystemManager.createNotebook(parentPath, name)
            """{"success":true,"path":"${SecurityUtils.escapeJson(path)}"}"""
        } catch (e: Exception) {
            """{"success":false,"error":"${SecurityUtils.escapeJson(e.message ?: "Unknown error")}"}"""
        }
    }

    @JavascriptInterface
    fun deleteNote(relativePath: String): String {
        return try {
            fileSystemManager.deleteNote(relativePath)
            """{"success":true}"""
        } catch (e: Exception) {
            """{"success":false,"error":"${SecurityUtils.escapeJson(e.message ?: "Unknown error")}"}"""
        }
    }

    @JavascriptInterface
    fun deleteNotebook(relativePath: String): String {
        return try {
            fileSystemManager.deleteNotebook(relativePath)
            """{"success":true}"""
        } catch (e: Exception) {
            """{"success":false,"error":"${SecurityUtils.escapeJson(e.message ?: "Unknown error")}"}"""
        }
    }

    @JavascriptInterface
    fun renameNote(relativePath: String, newName: String): String {
        return try {
            val newPath = fileSystemManager.renameNote(relativePath, newName)
            """{"success":true,"newPath":"${SecurityUtils.escapeJson(newPath)}"}"""
        } catch (e: Exception) {
            """{"success":false,"error":"${SecurityUtils.escapeJson(e.message ?: "Unknown error")}"}"""
        }
    }

    @JavascriptInterface
    fun renameNotebook(relativePath: String, newName: String): String {
        return try {
            val newPath = fileSystemManager.renameNotebook(relativePath, newName)
            """{"success":true,"newPath":"${SecurityUtils.escapeJson(newPath)}"}"""
        } catch (e: Exception) {
            """{"success":false,"error":"${SecurityUtils.escapeJson(e.message ?: "Unknown error")}"}"""
        }
    }

    @JavascriptInterface
    fun uploadImage(base64Data: String, fileName: String): String {
        return try {
            val url = fileSystemManager.saveImage(base64Data, fileName)
            """{"success":true,"url":"${SecurityUtils.escapeJson(url)}"}"""
        } catch (e: Exception) {
            """{"success":false,"error":"${SecurityUtils.escapeJson(e.message ?: "Unknown error")}"}"""
        }
    }

    @JavascriptInterface
    fun playTypewriterSound() {
        audioPlayer.play()
    }

    @JavascriptInterface
    fun search(query: String, tagsJson: String): String {
        return try {
            searchEngine.searchJson(query, tagsJson)
        } catch (e: Exception) {
            """{"success":false,"error":"${SecurityUtils.escapeJson(e.message ?: "Unknown error")}"}"""
        }
    }

    @JavascriptInterface
    fun toggleZenMode(enable: Boolean): String {
        activity.toggleZenMode(enable)
        return """{"success":true,"isZenMode":$enable}"""
    }

    @JavascriptInterface
    fun openPdfFile(relativePath: String): String {
        return try {
            val content = fileSystemManager.openFile(relativePath)
            """{"success":true,"data":"${SecurityUtils.escapeJson(content)}"}"""
        } catch (e: Exception) {
            """{"success":false,"error":"${SecurityUtils.escapeJson(e.message ?: "Unknown error")}"}"""
        }
    }

    // ==================== Sync Bridge API ====================
    //
    // Соответствует интерфейсу SyncBridgeAPI из solo/src/shared/types.ts
    // Все методы возвращают JSON-строки для совместимости с WebView JS-мостом.
    // Каждый метод thread-safe, вызывается из любого потока.
    //
    // Если SyncEngine не инициализирован, методы возвращают ошибку.

    /**
     * Запускает синхронизацию с Bluetooth-пирами.
     * Соответствует: syncStart(): Promise<{ success: boolean }>
     */
    @JavascriptInterface
    fun syncStart(): String {
        return try {
            val engine = syncEngine
            if (engine == null) {
                return """{"success":false,"error":"SyncEngine not initialized"}"""
            }
            val result = kotlinx.coroutines.runBlocking {
                engine.startSync()
            }
            """{"success":$result}"""
        } catch (e: Exception) {
            """{"success":false,"error":"${SecurityUtils.escapeJson(e.message ?: "Sync start failed")}"}"""
        }
    }

    /**
     * Останавливает синхронизацию.
     * Соответствует: syncStop(): Promise<{ success: boolean }>
     */
    @JavascriptInterface
    fun syncStop(): String {
        return try {
            val engine = syncEngine
            if (engine == null) {
                return """{"success":false,"error":"SyncEngine not initialized"}"""
            }
            kotlinx.coroutines.runBlocking {
                engine.stopSync()
            }
            """{"success":true}"""
        } catch (e: Exception) {
            """{"success":false,"error":"${SecurityUtils.escapeJson(e.message ?: "Sync stop failed")}"}"""
        }
    }

    /**
     * Возвращает текущий статус синхронизации.
     * Соответствует: syncGetStatus(): Promise<SyncStatus>
     */
    @JavascriptInterface
    fun syncGetStatus(): String {
        return try {
            val engine = syncEngine
            if (engine == null) {
                return """{"success":true,"status":${buildEmptyStatus()}}"""
            }
            val status = engine.getStatus()
            """{"success":true,"status":${serializeSyncStatus(status)}}"""
        } catch (e: Exception) {
            """{"success":false,"error":"${SecurityUtils.escapeJson(e.message ?: "Get status failed")}"}"""
        }
    }

    /**
     * Запускает обнаружение Bluetooth-пиров.
     * Соответствует: syncDiscoverPeers(): Promise<PeerDevice[]>
     */
    @JavascriptInterface
    fun syncDiscoverPeers(): String {
        return try {
            val engine = syncEngine
            if (engine == null) {
                return """{"success":true,"peers":[]}"""
            }
            val peers = kotlinx.coroutines.runBlocking {
                engine.discoverPeers()
            }
            val peersArray = JSONArray()
            for (peer in peers) {
                peersArray.put(JSONObject().apply {
                    put("id", peer.id)
                    put("name", peer.name)
                    put("deviceType", peer.deviceType)
                    peer.macAddress?.let { put("macAddress", it) }
                    put("lastSeenAt", peer.lastSeenAt)
                    put("firstSeenAt", peer.firstSeenAt)
                    put("trustStatus", peer.trustStatus)
                    put("isPaired", peer.isPaired)
                    put("protocolVersion", peer.protocolVersion)
                })
            }
            """{"success":true,"peers":$peersArray}"""
        } catch (e: Exception) {
            """{"success":false,"error":"${SecurityUtils.escapeJson(e.message ?: "Discover peers failed")}"}"""
        }
    }

    /**
     * Подключается к пиру по MAC-адресу.
     * Соответствует: syncPairDevice(deviceId: string): Promise<{ success: boolean }>
     */
    @JavascriptInterface
    fun syncPairDevice(deviceId: String): String {
        return try {
            val engine = syncEngine
            if (engine == null) {
                return """{"success":false,"error":"SyncEngine not initialized"}"""
            }
            val result = kotlinx.coroutines.runBlocking {
                engine.pairDevice(deviceId)
            }
            """{"success":$result}"""
        } catch (e: Exception) {
            """{"success":false,"error":"${SecurityUtils.escapeJson(e.message ?: "Pair device failed")}"}"""
        }
    }

    /**
     * Отключает пир.
     * Соответствует: syncUnpairDevice(deviceId: string): Promise<{ success: boolean }>
     */
    @JavascriptInterface
    fun syncUnpairDevice(deviceId: String): String {
        return try {
            val engine = syncEngine
            if (engine == null) {
                return """{"success":false,"error":"SyncEngine not initialized"}"""
            }
            val result = kotlinx.coroutines.runBlocking {
                engine.unpairDevice(deviceId)
            }
            """{"success":$result}"""
        } catch (e: Exception) {
            """{"success":false,"error":"${SecurityUtils.escapeJson(e.message ?: "Unpair device failed")}"}"""
        }
    }

    /**
     * Возвращает список сохранённых пиров.
     * Соответствует: syncGetPeers(): Promise<PeerDevice[]>
     */
    @JavascriptInterface
    fun syncGetPeers(): String {
        return try {
            val engine = syncEngine
            if (engine == null) {
                return """{"success":true,"peers":[]}"""
            }
            val peers = engine.getPeers()
            val peersArray = JSONArray()
            for (peer in peers) {
                peersArray.put(JSONObject().apply {
                    put("id", peer.id)
                    put("name", peer.name)
                    put("deviceType", peer.deviceType)
                    peer.macAddress?.let { put("macAddress", it) }
                    put("lastSeenAt", peer.lastSeenAt)
                    put("firstSeenAt", peer.firstSeenAt)
                    put("trustStatus", peer.trustStatus)
                    put("isPaired", peer.isPaired)
                    put("protocolVersion", peer.protocolVersion)
                })
            }
            """{"success":true,"peers":$peersArray}"""
        } catch (e: Exception) {
            """{"success":false,"error":"${SecurityUtils.escapeJson(e.message ?: "Get peers failed")}"}"""
        }
    }

    /**
     * Возвращает список неразрешённых конфликтов.
     * Соответствует: syncGetConflicts(): Promise<SyncConflict[]>
     */
    @JavascriptInterface
    fun syncGetConflicts(): String {
        return try {
            val engine = syncEngine
            if (engine == null) {
                return """{"success":true,"conflicts":[]}"""
            }
            val conflicts = engine.getConflicts()
            val conflictsArray = JSONArray()
            for (conflict in conflicts) {
                conflictsArray.put(JSONObject().apply {
                    put("conflictId", conflict.conflictId)
                    put("fileId", conflict.fileId)
                    put("filePath", conflict.filePath)
                    put("localVersion", conflict.localVersion)
                    put("remoteVersion", conflict.remoteVersion)
                    put("localChecksum", conflict.localChecksum)
                    put("remoteChecksum", conflict.remoteChecksum)
                    put("localModifiedAt", conflict.localModifiedAt)
                    put("remoteModifiedAt", conflict.remoteModifiedAt)
                    put("resolution", conflict.resolution)
                    put("resolvedAt", conflict.resolvedAt)
                    put("resolvedBy", conflict.resolvedBy)
                    put("createdAt", conflict.createdAt)
                })
            }
            """{"success":true,"conflicts":$conflictsArray}"""
        } catch (e: Exception) {
            """{"success":false,"error":"${SecurityUtils.escapeJson(e.message ?: "Get conflicts failed")}"}"""
        }
    }

    /**
     * Разрешает конфликт с указанной стратегией.
     * Соответствует: syncResolveConflict(conflictId: number, strategy: 'local_wins' | 'remote_wins'): Promise<{ success: boolean }>
     */
    @JavascriptInterface
    fun syncResolveConflict(conflictId: Long, strategy: String): String {
        return try {
            val engine = syncEngine
            if (engine == null) {
                return """{"success":false,"error":"SyncEngine not initialized"}"""
            }
            engine.resolveConflict(conflictId, strategy)
            """{"success":true}"""
        } catch (e: Exception) {
            """{"success":false,"error":"${SecurityUtils.escapeJson(e.message ?: "Resolve conflict failed")}"}"""
        }
    }

    // ==================== Sync Event Push (native → JS) ====================

    /**
     * Имя JS-функции в window, которая будет получать события синхронизации.
     */
    private var syncEventCallbackName: String? = null

    /**
     * Функция отписки от событий SyncEngine.
     */
    private var syncEventUnsubscribe: (() -> Unit)? = null

    /**
     * Устанавливает имя callback-функции в JS для получения push-событий.
     * Вызывается из JS через @JavascriptInterface.
     * Если передана пустая строка — отписывается от событий.
     */
    @JavascriptInterface
    fun syncSetEventCallback(callbackName: String) {
        syncEventCallbackName = callbackName

        if (callbackName.isNotEmpty()) {
            // Подписываемся на события SyncEngine и пушим их в JS
            val engine = syncEngine
            if (engine != null) {
                syncEventUnsubscribe?.invoke()
                syncEventUnsubscribe = engine.onSyncEvent { event ->
                    pushSyncEvent(event)
                }
            }
        } else {
            syncEventUnsubscribe?.invoke()
            syncEventUnsubscribe = null
        }
    }

    /**
     * Отправляет событие синхронизации в JS через evaluateJavascript.
     */
    private fun pushSyncEvent(event: SyncEngine.SyncEvent) {
        val callbackName = syncEventCallbackName ?: return
        val eventJson = serializeSyncEvent(event)
        activity.runOnUiThread {
            activity.evaluateJavascript(
                "if(window.$callbackName){window.$callbackName('${SecurityUtils.escapeJsString(eventJson)}');}"
            )
        }
    }

    /**
     * Сериализует SyncEngine.SyncEvent в JSON-строку для отправки в JS.
     */
    private fun serializeSyncEvent(event: SyncEngine.SyncEvent): String {
        return JSONObject().apply {
            put("type", event.type)
            put("timestamp", event.timestamp)
            when (event.data) {
                is Map<*, *> -> {
                    val dataObj = JSONObject()
                    @Suppress("UNCHECKED_CAST")
                    (event.data as Map<String, Any?>).forEach { (key, value) ->
                        when (value) {
                            is String -> dataObj.put(key, value)
                            is Number -> dataObj.put(key, value)
                            is Boolean -> dataObj.put(key, value)
                            else -> dataObj.put(key, value?.toString())
                        }
                    }
                    put("data", dataObj)
                }
                else -> put("data", event.data?.toString() ?: JSONObject.NULL)
            }
        }.toString()
    }

    // ==================== Private Helpers ====================

    /**
     * Сериализует SyncStatus в JSON-строку.
     */
    private fun serializeSyncStatus(status: SyncEngine.SyncStatus): String {
        return JSONObject().apply {
            put("state", status.state)
            put("lastSyncAt", status.lastSyncAt)
            put("error", status.error)

            val peersArray = JSONArray()
            for (peer in status.connectedPeers) {
                peersArray.put(JSONObject().apply {
                    put("id", peer.id)
                    put("name", peer.name)
                    put("deviceType", peer.deviceType)
                    peer.macAddress?.let { put("macAddress", it) }
                    put("lastSeenAt", peer.lastSeenAt)
                    put("firstSeenAt", peer.firstSeenAt)
                    put("trustStatus", peer.trustStatus)
                    put("isPaired", peer.isPaired)
                    put("protocolVersion", peer.protocolVersion)
                })
            }
            put("connectedPeers", peersArray)

            if (status.progress != null) {
                put("progress", JSONObject().apply {
                    put("totalFiles", status.progress.totalFiles)
                    put("transferredFiles", status.progress.transferredFiles)
                    status.progress.currentFile?.let { put("currentFile", it) }
                    put("phase", status.progress.phase)
                })
            } else {
                put("progress", JSONObject.NULL)
            }
        }.toString()
    }

    /**
     * Строит пустой статус (когда engine не инициализирован).
     */
    private fun buildEmptyStatus(): String {
        return JSONObject().apply {
            put("state", "idle")
            put("lastSyncAt", JSONObject.NULL)
            put("connectedPeers", JSONArray())
            put("progress", JSONObject.NULL)
            put("error", JSONObject.NULL)
        }.toString()
    }
}
