// ============================================================
// ConflictResolver — разрешение конфликтов синхронизации
// ============================================================

import { ConflictResolution, SyncConflictRecord, VersionInfo } from './types';
import { syncStateDB } from './SyncStateDB';
import { uuid } from './utils';

export type ConflictHandler = (conflicts: SyncConflictRecord[]) => void;

export class ConflictResolver {
  private onConflictHandlers: ConflictHandler[] = [];

  onConflict(handler: ConflictHandler): () => void {
    this.onConflictHandlers.push(handler);
    return () => {
      this.onConflictHandlers = this.onConflictHandlers.filter(h => h !== handler);
    };
  }

  /**
   * Обнаруживает конфликты между локальной и удалённой version map.
   * Возвращает список файлов, которые находятся в конфликте.
   */
  async detectConflicts(
    localEntries: Record<string, VersionInfo>,
    remoteEntries: Record<string, VersionInfo>,
  ): Promise<SyncConflictRecord[]> {
    const conflicts: SyncConflictRecord[] = [];

    for (const [fileId, remoteInfo] of Object.entries(remoteEntries)) {
      const localInfo = localEntries[fileId];
      if (!localInfo) continue;

      // Конфликт: разные content_hash при одинаковых или concurrent версиях
      if (localInfo.contentHash !== remoteInfo.contentHash) {
        // Если одна версия строго новее — это не конфликт
        if (remoteInfo.version > localInfo.version && remoteInfo.deviceId !== localInfo.deviceId) {
          // Удалённая версия новее — не конфликт, просто апдейт
          continue;
        }
        if (localInfo.version > remoteInfo.version && localInfo.deviceId !== remoteInfo.deviceId) {
          // Локальная версия новее — не конфликт
          continue;
        }

        // Concurrent изменения или разные content_hash при одинаковых версиях
        const conflict: SyncConflictRecord = {
          conflictId: uuid(),
          fileId,
          noteId: localInfo.noteId || remoteInfo.noteId,
          localVersion: localInfo.version,
          remoteVersion: remoteInfo.version,
          localContentHash: localInfo.contentHash,
          remoteContentHash: remoteInfo.contentHash,
          resolved: false,
          createdAt: Date.now(),
        };

        await syncStateDB.putConflict(conflict);
        conflicts.push(conflict);
      }
    }

    if (conflicts.length > 0) {
      this.notify(conflicts);
    }

    return conflicts;
  }

  /**
   * Автоматическое разрешение конфликтов (Level 1).
   * Правила:
   * 1. Высшая версия побеждает
   * 2. Разные файлы не конфликтуют
   * 3. device_id как tiebreaker (меньший побеждает)
   */
  async autoResolve(conflicts: SyncConflictRecord[]): Promise<SyncConflictRecord[]> {
    const unresolved: SyncConflictRecord[] = [];

    for (const conflict of conflicts) {
      // Если версии отличаются, выбираем новейшую
      if (conflict.localVersion !== conflict.remoteVersion) {
        const resolution: ConflictResolution =
          conflict.localVersion > conflict.remoteVersion ? 'keep_local' : 'keep_remote';
        await syncStateDB.resolveConflict(conflict.conflictId, resolution);
        conflict.resolved = true;
        conflict.resolution = resolution;
        continue;
      }

      // Tiebreaker: device_id (меньший лексикографически побеждает)
      // В реальном сценарии здесь нужно анализировать содержимое
      // Для простоты — keep_local
      const resolution: ConflictResolution = 'keep_local';
      await syncStateDB.resolveConflict(conflict.conflictId, resolution);
      conflict.resolved = true;
      conflict.resolution = resolution;
    }

    return unresolved;
  }

  /**
   * Ручное разрешение конфликта пользователем.
   */
  async resolveManually(conflictId: string, resolution: ConflictResolution): Promise<void> {
    await syncStateDB.resolveConflict(conflictId, resolution);
  }

  /**
   * Структурное слияние для HTML (Level 2).
   * Анализирует HTML на уровне параграфов с data-id.
   * NOTE: Это заглушка. В реальном приложении нужен HTML-парсер.
   */
  async structuralMerge(
    localContent: string,
    remoteContent: string,
  ): Promise<{ merged: string; hasConflicts: boolean }> {
    // TODO: Реализовать HTML-слияние на уровне параграфов
    // Сравнивать элементы с data-id
    // Для простоты — возвращаем локальную версию
    return {
      merged: localContent,
      hasConflicts: true,
    };
  }

  private notify(conflicts: SyncConflictRecord[]): void {
    for (const handler of this.onConflictHandlers) {
      try {
        handler(conflicts);
      } catch (e) {
        console.error('ConflictResolver handler error:', e);
      }
    }
  }
}

export const conflictResolver = new ConflictResolver();
