/**
 * SyncStore — MobX-обёртка над TransportManager.
 *
 * Предоставляет наблюдаемое состояние синхронизации для React-компонентов.
 * Поддерживает Bluetooth и WebDAV режимы.
 *
 * Bluetooth: использует getNativeAPI() для доступа к методам SyncBridgeAPI.
 * WebDAV: работает напрямую через HTTP (fetch).
 */

import { makeAutoObservable } from 'mobx';
import { getNativeAPI } from '../utils/nativeBridge';
import { TransportManager, WebDAVTransportSetup } from '../sync/TransportManager';
import {
  SyncBridgeAPI,
  SyncStatus,
  SyncConflict,
  PeerDevice,
  SyncConnectionState,
  SyncEvent,
  SyncMode,
  WebDAVConfig,
  ManifestPayload,
  FileManifestEntry,
} from '../sync/types';

const SYNC_SETTINGS_KEY = 'solo-sync-settings';

/**
 * Сохраняемые настройки синхронизации.
 */
interface SyncSettings {
  syncMode: SyncMode;
  deviceName: string;
  isEnabled: boolean;
  webdavUrl: string;
  webdavUsername: string;
  webdavPassword: string;
  webdavPollIntervalMs: number;
}

export class SyncStore {
  private transportManager: TransportManager;
  private _rootStore: any = null;

  // ---- Наблюдаемое состояние ----
  status: SyncStatus = {
    state: 'idle',
    lastSyncAt: null,
    connectedPeers: [],
    progress: null,
    error: null,
  };

  conflicts: SyncConflict[] = [];
  availablePeers: PeerDevice[] = [];
  pairedPeers: PeerDevice[] = [];
  isSyncModalOpen = false;
  isConflictPanelOpen = false;

  // Устройство
  deviceName = '';
  isEnabled = false;

  // Режим синхронизации
  syncMode: SyncMode = 'bluetooth';

  // WebDAV настройки
  webdavUrl = '';
  webdavUsername = '';
  webdavPassword = '';
  webdavPollIntervalMs = 10000;
  webdavConnected = false;

  constructor() {
    this.transportManager = new TransportManager();
    makeAutoObservable(this);
    this.loadSettings();
    this.initBridge();
  }

  /**
   * Устанавливает ссылку на RootStore для доступа к NotesStore и другим сторам.
   */
  setRootStore(rootStore: any): void {
    this._rootStore = rootStore;
  }

  /**
   * Возвращает NotesStore, если он доступен.
   */
  private get notesStore(): any | null {
    return this._rootStore?.notesStore || null;
  }

  // ========== Загрузка/сохранение настроек ==========

  private loadSettings(): void {
    const stored = localStorage.getItem(SYNC_SETTINGS_KEY);
    if (!stored) return;

    try {
      const parsed: SyncSettings = JSON.parse(stored);
      this.syncMode = parsed.syncMode || 'bluetooth';
      this.deviceName = parsed.deviceName || '';
      this.isEnabled = parsed.isEnabled || false;
      this.webdavUrl = parsed.webdavUrl || '';
      this.webdavUsername = parsed.webdavUsername || '';
      this.webdavPassword = parsed.webdavPassword || '';
      this.webdavPollIntervalMs = parsed.webdavPollIntervalMs || 10000;
    } catch {
      // ignore
    }
  }

  private saveSettings(): void {
    const data: SyncSettings = {
      syncMode: this.syncMode,
      deviceName: this.deviceName,
      isEnabled: this.isEnabled,
      webdavUrl: this.webdavUrl,
      webdavUsername: this.webdavUsername,
      webdavPassword: this.webdavPassword,
      webdavPollIntervalMs: this.webdavPollIntervalMs,
    };
    localStorage.setItem(SYNC_SETTINGS_KEY, JSON.stringify(data));
  }

  // ========== Bridge (только для Bluetooth) ==========

