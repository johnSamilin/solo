/**
 * ConflictResolver — разрешение конфликтов синхронизации.
 *
 * Реализует стратегии:
 * - LWW (Last-Write-Wins): по modifiedAt
 * - Local wins: всегда оставлять локальную версию
 * - Remote wins: всегда принимать удалённую версию
 */

import { SyncDatabase, DBConflict } from './SyncDatabase';
import {
  FileManifestEntry,
  FilePayload,
  SyncConflict,
  SyncEvent,
} from './types';

export interface ConflictCheckResult {
  hasConflict: boolean;
  conflictId?: number;
  reason?: 'fork' | 'version_mismatch';
}

export class ConflictResolver {
  private db: SyncDatabase;
  private onConflictCallback: ((conflict: SyncConflict) => void) | null = null;

  constructor(db: SyncDatabase) {
    this.db = db;
  }

  /**
   * Регистрирует callback при обнаружении конфликта.
   */
  onConflict(callback: (conflict: SyncConflict) => void): void {
    this.onConflictCallback = callback;
  }

  /**
   * Проверяет, есть ли конфликт между локальной и удалённой версией файла.
   *
   * Возвращает:
   * - hasConflict: true если обнаружен fork (обе версии изменились независимо)
   * - conflictId: ID записи в sync_conflicts (если конфликт)
   * - reason: причина конфликта
   */
  checkForConflict(
    localEntry: { fileId: string; version: number; checksum: string; modifiedAt: number } | undefined,
    remoteEntry: FileManifestEntry
  ): ConflictCheckResult {
    // Если локальной записи нет — это новый файл, конфликта нет
    if (!localEntry) {
      return { hasConflict: false };
    }

    // Если версии совпадают — конфликта нет
    if (localEntry.version === remoteEntry.version) {
      // Проверяем контрольную сумму на случай битого соединения
      if (localEntry.checksum !== remoteEntry.checksum) {
        // Контрольные суммы не совпадают — перезаписываем (remote wins)
        return { hasConflict: false, reason: 'version_mismatch' };
      }
      return { hasConflict: false };
    }

    // Если локальная версия выше — наши изменения новее
    if (localEntry.version > remoteEntry.version) {
      return { hasConflict: false };
    }

    // Если удалённая версия выше — проверяем fork
    // Fork = локальная версия не является родительской для удалённой
    // Упрощённо: если localEntry.version !== remoteEntry.version - 1,
    // значит могли быть параллельные изменения
    if (remoteEntry.version > localEntry.version + 1) {
      // Потенциальный fork — записываем конфликт
      return this.createConflictRecord(localEntry, remoteEntry);
    }

    // Удалённая версия = local + 1 — нормальное обновление
    return { hasConflict: false };
  }

  /**
   * Создаёт запись о конфликте в БД.
   */
  private createConflictRecord(
    localEntry: { fileId: string; version: number; checksum: string; modifiedAt: number },
    remoteEntry: FileManifestEntry
  ): ConflictCheckResult {
    const conflictId = this.db.addConflict({
      fileId: localEntry.fileId,
      filePath: remoteEntry.path,
      localVersion: localEntry.version,
      remoteVersion: remoteEntry.version,
      localChecksum: localEntry.checksum,
      remoteChecksum: remoteEntry.checksum,
      localModifiedAt: localEntry.modifiedAt,
      remoteModifiedAt: remoteEntry.modifiedAt,
      localContent: null,   // Ленивая загрузка контента
      remoteContent: null,  // Ленивая загрузка контента
    });

    const conflict: SyncConflict = {
      conflictId,
      fileId: localEntry.fileId,
      filePath: remoteEntry.path,
      localVersion: localEntry.version,
      remoteVersion: remoteEntry.version,
      localChecksum: localEntry.checksum,
      remoteChecksum: remoteEntry.checksum,
      localModifiedAt: localEntry.modifiedAt,
      remoteModifiedAt: remoteEntry.modifiedAt,
      resolution: 'pending',
      resolvedAt: null,
      resolvedBy: null,
      createdAt: Date.now(),
    };

    // Оповещаем
    if (this.onConflictCallback) {
      this.onConflictCallback(conflict);
    }

    return { hasConflict: true, conflictId, reason: 'fork' };
  }

  /**
   * Автоматически разрешает конфликт по стратегии LWW.
   * Возвращает стратегию, которая должна быть применена.
   */
  autoResolve(conflict: SyncConflict): 'local_wins' | 'remote_wins' {
    if (conflict.localModifiedAt > conflict.remoteModifiedAt) {
      // Локальная версия новее
      this.db.resolveConflict(conflict.conflictId, 'auto_resolved', 'lww');
      return 'local_wins';
    } else if (conflict.remoteModifiedAt > conflict.localModifiedAt) {
      // Удалённая версия новее
      this.db.resolveConflict(conflict.conflictId, 'auto_resolved', 'lww');
      return 'remote_wins';
    } else {
      // Временные метки совпадают — выигрывает то устройство, у которого больше version
      if (conflict.localVersion >= conflict.remoteVersion) {
        this.db.resolveConflict(conflict.conflictId, 'auto_resolved', 'lww');
        return 'local_wins';
      } else {
        this.db.resolveConflict(conflict.conflictId, 'auto_resolved', 'lww');
        return 'remote_wins';
      }
    }
  }

  /**
   * Разрешает конфликт вручную (пользователь выбрал стратегию).
   */
  manualResolve(conflictId: number, strategy: 'local_wins' | 'remote_wins'): void {
    this.db.resolveConflict(conflictId, 'manual', strategy);
  }

  /**
   * Получает список неразрешённых конфликтов.
   */
  getPendingConflicts(): SyncConflict[] {
    const rows = this.db.getConflicts('pending');
    return rows.map(this.mapDbConflict);
  }

  /**
   * Получает все конфликты.
   */
  getAllConflicts(): SyncConflict[] {
    const rows = this.db.getConflicts();
    return rows.map(this.mapDbConflict);
  }

  /**
   * Преобразует DTO БД в интерфейс для UI.
   */
  private mapDbConflict(row: DBConflict): SyncConflict {
    return {
      conflictId: row.id,
      fileId: row.fileId,
      filePath: row.filePath,
      localVersion: row.localVersion,
      remoteVersion: row.remoteVersion,
      localChecksum: row.localChecksum,
      remoteChecksum: row.remoteChecksum,
      localModifiedAt: row.localModifiedAt,
      remoteModifiedAt: row.remoteModifiedAt,
      resolution: row.resolution,
      resolvedAt: row.resolvedAt,
      resolvedBy: row.resolvedBy as any,
      createdAt: row.createdAt,
    };
  }
}
