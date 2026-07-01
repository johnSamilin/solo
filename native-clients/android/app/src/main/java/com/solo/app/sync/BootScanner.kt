package com.solo.app.sync

import java.io.File
import java.security.MessageDigest

/**
 * BootScanner — сканирование файловой системы при запуске приложения.
 *
 * Задача: обнаружить файлы, которые были удалены или созданы в тот момент,
 * когда приложение было выключено.
 *
 * Порт Electron BootScanner.ts на Kotlin.
 */
class BootScanner(
    private val db: SyncDatabase,
    private val dataDir: String
) {
    companion object {
        // Расширения файлов для отслеживания
        private val SCAN_EXTENSIONS = setOf(".html", ".json", ".css")
    }

    /**
     * Результат сканирования.
     */
    data class BootScanResult(
        val totalFilesOnDisk: Int = 0,
        val filesMissingOnDisk: Int = 0,
        val filesNewOnDisk: Int = 0,
        val tombstonesCreated: Int = 0,
        val queueEntriesAdded: Int = 0
    )

    /**
     * Запускает сканирование при старте.
     * Вызывается один раз при инициализации приложения.
     */
    fun scan(): BootScanResult {
        val result = BootScanResult()

        // Шаг 1: Получаем список файлов на диске
        val diskFiles = scanDiskSync()
        val diskFileSet = diskFiles.toSet()

        val r1 = result.copy(totalFilesOnDisk = diskFileSet.size)
        var res = r1

        // Шаг 2: Получаем список файлов из ledger (только живые, не удалённые)
        val ledgerEntries = db.getAllLatestLedgerEntries()
        val ledgerFiles = linkedMapOf<String, Triple<String, String, Int>>()

        for (entry in ledgerEntries) {
            if (entry.operation != "delete") {
                ledgerFiles[entry.fileId] = Triple(entry.filePath, entry.checksum, entry.version)
            }
        }

        // Шаг 3: Проверяем, какие файлы из ledger отсутствуют на диске (удалены офлайн)
        for ((fileId, fileInfo) in ledgerFiles) {
            if (fileId !in diskFileSet) {
                val (filePath, checksum, version) = fileInfo

                // Проверяем, есть ли уже tombstone для этого файла
                val existingTombstone = db.getTombstone(fileId)

                if (existingTombstone == null) {
                    // Создаём tombstone
                    db.addTombstone(fileId, filePath, checksum)
                    res = res.copy(tombstonesCreated = res.tombstonesCreated + 1)

                    // Добавляем в очередь синхронизации
                    db.addToQueue(
                        QueueEntryInput(
                            fileId = fileId,
                            filePath = filePath,
                            operation = "delete",
                            localVersion = version + 1,
                            checksum = checksum
                        )
                    )
                    res = res.copy(queueEntriesAdded = res.queueEntriesAdded + 1)

                    // Добавляем запись в ledger
                    db.addLedgerEntry(
                        LedgerEntryInput(
                            fileId = fileId,
                            filePath = filePath,
                            version = version + 1,
                            checksum = checksum,
                            sizeBytes = 0,
                            modifiedAt = System.currentTimeMillis(),
                            modifiedBy = null,
                            operation = "delete",
                            parentVersion = version
                        )
                    )
                }

                res = res.copy(filesMissingOnDisk = res.filesMissingOnDisk + 1)
            }
        }

        // Шаг 4: Проверяем, какие файлы на диске отсутствуют в ledger (новые файлы)
        for (fileId in diskFileSet) {
            if (fileId !in ledgerFiles) {
                // Новый файл, созданный, когда приложение не работало
                val fullPath = File(dataDir, fileId)

                try {
                    val content = fullPath.readBytes()
                    val checksum = computeChecksum(content)
                    val fileLength = fullPath.length()

                    // Добавляем в ledger
                    db.addLedgerEntry(
                        LedgerEntryInput(
                            fileId = fileId,
                            filePath = fileId,
                            version = 1,
                            checksum = checksum,
                            sizeBytes = fileLength.toInt(),
                            modifiedAt = fullPath.lastModified(),
                            modifiedBy = null,
                            operation = "create",
                            parentVersion = null
                        )
                    )

                    // Добавляем в очередь
                    db.addToQueue(
                        QueueEntryInput(
                            fileId = fileId,
                            filePath = fileId,
                            operation = "create",
                            localVersion = 1,
                            checksum = checksum
                        )
                    )

                    res = res.copy(
                        filesNewOnDisk = res.filesNewOnDisk + 1,
                        queueEntriesAdded = res.queueEntriesAdded + 1
                    )
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }

        return res
    }

    /**
     * Рекурсивно сканирует директорию и возвращает список относительных путей.
     */
    private fun scanDiskSync(): List<String> {
        val files = mutableListOf<String>()
        val baseDir = File(dataDir)

        if (!baseDir.exists()) return files

        fun walkDir(dir: File) {
            val entries = dir.listFiles() ?: return

            for (entry in entries) {
                // Игнорируем служебные директории
                if (entry.name == "node_modules" || entry.name == ".git") continue

                val relativePath = entry.absolutePath.removePrefix(dataDir).trimStart('/')

                if (entry.isDirectory) {
                    walkDir(entry)
                } else if (entry.isFile) {
                    // Отслеживаем только определённые расширения
                    val ext = entry.extension.lowercase()
                    if (".$ext" in SCAN_EXTENSIONS) {
                        files.add(relativePath)
                    }
                }
            }
        }

        walkDir(baseDir)
        return files
    }

    /**
     * Вычисляет SHA-256 хеш содержимого.
     */
    private fun computeChecksum(content: ByteArray): String {
        val digest = MessageDigest.getInstance("SHA-256")
        return digest.digest(content).joinToString("") { "%02x".format(it) }
    }
}
