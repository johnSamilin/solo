/**
 * TransportManager — диспетчер транспортного уровня.
 *
 * Управляет активным транспортом (Bluetooth или WebDAV).
 * Позволяет переключаться между режимами синхронизации.
 *
 * Bluetooth: общается через Bridge API (IPC/JSInterface) с native-слоем.
 * WebDAV: работает напрямую через HTTP (fetch) на WebDAV сервер.
 */

import { SyncMode, SyncStatus, SyncEvent, SyncEventType, SyncConnectionState, SyncConflict, PeerDevice, SyncBridgeAPI, WebDAVConfig } from './types';
import { BluetoothTransport, SyncStateListener } from './bluetooth/BluetoothTransport';

// Импорт WebDAVTransport (динамический, чтобы избежать циклических зависимостей)
import { WebDAVTransport, WebDAVTransportConfig } from './webdav/WebDAVTransport';

export type { SyncStateListener };

/**
 * Конфигурация для WebDAV, которая передаётся в SyncStore.
 */
export interface WebDAVTransportSetup {
  config: WebDAVConfig;
  deviceId: string;
  deviceName: string;
  platform: string;
  getLocalManifest: WebDAVTransportConfig['getLocalManifest'];
  readFileForSync: WebDAVTransportConfig['readFileForSync'];
  saveReceivedFile: WebDAVTransportConfig['saveReceivedFile'];
  applyRemoteTombstone: WebDAVTransportConfig['applyRemoteTombstone'];
}

export class TransportManager {
  private bluetoothTransport: BluetoothTransport;
  private webdavTransport: WebDAVTransport | null = null;
  private activeTransport: BluetoothTransport | WebDAVTransport | null = null;

  private webdavSetup: WebDAVTransportSetup | null = null;
  private listeners: Map<string, SyncStateListener> = new Map();
  private eventUnsubscribers: (() => void)[] = [];

  constructor() {
    this.bluetoothTransport = new BluetoothTransport();
    this.activeTransport = this.bluetoothTransport;

    // Подписываемся на события bluetooth по умолчанию
    this.subscribeToTransport(this.bluetoothTransport);
  }

  // ==================== Активный режим ====================

  get mode(): SyncMode {
    return this.activeTransport?.mode || 'bluetooth';
  }

  get status(): SyncStatus {
    return this.activeTransport?.getStatus() || {
      state: 'idle',
      lastSyncAt: null,
      connectedPeers: [],
      progress: null,
      error: null,
    };
  }

  /**
   * Переключает режим синхронизации.
   */
  async setMode(mode: SyncMode): Promise<boolean> {
    if (mode === this.mode) return true;

    // Останавливаем текущий транспорт
    if (this.activeTransport) {
      await this.activeTransport.stop();
    }

    // Отписываемся от старого транспорта
    this.unsubscribeAll();

    if (mode === 'bluetooth') {
      this.activeTransport = this.bluetoothTransport;
      this.subscribeToTransport(this.bluetoothTransport);
      return true;
    } else if (mode === 'webdav') {
      if (!this.webdavSetup) {
        console.error('[TransportManager] WebDAV not configured');
        return false;
      }

      // Создаём или пересоздаём WebDAV транспорт
      if (this.webdavTransport) {
        this.webdavTransport.destroy();
      }

      const { config, deviceId, deviceName, platform, getLocalManifest, readFileForSync, saveReceivedFile, applyRemoteTombstone } = this.webdavSetup;

      this.webdavTransport = new WebDAVTransport({
        webdavConfig: config,
        deviceId,
        deviceName,
        platform,
        getLocalManifest,
        readFileForSync,
        saveReceivedFile,
        applyRemoteTombstone,
      });

      this.activeTransport = this.webdavTransport;
      this.subscribeToTransport(this.webdavTransport);
      return true;
    }

    return false;
  }

  /**
   * Конфигурирует WebDAV транспорт.
   */
  configureWebDAV(setup: WebDAVTransportSetup): void {
    this.webdavSetup = setup;
  }

  // ==================== Bridge API (для Bluetooth) ====================

  setBridge(api: SyncBridgeAPI): void {
    this.bluetoothTransport.setBridge(api);
  }

  // ==================== ISyncTransport методы ====================

  async startSync(): Promise<boolean> {
    if (!this.activeTransport) return false;
    return this.activeTransport.start();
  }

  async stopSync(): Promise<boolean> {
    if (!this.activeTransport) return false;
    return this.activeTransport.stop();
  }

  async refreshStatus(): Promise<SyncStatus | null> {
    if (this.activeTransport instanceof BluetoothTransport) {
      return this.bluetoothTransport.refreshStatus();
    }
    return this.activeTransport?.getStatus() || null;
  }

  async discoverPeers(): Promise<PeerDevice[]> {
    const transport = this.activeTransport;
    if (transport instanceof BluetoothTransport) {
      return transport.discoverPeers();
    }
    // WebDAV not supported
    return [];
  }

  async getPeers(): Promise<PeerDevice[]> {
    const transport = this.activeTransport;
    if (transport instanceof BluetoothTransport) {
      return transport.getPeers();
    }
    return [];
  }

  async pairDevice(deviceId: string): Promise<boolean> {
    const transport = this.activeTransport;
    if (transport instanceof BluetoothTransport) {
      return transport.pairDevice(deviceId);
    }
    return false;
  }

  async unpairDevice(deviceId: string): Promise<boolean> {
    const transport = this.activeTransport;
    if (transport instanceof BluetoothTransport) {
      return transport.unpairDevice(deviceId);
    }
    return false;
  }

  async getConflicts(): Promise<SyncConflict[]> {
    const transport = this.activeTransport;
    if (transport instanceof BluetoothTransport) {
      return transport.getConflicts();
    }
    return [];
  }

  async resolveConflict(conflictId: number, strategy: 'local_wins' | 'remote_wins'): Promise<boolean> {
    const transport = this.activeTransport;
    if (transport instanceof BluetoothTransport) {
      return transport.resolveConflict(conflictId, strategy);
    }
    return false;
  }

  // ==================== Подписки ====================

  subscribe(id: string, listener: SyncStateListener): void {
    this.listeners.set(id, listener);
  }

  unsubscribe(id: string): void {
    this.listeners.delete(id);
  }

  private subscribeToTransport(transport: BluetoothTransport | WebDAVTransport): void {
    const unsub = transport.onEvent((event: SyncEvent) => {
      // Прокидываем события всем подписчикам TransportManager
      for (const listener of this.listeners.values()) {
        listener.onStateChange(this.activeTransport?.getStatus().state || 'idle');
        listener.onEvent(event);
      }
    });
    this.eventUnsubscribers.push(unsub);
  }

  private unsubscribeAll(): void {
    for (const unsub of this.eventUnsubscribers) {
      try { unsub(); } catch {}
    }
    this.eventUnsubscribers = [];
  }

  // ==================== Очистка ====================

  destroy(): void {
    this.unsubscribeAll();
    this.bluetoothTransport.destroy();
    if (this.webdavTransport) {
      this.webdavTransport.destroy();
    }
    this.listeners.clear();
  }
}