  private initBridge(): void {
    const api = getNativeAPI();
    if (!api) return;

    // Проверяем, доступны ли методы синхронизации
    if (typeof api.syncStart !== 'function') {
      console.warn('[SyncStore] sync methods not available in native API');
      return;
    }

    const bridge: SyncBridgeAPI = {
      syncStart: () => api.syncStart!(),
      syncStop: () => api.syncStop!(),
      syncGetStatus: () => api.syncGetStatus!(),
      syncDiscoverPeers: () => api.syncDiscoverPeers!(),
      syncPairDevice: (id: string) => api.syncPairDevice!(id),
      syncUnpairDevice: (id: string) => api.syncUnpairDevice!(id),
      syncGetPeers: () => api.syncGetPeers!(),
      syncGetConflicts: () => api.syncGetConflicts!(),
      syncResolveConflict: (id: number, strategy: 'local_wins' | 'remote_wins') =>
        api.syncResolveConflict!(id, strategy),
      onSyncEvent: (cb: (event: SyncEvent) => void) => {
        if (typeof api.onSyncEvent === 'function') {
          return api.onSyncEvent(cb);
        }
        console.warn('[SyncStore] onSyncEvent not available');
        return () => {};
      },
    };

    this.transportManager.setBridge(bridge);
    this.setupSubscriptions();
  }

  private setupSubscriptions(): void {
    this.transportManager.subscribe('sync-store', {
      onStateChange: () => {},
      onEvent: (event: SyncEvent) => {
        this.handleSyncEvent(event);
      },
    });

    // Инициализируем режим после подписки
    this.applySyncMode(this.syncMode);
  }

  private handleSyncEvent(event: SyncEvent): void {
    switch (event.type) {
      case 'state_changed':
        this.status = { ...this.transportManager.status };
        break;

      case 'sync_progress':
        this.status = { ...this.transportManager.status };
        break;

      case 'sync_complete':
        this.status = { ...this.transportManager.status };
        this.refreshConflicts();
        this.refreshPeers();
        break;

      case 'conflict_detected':
        this.refreshConflicts();
        break;

      case 'conflict_resolved':
        this.refreshConflicts();
        break;

      case 'peer_discovered':
        this.refreshAvailablePeers();
        break;

      case 'peer_connected':
      case 'peer_disconnected':
        this.refreshPeers();
        break;

      case 'error':
        this.status = { ...this.transportManager.status };
        break;
    }
  }

  // ========== Режим синхронизации ==========

  /**
   * Переключает режим синхронизации.
   */
  async setSyncMode(mode: SyncMode): Promise<boolean> {
    if (mode === this.syncMode) return true;

    const ok = await this.applySyncMode(mode);
    if (ok) {
      this.syncMode = mode;
      this.saveSettings();

      // Если синхронизация была включена — перезапускаем
      if (this.isEnabled) {
        await this.stopSync();
        await this.startSync();
      }
    }
    return ok;
  }

  /**
   * Применяет режим синхронизации к TransportManager.
   */
  private async applySyncMode(mode: SyncMode): Promise<boolean> {
    if (mode === 'webdav') {
      // Конфигурируем WebDAV транспорт
      const webdavConfig: WebDAVConfig = {
        url: this.webdavUrl,
        username: this.webdavUsername,
        password: this.webdavPassword,
        pollIntervalMs: this.webdavPollIntervalMs,
      };

      const setup: WebDAVTransportSetup = {
        config: webdavConfig,
        deviceId: this.getDeviceId(),
        deviceName: this.deviceName || 'Solo Device',
        platform: this.getPlatform(),
        getLocalManifest: () => this.getLocalManifest(),
        readFileForSync: (fileId) => this.readFileForSync(fileId),
        saveReceivedFile: (fileId, content, metadata, version, checksum, modifiedAt, path) =>
          this.saveReceivedFile(fileId, content, metadata, version, checksum, modifiedAt, path),
        applyRemoteTombstone: (fileId, originalPath) =>
          this.applyRemoteTombstone(fileId, originalPath),
      };

      this.transportManager.configureWebDAV(setup);
    }

    return this.transportManager.setMode(mode);
  }

  // ========== Провайдеры для WebDAVTransport ==========

