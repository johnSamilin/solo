/**
 * WebDAVTransport — реализация ISyncTransport для WebDAV.
 *
 * Работает как relay:
 * 1. Каждые N секунд проверяет манифесты других устройств на WebDAV
 * 2. Если есть новый/изменённый манифест → скачивает snapshot
 * 3. Применяет изменения локально
 * 4. Публикует свой манифест + snapshot
 *
 * Сервер используется ТОЛЬКО как канал — никакого состояния не хранится.
 */

import {
  ISyncTransport,
  SyncMode,
  SyncStatus,
  SyncEvent,
  SyncEventType,
  SyncConnectionState,
  PeerDevice,
  SyncConflict,
  WebDAVConfig,
  RemoteDeviceSnapshot,
  ManifestPayload,
  FileManifestEntry,
  TombstoneManifestEntry,
} from '../types';
import { WebDAVClient } from './WebDAVClient';
import { SnapshotManager, SyncSnapshot } from './SnapshotManager';

type SyncEventCallback = (event: SyncEvent) => void;

const WEBDAV_ROOT = '.solo-sync';

/**
 * Конфигурация для конструктора WebDAVTransport.
 */
export interface WebDAVTransportConfig {
  webdavConfig: WebDAVConfig;
  deviceId: string;
  deviceName: string;
  platform: string;
  /** Директория с данными приложения (для чтения файлов). */
  dataDir?: string;
  /** Функция, возвращающая локальный манифест. */
  getLocalManifest: () => Promise<ManifestPayload>;
  /** Функция, читающая файл и возвращающая его содержимое + метаданные. */
  readFileForSync: (fileId: string) => Promise<{
    content: string;
    metadata: string;
    version: number;
    checksum: string;
    modifiedAt: number;
    path: string;
  } | null>;
  /** Функция, сохраняющая полученный от пира файл. */
  saveReceivedFile: (fileId: string, content: string, metadata: string, version: number, checksum: string, modifiedAt: number, path: string) => Promise<boolean>;
  /** Функция, применяющая удаление файла (tombstone). */
  applyRemoteTombstone: (fileId: string, originalPath: string) => Promise<void>;
}

export class WebDAVTransport implements ISyncTransport {
  readonly mode: SyncMode = 'webdav';

  private config: WebDAVTransportConfig;
  private client: WebDAVClient;
  private eventSubscribers: Set<SyncEventCallback> = new Set();

  private _status: SyncStatus = {
    state: 'idle',
    lastSyncAt: null,
    connectedPeers: [],
    progress: null,
    error: null,
  };

  private pollingInterval: ReturnType<typeof setInterval> | null = null;
  private snapshotVersion = 0;
  private knownDevices: Map<string, RemoteDeviceSnapshot> = new Map();

  constructor(config: WebDAVTransportConfig) {
    this.config = config;
    this.client = new WebDAVClient(config.webdavConfig);
  }

  // ==================== ISyncTransport ====================

  async start(): Promise<boolean> {
    if (this.pollingInterval) {
      console.warn('[WebDAVTransport] Already started');
      return true;
    }

    console.log('[WebDAVTransport] Starting WebDAV sync...');

    // Проверяем соединение
    const connCheck = await this.client.checkConnection();
    if (!connCheck.success) {
      this._status.state = 'error';
      this._status.error = `WebDAV connection failed: ${connCheck.error}`;
      this.emitEvent('error', { message: this._status.error });
      return false;
    }

    // Создаём корневую директорию синхронизации
    await this.client.ensureDirectoryPath(WEBDAV_ROOT);

    // Публикуем первый слепок
    await this.publishSnapshot();

    this._status.state = 'idle';
    this.emitEvent('state_changed', { state: 'idle' });

    // Запускаем polling
    const intervalMs = this.config.webdavConfig.pollIntervalMs || 10000;
    this.pollingInterval = setInterval(() => this.poll(), intervalMs);
    console.log(`[WebDAVTransport] Polling started every ${intervalMs}ms`);

    return true;
  }

