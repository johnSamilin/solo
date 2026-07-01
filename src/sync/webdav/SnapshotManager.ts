/**
 * SnapshotManager — формирование и парсинг слепков (snapshot) файлов для WebDAV.
 *
 * Слепок — это tar.gz архив, содержащий:
 * - manifest.json: список файлов, их версий и контрольных сумм
 * - files/: директория с файлами (путь сохраняется относительным)
 *
 * Альтернативно, вместо tar.gz используем простой JSON с base64-содержимым.
 * Это проще для реализации на чистом JS без внешних библиотек.
 */

import {
  FileManifestEntry,
  TombstoneManifestEntry,
  ManifestPayload,
  PeerDevice,
} from '../types';

/*
 * Из-за отсутствия встроенной tar-поддержки в браузере/Node.js,
 * используем формат "только manifest + base64 файлы в JSON".
 *
 * Структура JSON-слепка:
 * {
 *   deviceId: "solo:...",
 *   deviceName: "My Laptop",
 *   platform: "electron",
 *   snapshotVersion: number,
 *   createdAt: timestamp,
 *   manifest: ManifestPayload,
 *   files: { [fileId]: { content: base64, metadata: json } }
 * }
 */

export interface SyncSnapshot {
  deviceId: string;
  deviceName: string;
  platform: string;
  snapshotVersion: number;
  createdAt: number;
  manifest: ManifestPayload;
  files: Record<string, {
    content: string;      // base64-encoded file content
    metadata: string;     // JSON string
    version: number;
    checksum: string;
    modifiedAt: number;
    path: string;
  }>;
}

export interface SnapshotDiff {
  neededFiles: string[];
  neededTombstones: string[];
}

export class SnapshotManager {
  /**
   * Создаёт JSON-слепок для публикации на WebDAV.
   */
  static createSnapshot(
    deviceId: string,
    deviceName: string,
    platform: string,
    snapshotVersion: number,
    manifest: ManifestPayload,
    fileContents: Record<string, { content: string; metadata: string; version: number; checksum: string; modifiedAt: number; path: string }>
  ): SyncSnapshot {
    return {
      deviceId,
      deviceName,
      platform,
      snapshotVersion,
      createdAt: Date.now(),
      manifest,
      files: fileContents,
    };
  }

  /**
   * Вычисляет diff между нашим манифестом и удалённым (чужим) слепком.
   * Возвращает список fileId, которые нам нужны.
   */
  static computeDiff(
    localManifest: ManifestPayload,
    remoteManifest: ManifestPayload
  ): SnapshotDiff {
    const neededFiles: string[] = [];
    const neededTombstones: string[] = [];

    // Строим карту локальных файлов
    const localFiles = new Map<string, FileManifestEntry>();
    for (const f of localManifest.files) {
      localFiles.set(f.fileId, f);
    }

    // Строим карту локальных tombstones
    const localTombstones = new Set(localManifest.tombstones.map(t => t.fileId));

    // Строим карту удалённых файлов
    const remoteFiles = new Map<string, FileManifestEntry>();
    for (const f of remoteManifest.files) {
      remoteFiles.set(f.fileId, f);
    }

    const remoteTombstones = new Set(remoteManifest.tombstones.map(t => t.fileId));

    // 1. Файлы, которые есть у пира, но нет у нас (или новее версия)
    for (const [fileId, remoteFile] of remoteFiles) {
      const localFile = localFiles.get(fileId);

      if (!localFile) {
        // Файла нет локально — запрашиваем
        neededFiles.push(fileId);
      } else if (remoteFile.version > localFile.version) {
        // У пира новее — запрашиваем
        neededFiles.push(fileId);
      } else if (remoteFile.version === localFile.version && remoteFile.checksum !== localFile.checksum) {
        // Версии совпадают, но разные контрольные суммы — конфликт
        // При LWW: выигрывает тот, у кого новее modifiedAt
        if (remoteFile.modifiedAt > localFile.modifiedAt) {
          neededFiles.push(fileId);
        }
        // Иначе ничего не делаем — локальная версия остаётся
      }
      // Если локальная версия новее — ничего не делаем, пир запросит у нас
    }

    // 2. Tombstones, которые есть у пира, но нет у нас
    for (const fileId of remoteTombstones) {
      if (!localTombstones.has(fileId) && localFiles.has(fileId)) {
        // Пир удалил файл, который у нас есть — применяем удаление
        neededTombstones.push(fileId);
      }
    }

    return { neededFiles, neededTombstones };
  }

  /**
   * Применяет удалённый слепок: для каждого нужного файла возвращает его содержимое.
   */
  static extractNeededFiles(
    remoteSnapshot: SyncSnapshot,
    diff: SnapshotDiff
  ): SyncSnapshot['files'] {
    const result: SyncSnapshot['files'] = {};

    for (const fileId of diff.neededFiles) {
      if (remoteSnapshot.files[fileId]) {
        result[fileId] = remoteSnapshot.files[fileId];
      }
    }

    return result;
  }

  /**
   * Создаёт строку JSON для загрузки на WebDAV.
   */
  static serialize(snapshot: SyncSnapshot): string {
    return JSON.stringify(snapshot);
  }

  /**
   * Парсит JSON со слепком.
   */
  static deserialize(json: string): SyncSnapshot {
    return JSON.parse(json);
  }
}