  /**
   * Строит манифест из всех заметок NotesStore.
   */
  private async getLocalManifest(): Promise<ManifestPayload> {
    const ns = this.notesStore;
    if (!ns) return { files: [], tombstones: [] };

    const files: FileManifestEntry[] = [];
    for (const note of ns.notes) {
      const content = note.content || '';
      const checksum = await this.calculateChecksum(content);
      const modifiedAt = note.createdAt instanceof Date
        ? note.createdAt.getTime()
        : Date.now();
      files.push({
        fileId: note.id,
        version: modifiedAt,
        checksum,
        modifiedAt,
        path: note.path || note.id,
        sizeBytes: new Blob([content]).size,
      });
    }

    return { files, tombstones: [] };
  }

  /**
   * Читает содержимое заметки по fileId (id заметки = path).
   * Возвращает base64-encoded контент и метаданные.
   */
  private async readFileForSync(fileId: string): Promise<{
    content: string; metadata: string; version: number; checksum: string; modifiedAt: number; path: string;
  } | null> {
    const ns = this.notesStore;
    if (!ns) return null;

    const note = ns.notes.find((n: any) => n.id === fileId);
    if (!note) return null;

    // Если контент ещё не загружен — загружаем
    if (!note.content && typeof ns.loadNoteContent === 'function') {
      await ns.loadNoteContent(note);
    }

    const content = note.content || '';
    const base64Content = btoa(content);
    const checksum = await this.calculateChecksum(content);
    const modifiedAt = note.createdAt instanceof Date
      ? note.createdAt.getTime()
      : Date.now();
    const metadata = JSON.stringify({
      title: note.title,
      tags: note.tags,
      fileType: note.fileType,
      createdAt: note.createdAt,
    });

    return {
      content: base64Content,
      metadata,
      version: modifiedAt,
      checksum,
      modifiedAt,
      path: note.path || note.id,
    };
  }

  /**
   * Сохраняет полученный файл как новую заметку.
   */
  private async saveReceivedFile(
    fileId: string, contentBase64: string, metadataJson: string, _version: number,
    _checksum: string, _modifiedAt: number, _path: string
  ): Promise<boolean> {
    const ns = this.notesStore;
    if (!ns) return false;

    try {
      const content = atob(contentBase64);
      const meta = JSON.parse(metadataJson);
      const title = meta.title || fileId.split('/').pop()?.replace(/\.(html|pdf)$/, '') || 'Synced Note';

      // Проверяем, существует ли уже заметка с таким fileId
      const existing = ns.notes.find((n: any) => n.id === fileId);
      if (existing) {
        // Обновляем существующую
        await ns.updateNote(fileId, { content });
        return true;
      }

      // Создаём новую заметку через native API
      if (typeof ns.createNote === 'function') {
        await ns.createNote();
        // После создания заметки обновляем её id на fileId
        // и устанавливаем контент
        const created = ns.selectedNote;
        if (created) {
          await ns.updateNote(created.id, {
            id: fileId,
            title,
            content,
            tags: meta.tags || [],
          });
        }
        return true;
      }

      return false;
    } catch (err) {
      console.error('[SyncStore] saveReceivedFile error:', err);
      return false;
    }
  }

  /**
   * Удаляет заметку при получении tombstone.
   */
  private async applyRemoteTombstone(fileId: string, _originalPath: string): Promise<void> {
    const ns = this.notesStore;
    if (!ns) return;

    try {
      const note = ns.notes.find((n: any) => n.id === fileId);
      if (note && typeof ns.deleteNote === 'function') {
        await ns.deleteNote(fileId);
      }
    } catch (err) {
      console.error('[SyncStore] applyRemoteTombstone error:', err);
    }
  }

  // ========== Утилиты ==========

