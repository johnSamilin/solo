package com.solo.app.sync

import android.os.FileObserver
import java.io.File
import java.security.MessageDigest
import java.util.concurrent.ConcurrentHashMap

/**
 * FileWatcher — отслеживание изменений файловой системы на Android.
 *
 * Использует FileObserver для отслеживания создания, изменения и удаления файлов
 * в dataDirectory.
 *
 * Порт Electron FileWatcher.ts на Kotlin с использованием Android SDK.
 *
 * ВАЖНО: FileObserver не поддерживает рекурсивное наблюдение на Android < 9 (API 28).
 * Для Android 9+ используется FileObserver.CREATE для обнаружения новых директорий.
 * Для более старых версий наблюдение запускается на каждой поддиректории вручную.
 */
class FileWatcher(
    private val db: SyncDatabase,
    private val dataDir: String
) {
    companion object {
        // Расширения файлов, которые отслеживаем
        private val WATCH_EXTENSIONS = setOf(
            ".html", ".json", ".css", ".js", ".ts", ".tsx", ".jsx",
            ".txt", ".md", ".csv", ".xml", ".yaml", ".yml",
            ".pdf", ".doc", ".docx", ".png", ".jpg", ".jpeg", ".gif", ".svg"
        )

        // Debounce-интервал (мс)
        private const val DEBOUNCE_MS = 300L

        // Маска событий для FileObserver
        private const val WATCH_MASK = (
                FileObserver.CREATE or
                FileObserver.MODIFY or
                FileObserver.MOVED_TO or
                FileObserver.DELETE or
                FileObserver.MOVED_FROM or
                FileObserver.DELETE_SELF
                )
    }

    // Активные наблюдатели: directory path -> FileObserver
    private val watchers = ConcurrentHashMap<String, FileObserver>()

    // Debounce-таймеры: fullPath -> время последнего события
    private val debounceTimers = ConcurrentHashMap<String, Long>()

    @Volatile
    private var watching = false

    // Фоновый поток для обработки событий с debounce
    private var debounceThread: Thread? = null
    private val debounceQueue = ConcurrentHashMap<String, String>() // fullPath -> relativePath
    private val debounceLock = Object()

    /**
     * Запускает отслеживание изменений в dataDirectory.
     */
    fun start() {
        if (watching) return
        watching = true

        val dir = File(dataDir)
        if (!dir.exists()) {
            dir.mkdirs()
        }

        watchDirectory(dir)

        // Запускаем фоновый поток для debounce-обработки
        debounceThread = Thread {
            processDebounceQueue()
        }.apply {
            isDaemon = true
            name = "FileWatcher-Debounce"
            start()
        }
    }

    /**
     * Рекурсивно отслеживает директорию.
     */
    private fun watchDirectory(dir: File) {
        if (!watching) return

        val dirPath = dir.absolutePath

        // Пропускаем системные директории
        if (dirPath.contains("/.") || dirPath.contains("node_modules") || dirPath.contains(".git")) {
            return
        }

        // Уже отслеживается
        if (watchers.containsKey(dirPath)) return

        try {
            val observer = object : FileObserver(dirPath, WATCH_MASK) {
                override fun onEvent(event: Int, path: String?) {
                    if (path == null) return
                    handleFileEvent(event, dirPath, path)
                }
            }
            observer.startWatching()
            watchers[dirPath] = observer

            // Рекурсивно добавляем поддиректории
            val entries = dir.listFiles() ?: return
            for (entry in entries) {
                if (entry.isDirectory) {
                    watchDirectory(entry)
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    /**
     * Обрабатывает событие файловой системы.
     */
    private fun handleFileEvent(event: Int, dirPath: String, filename: String) {
        // Игнорируем временные файлы
        if (filename.startsWith(".")) return

        val fullPath = "$dirPath/$filename"
        val ext = filename.substringAfterLast('.', "").lowercase()

        // Отслеживаем только определённые расширения
        if (ext !in WATCH_EXTENSIONS.map { it.removePrefix(".") }) return

        // Относительный путь от dataDir
        val relativePath = fullPath.removePrefix(dataDir).trimStart('/')

        // Если это создание новой директории — начинаем отслеживать
        if (event and FileObserver.CREATE != 0 || event and FileObserver.MOVED_TO != 0) {
            val newFile = File(fullPath)
            if (newFile.isDirectory) {
                watchDirectory(newFile)
                return
            }
        }

        // Debounce: записываем в очередь
        synchronized(debounceLock) {
            debounceQueue[fullPath] = relativePath
            debounceLock.notify()
        }
    }

    /**
     * Фоновый поток для обработки событий с debounce.
     */
    private fun processDebounceQueue() {
        while (watching) {
            // Ждём события из очереди (снаружи synchronized, чтобы избежать break/continue внутри блока)
            val hasEvents: Boolean
            synchronized(debounceLock) {
                if (debounceQueue.isEmpty()) {
                    try {
                        debounceLock.wait(1000)
                    } catch (_: InterruptedException) {
                        watching = false
                        return
                    }
                    hasEvents = debounceQueue.isNotEmpty()
                } else {
                    hasEvents = true
                }
            }

            if (!hasEvents) {
                // Нет событий — спим и продолжаем
                try {
                    Thread.sleep(50)
                } catch (_: InterruptedException) {
                    watching = false
                    break
                }
                continue
            }

            // Обрабатываем каждое событие с debounce
            val events = HashMap(debounceQueue)
            debounceQueue.clear()

            for ((fullPath, relativePath) in events) {
                val now = System.currentTimeMillis()
                val lastEvent = debounceTimers[fullPath] ?: 0L

                if (now - lastEvent >= DEBOUNCE_MS) {
                    debounceTimers[fullPath] = now
                    processEvent(fullPath, relativePath)
                } else {
                    // Слишком рано — возвращаем в очередь
                    synchronized(debounceLock) {
                        debounceQueue[fullPath] = relativePath
                    }
                }
            }

            // Немного спим, чтобы не грузить CPU
            try {
                Thread.sleep(50)
            } catch (_: InterruptedException) {
                watching = false
                break
            }
        }
    }

    /**
     * Обрабатывает событие с учётом debounce.
     */
    private fun processEvent(fullPath: String, relativePath: String) {
        val file = File(fullPath)

        if (file.exists() && file.isFile) {
            // Файл существует — это create или update
            val content = file.readBytes()
            val checksum = computeChecksum(content)
            val fileId = relativePath

            // Проверяем, есть ли уже запись в ledger
            val existing = db.getLatestLedgerEntry(fileId)

            if (existing != null) {
                if (existing.checksum != checksum) {
                    // Файл изменился
                    val newVersion = existing.version + 1
                    db.addLedgerEntry(
                        LedgerEntryInput(
                            fileId = fileId,
                            filePath = relativePath,
                            version = newVersion,
                            checksum = checksum,
                            sizeBytes = file.length().toInt(),
                            modifiedAt = file.lastModified(),
                            modifiedBy = null,
                            operation = "update",
                            parentVersion = existing.version
                        )
                    )

                    db.addToQueue(
                        QueueEntryInput(
                            fileId = fileId,
                            filePath = relativePath,
                            operation = "update",
                            localVersion = newVersion,
                            checksum = checksum
                        )
                    )
                }
            } else {
                // Новый файл
                db.addLedgerEntry(
                    LedgerEntryInput(
                        fileId = fileId,
                        filePath = relativePath,
                        version = 1,
                        checksum = checksum,
                        sizeBytes = file.length().toInt(),
                        modifiedAt = file.lastModified(),
                        modifiedBy = null,
                        operation = "create",
                        parentVersion = null
                    )
                )

                db.addToQueue(
                    QueueEntryInput(
                        fileId = fileId,
                        filePath = relativePath,
                        operation = "create",
                        localVersion = 1,
                        checksum = checksum
                    )
                )
            }
        } else {
            // Файл не существует — удаление
            handleDelete(fullPath, relativePath)
        }
    }

    /**
     * Обрабатывает удаление файла.
     */
    private fun handleDelete(fullPath: String, relativePath: String) {
        val fileId = relativePath

        val existing = db.getLatestLedgerEntry(fileId)

        if (existing != null) {
            // Записываем tombstone
            db.addTombstone(fileId, relativePath, existing.checksum)

            // Добавляем в очередь
            db.addToQueue(
                QueueEntryInput(
                    fileId = fileId,
                    filePath = relativePath,
                    operation = "delete",
                    localVersion = existing.version + 1,
                    checksum = existing.checksum
                )
            )

            // Добавляем запись в ledger
            db.addLedgerEntry(
                LedgerEntryInput(
                    fileId = fileId,
                    filePath = relativePath,
                    version = existing.version + 1,
                    checksum = existing.checksum,
                    sizeBytes = 0,
                    modifiedAt = System.currentTimeMillis(),
                    modifiedBy = null,
                    operation = "delete",
                    parentVersion = existing.version
                )
            )

            // Удаляем watcher для удалённой директории
            watchers.remove(fullPath)?.stopWatching()
        }
    }

    /**
     * Вычисляет SHA-256 хеш содержимого.
     */
    private fun computeChecksum(content: ByteArray): String {
        val digest = MessageDigest.getInstance("SHA-256")
        return digest.digest(content).joinToString("") { "%02x".format(it) }
    }

    /**
     * Останавливает отслеживание.
     */
    fun stop() {
        watching = false
        debounceTimers.clear()

        synchronized(debounceLock) {
            debounceQueue.clear()
            debounceLock.notify()
        }

        for ((_, observer) in watchers) {
            observer.stopWatching()
        }
        watchers.clear()

        debounceThread?.interrupt()
        debounceThread = null
    }
}