  async stop(): Promise<boolean> {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    this._status.state = 'idle';
    this.emitEvent('state_changed', { state: 'idle' });
    console.log('[WebDAVTransport] Stopped');
    return true;
  }

  getStatus(): SyncStatus {
    return this._status;
  }

  onEvent(callback: SyncEventCallback): () => void {
    this.eventSubscribers.add(callback);
    return () => {
      this.eventSubscribers.delete(callback);
    };
  }

  destroy(): void {
    this.stop();
    this.eventSubscribers.clear();
    this.knownDevices.clear();
  }

  // ==================== Polling logic ====================

  /**
   * Основной цикл: проверяет чужие слепки, применяет изменения, публикует свой.
   */
  private async poll(): Promise<void> {
    try {
      // 1. Список device-* директорий
      const entries = await this.client.listDir(WEBDAV_ROOT);

      // 2. Фильтруем только device-* директории (исключаем себя)
      const deviceDirs = entries.filter(e =>
        e.isDirectory &&
        e.path.startsWith(`${WEBDAV_ROOT}/device-`) &&
        !e.path.includes(this.config.deviceId)
      );

      let hasNewData = false;

      for (const dir of deviceDirs) {
        const manifestPath = `${dir.path}/manifest.json`;

        // Проверяем, есть ли манифест
        const exists = await this.client.fileExists(manifestPath);
        if (!exists) continue;

        // Читаем манифест
        const manifestJson = await this.client.getFileAsText(manifestPath);
        const remoteManifest = JSON.parse(manifestJson);

        const remoteDeviceId = remoteManifest.deviceId;
        const remoteVersion = remoteManifest.snapshotVersion || 0;
        const known = this.knownDevices.get(remoteDeviceId);

        // Если это новый или обновлённый слепок
        if (!known || remoteVersion > known.manifestVersion) {
          console.log(`[WebDAVTransport] New snapshot from ${remoteManifest.deviceName} (v${remoteVersion})`);

          // Обновляем knownDevices
          this.knownDevices.set(remoteDeviceId, {
            deviceId: remoteDeviceId,
            deviceName: remoteManifest.deviceName,
            platform: remoteManifest.platform,
            manifestVersion: remoteVersion,
            manifestTimestamp: remoteManifest.createdAt || Date.now(),
            manifestPath,
            snapshotPath: `${dir.path}/snapshot.json`,
            checksumPath: '', // не используем
          });

          // Читаем snapshot
          try {
            const snapshotJson = await this.client.getFileAsText(`${dir.path}/snapshot.json`);
            const remoteSnapshot: SyncSnapshot = JSON.parse(snapshotJson);

            // Применяем изменения
            await this.applyRemoteSnapshot(remoteSnapshot);
            hasNewData = true;
          } catch (err) {
            console.error(`[WebDAVTransport] Failed to process snapshot from ${remoteDeviceId}:`, err);
          }
        }
      }

      // 3. Публикуем свой слепок (если были изменения)
      if (hasNewData) {
        await this.publishSnapshot();
      }

    } catch (error) {
      console.error('[WebDAVTransport] Poll error:', error);
    }
  }