  /**
   * Вычисляет SHA-256 чексумму строки через Web Crypto API.
   */
  private async calculateChecksum(content: string): Promise<string> {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(content);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // fallback при недоступности crypto.subtle
      let hash = 0;
      for (let i = 0; i < content.length; i++) {
        const char = content.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
      }
      return Math.abs(hash).toString(16);
    }
  }

  private getDeviceId(): string {
    // Генерируем или получаем ID устройства
    let deviceId = localStorage.getItem('solo-device-id');
    if (!deviceId) {
      deviceId = `solo:${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      localStorage.setItem('solo-device-id', deviceId);
    }
    return deviceId;
  }

  private getPlatform(): string {
    const ua = navigator.userAgent;
    if (/android/i.test(ua)) return 'android';
    if (/electron/i.test(ua)) return 'electron';
    if (/mac/i.test(ua)) return 'mac';
    if (/linux/i.test(ua)) return 'linux';
    return 'web';
  }

  // ========== WebDAV настройки ==========

  setWebdavUrl(url: string): void {
    this.webdavUrl = url;
    this.saveSettings();
  }

  setWebdavUsername(username: string): void {
    this.webdavUsername = username;
    this.saveSettings();
  }

  setWebdavPassword(password: string): void {
    this.webdavPassword = password;
    this.saveSettings();
  }

  setWebdavPollInterval(ms: number): void {
    this.webdavPollIntervalMs = ms;
    this.saveSettings();
  }

  // ========== Экшены ==========

  setDeviceName = (name: string): void => {
    this.deviceName = name;
    this.saveSettings();
  };

  setEnabled = (enabled: boolean): void => {
    this.isEnabled = enabled;
    this.saveSettings();
    if (enabled) {
      this.startSync();
    } else {
      this.stopSync();
    }
  };

  setSyncModalOpen = (open: boolean): void => {
    this.isSyncModalOpen = open;
  };

  setConflictPanelOpen = (open: boolean): void => {
    this.isConflictPanelOpen = open;
  };

  // ========== Управление синхронизацией ==========

  async startSync(): Promise<boolean> {
    const ok = await this.transportManager.startSync();
    if (ok) {
      await this.refreshStatus();
    }
    return ok;
  }

  async stopSync(): Promise<boolean> {
    const ok = await this.transportManager.stopSync();
    if (ok) {
      await this.refreshStatus();
    }
    return ok;
  }

  async refreshStatus(): Promise<void> {
    const st = await this.transportManager.refreshStatus();
    if (st) {
      this.status = st;
    }
  }

  // ========== Пиры ==========

  async discoverPeers(): Promise<void> {
    this.availablePeers = await this.transportManager.discoverPeers();
  }

  async pairDevice(deviceId: string): Promise<boolean> {
    const ok = await this.transportManager.pairDevice(deviceId);
    if (ok) {
      await this.refreshPeers();
    }
    return ok;
  }

  async unpairDevice(deviceId: string): Promise<boolean> {
    const ok = await this.transportManager.unpairDevice(deviceId);
    if (ok) {
      await this.refreshPeers();
    }
    return ok;
  }

  async refreshPeers(): Promise<void> {
    this.pairedPeers = await this.transportManager.getPeers();
  }

  async refreshAvailablePeers(): Promise<void> {
    await this.discoverPeers();
  }

  // ========== Конфликты ==========

  async refreshConflicts(): Promise<void> {
    this.conflicts = await this.transportManager.getConflicts();
  }

  async resolveConflict(
    conflictId: number,
    strategy: 'local_wins' | 'remote_wins'
  ): Promise<boolean> {
    const ok = await this.transportManager.resolveConflict(conflictId, strategy);
    if (ok) {
      await this.refreshConflicts();
      await this.refreshStatus();
    }
    return ok;
  }

  // ========== Утилиты ==========

  get hasConflicts(): boolean {
    return this.conflicts.length > 0;
  }

  get isSyncing(): boolean {
    return ['discovering', 'connecting', 'handshake', 'syncing', 'resolving_conflicts'].includes(
      this.status.state
    );
  }

  get stateLabel(): string {
    const labels: Record<string, string> = {
      idle: 'Idle',
      discovering: 'Discovering',
      connecting: 'Connecting',
      handshake: 'Handshake',
      syncing: 'Syncing',
      resolving_conflicts: 'Resolving conflicts',
      complete: 'Complete',
      error: 'Error',
    };
    return labels[this.status.state] || this.status.state;
  }

  destroy(): void {
    this.transportManager.destroy();
  }
}
