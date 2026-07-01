package com.solo.app.sync

import org.json.JSONObject

/**
 * ConflictResolver — разрешение конфликтов синхронизации на Android.
 *
 * Реализует стратегии:
 * - LWW (Last-Write-Wins): по modifiedAt
 * - Local wins: всегда оставлять локальную версию
 * - Remote wins: всегда принимать удалённую версию
 *
 * Порт Electron ConflictResolver.ts на Kotlin.
 */
class ConflictResolver(private val db: SyncDatabase) {

    /**
     * Callback при обнаружении конфликта.
     */
    var onConflictCallback: ((SyncConflict) -> Unit)? = null

    /**
     * Результат проверки на конфликт.
     */
    data class ConflictCheckResult(
        val hasConflict: Boolean,
        val conflictId: Long? = null,
        val reason: String? = null // 'fork' | 'version_mismatch'
    )

    /**
     * Данные о конфликте для UI.
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

    /**
     * Регистрирует callback при обнаружении конфликта.
     */
    fun onConflict(callback: (SyncConflict) -> Unit) {
        onConflictCallback = callback
    }

    /**
     * Проверяет, есть ли конфликт между локальной и удалённой версией файла.
     *
     * @param localEntry локальная запись (может быть null для новых файлов)
     * @param remoteEntry удалённая запись из манифеста
     * @return результат проверки
     */
    fun checkForConflict(
        localEntry: LedgerEntryData?,
        remoteEntry: JSONObject
    ): ConflictCheckResult {
        // Если локальной записи нет — это новый файл, конфликта нет
        if (localEntry == null) {
            return ConflictCheckResult(hasConflict = false)
        }

        val remoteVersion = remoteEntry.optInt("version", 0)
        val remoteChecksum = remoteEntry.optString("checksum", "")

        // Если версии совпадают — конфликта нет
        if (localEntry.version == remoteVersion) {
            // Проверяем контрольную сумму на случай битого соединения
            if (localEntry.checksum != remoteChecksum) {
                // Контрольные суммы не совпадают — перезаписываем (remote wins)
                return ConflictCheckResult(hasConflict = false, reason = "version_mismatch")
            }
            return ConflictCheckResult(hasConflict = false)
        }

        // Если локальная версия выше — наши изменения новее
        if (localEntry.version > remoteVersion) {
            return ConflictCheckResult(hasConflict = false)
        }

        // Если удалённая версия выше — проверяем fork
        // Fork = локальная версия не является родительской для удалённой
        // Упрощённо: если localEntry.version !== remoteVersion - 1,
        // значит могли быть параллельные изменения
        if (remoteVersion > localEntry.version + 1) {
            // Потенциальный fork — записываем конфликт
            return createConflictRecord(localEntry, remoteEntry)
        }

        // Удалённая версия = local + 1 — нормальное обновление
        return ConflictCheckResult(hasConflict = false)
    }

    /**
     * Создаёт запись о конфликте в БД.
     */
    private fun createConflictRecord(
        localEntry: LedgerEntryData,
        remoteEntry: JSONObject
    ): ConflictCheckResult {
        val remotePath = remoteEntry.optString("path", "")
        val remoteVersion = remoteEntry.optInt("version", 0)
        val remoteChecksum = remoteEntry.optString("checksum", "")
        val remoteModifiedAt = remoteEntry.optLong("modifiedAt", 0L)

        val conflictId = db.addConflict(
            ConflictInput(
                fileId = localEntry.fileId,
                filePath = remotePath,
                localVersion = localEntry.version,
                remoteVersion = remoteVersion,
                localChecksum = localEntry.checksum,
                remoteChecksum = remoteChecksum,
                localModifiedAt = localEntry.modifiedAt,
                remoteModifiedAt = remoteModifiedAt,
                localContent = null,   // Ленивая загрузка контента
                remoteContent = null   // Ленивая загрузка контента
            )
        )

        val conflict = SyncConflict(
            conflictId = conflictId,
            fileId = localEntry.fileId,
            filePath = remotePath,
            localVersion = localEntry.version,
            remoteVersion = remoteVersion,
            localChecksum = localEntry.checksum,
            remoteChecksum = remoteChecksum,
            localModifiedAt = localEntry.modifiedAt,
            remoteModifiedAt = remoteModifiedAt,
            resolution = "pending",
            resolvedAt = null,
            resolvedBy = null,
            createdAt = System.currentTimeMillis()
        )

        // Оповещаем
        onConflictCallback?.invoke(conflict)

        return ConflictCheckResult(
            hasConflict = true,
            conflictId = conflictId,
            reason = "fork"
        )
    }

    /**
     * Автоматически разрешает конфликт по стратегии LWW.
     * Возвращает стратегию, которая должна быть применена.
     */
    fun autoResolve(conflict: SyncConflict): String /* 'local_wins' | 'remote_wins' */ {
        return if (conflict.localModifiedAt > conflict.remoteModifiedAt) {
            // Локальная версия новее
            db.resolveConflict(conflict.conflictId, "auto_resolved", "lww")
            "local_wins"
        } else if (conflict.remoteModifiedAt > conflict.localModifiedAt) {
            // Удалённая версия новее
            db.resolveConflict(conflict.conflictId, "auto_resolved", "lww")
            "remote_wins"
        } else {
            // Временные метки совпадают — выигрывает то устройство, у которого больше version
            if (conflict.localVersion >= conflict.remoteVersion) {
                db.resolveConflict(conflict.conflictId, "auto_resolved", "lww")
                "local_wins"
            } else {
                db.resolveConflict(conflict.conflictId, "auto_resolved", "lww")
                "remote_wins"
            }
        }
    }

    /**
     * Разрешает конфликт вручную (пользователь выбрал стратегию).
     */
    fun manualResolve(conflictId: Long, strategy: String /* 'local_wins' | 'remote_wins' */) {
        db.resolveConflict(conflictId, "manual", strategy)
    }

    /**
     * Получает список неразрешённых конфликтов.
     */
    fun getPendingConflicts(): List<SyncConflict> {
        val rows = db.getConflicts("pending")
        return rows.map { mapDbConflict(it) }
    }

    /**
     * Получает все конфликты.
     */
    fun getAllConflicts(): List<SyncConflict> {
        val rows = db.getConflicts()
        return rows.map { mapDbConflict(it) }
    }

    /**
     * Преобразует DTO БД в интерфейс для UI.
     */
    private fun mapDbConflict(row: ConflictData): SyncConflict {
        return SyncConflict(
            conflictId = row.id,
            fileId = row.fileId,
            filePath = row.filePath,
            localVersion = row.localVersion,
            remoteVersion = row.remoteVersion,
            localChecksum = row.localChecksum,
            remoteChecksum = row.remoteChecksum,
            localModifiedAt = row.localModifiedAt,
            remoteModifiedAt = row.remoteModifiedAt,
            resolution = row.resolution,
            resolvedAt = row.resolvedAt,
            resolvedBy = row.resolvedBy,
            createdAt = row.createdAt
        )
    }
}