  /**
   * Применяет удалённый слепок: diff + скачивание нужных файлов + запись.
   */
  private async applyRemoteSnapshot(remoteSnapshot: SyncSnapshot): Promise<void> {
    this._status.state = 'syncing';
    this._status.progress = { totalFiles: 0, transferredFiles: 0, phase: 'diff' };
    this.emitEvent('state_changed', { state: 'syncing' });

    // Получаем локальный манифест
    const localManifest = await this.config.getLocalManifest();

    // Вычисляем diff
    const diff = SnapshotManager.computeDiff(localManifest, remoteSnapshot.manifest);

    this._status.progress = {
      totalFiles: diff.neededFiles.length + diff.neededTombstones.length,
      transferredFiles: 0,
      phase: 'transfer',
    };
    this.emitEvent('sync_progress', this._status.progress);

    // Применяем tombstones (удаления)
    for (const fileId of diff.neededTombstones) {
      const tombstone = remoteSnapshot.manifest.tombstones.find(t => t.fileId === fileId);
      if (tombstone) {
        await this.config.applyRemoteTombstone(fileId, tombstone.originalPath);
        this._status.progress!.transferredFiles++;
        this.emitEvent('sync_progress', this._status.progress);
        this.emitEvent('file_deleted_remotely', { fileId, path: tombstone.originalPath });
      }
    }

    // Запрашиваем нужные файлы из слепка
    for (const fileId of diff.neededFiles) {
      const remoteFile = remoteSnapshot.files[fileId];
      if (!remoteFile) continue;

      const saved = await this.config.saveReceivedFile(
        fileId,
        remoteFile.content,
        remoteFile.metadata,
        remoteFile.version,
        remoteFile.checksum,
        remoteFile.modifiedAt,
        remoteFile.path
      );

      if (saved) {
        this._status.progress!.transferredFiles++;
        this.emitEvent('sync_progress', this._status.progress);
        this.emitEvent('file_synced', { fileId, path: remoteFile.path, version: remoteFile.version });
      }
    }

    this._status.state = 'complete';
    this._status.lastSyncAt = Date.now();
    this._status.progress = null;
    this.emitEvent('sync_complete', {
      summary: {
        filesTransferred: diff.neededFiles.length,
        tombstonesApplied: diff.neededTombstones.length,
        conflictsDetected: 0,
        duration: 0,
      },
    });
  }

  /**
   * Формирует и публикует свой слепок на WebDAV.
   */
  private async publishSnapshot(): Promise<void> {
    try {
      this.snapshotVersion++;

      // Получаем локальный манифест
      const manifest = await this.config.getLocalManifest();

      // Читаем содержимое файлов
      const fileContents: SyncSnapshot['files'] = {};
      for (const file of manifest.files) {
        const data = await this.config.readFileForSync(file.fileId);
        if (data) {
          fileContents[file.fileId] = {
            content: data.content,
            metadata: data.metadata,
            version: data.version,
            checksum: data.checksum,
            modifiedAt: data.modifiedAt,
            path: data.path,
          };
        }
      }

      // Создаём слепок
      const snapshot = SnapshotManager.createSnapshot(
        this.config.deviceId,
        this.config.deviceName,
        this.config.platform,
        this.snapshotVersion,
        manifest,
        fileContents
      );

      // Путь для нашего устройства
      const devicePath = `${WEBDAV_ROOT}/device-${this.config.deviceId}`;
      await this.client.ensureDirectoryPath(devicePath);

      // Публикуем manifest.json + snapshot.json
      const serialized = SnapshotManager.serialize(snapshot);
      const manifestPayload = JSON.stringify({
        deviceId: this.config.deviceId,
        deviceName: this.config.deviceName,
        platform: this.config.platform,
        snapshotVersion: this.snapshotVersion,
        createdAt: snapshot.createdAt,
        fileCount: manifest.files.length,
        tombstoneCount: manifest.tombstones.length,
      });

      await this.client.putFile(`${devicePath}/manifest.json`, manifestPayload);
      await this.client.putFile(`${devicePath}/snapshot.json`, serialized);

      console.log(`[WebDAVTransport] Published snapshot v${this.snapshotVersion} (${manifest.files.length} files)`);

      // Обновляем статус connectedPeers
      const remoteDevices = Array.from(this.knownDevices.values());
      this._status.connectedPeers = remoteDevices.map(d => ({
        id: d.deviceId,
        name: d.deviceName,
        deviceType: d.platform as any,
        lastSeenAt: d.manifestTimestamp,
        firstSeenAt: d.manifestTimestamp,
        trustStatus: 'trusted' as const,
        isPaired: true,
        protocolVersion: 1,
      }));

    } catch (error) {
      console.error('[WebDAVTransport] Failed to publish snapshot:', error);
    }
  }

  // ==================== Event helpers ====================

  private emitEvent(type: SyncEventType, data?: any): void {
    const event: SyncEvent = { type, timestamp: Date.now(), data };
    for (const cb of this.eventSubscribers) {
      try {
        cb(event);
      } catch (error) {
        console.error('[WebDAVTransport] Event callback error:', error);
      }
    }
  }
}
