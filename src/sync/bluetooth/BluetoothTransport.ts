/**
 * BluetoothTransport — реализация ISyncTransport для Bluetooth P2P.
 *
 * Оборачивает существующий Bridge API (IPC/JSInterface) в ISyncTransport.
 * Вся работа с RFCOMM происходит в native-клиенте (Electron main / Android).
 * Web-слой общается через Bridge.
 */

import {
  ISyncTransport,
  SyncMode,
  SyncBridgeAPI,
  SyncEvent,
  SyncEventType,
  SyncStatus,
  SyncConnectionState,
  PeerDevice,
  SyncConflict,
} from '../types';

type SyncEventCallback = (event: SyncEvent) => void;

export interface SyncStateListener {
  onStateChange(state: SyncConnectionState): void;
  onEvent(event: SyncEvent): void;
}

export class BluetoothTransport implements ISyncTransport {
  readonly mode: SyncMode = 'bluetooth';

  private bridge: SyncBridgeAPI | null = null;
  private listeners: Map<string, SyncStateListener> = new Map();
  private unsubscribeEvent: (() => void) | null = null;
  private _status: SyncStatus = {
    state: 'idle',
    lastSyncAt: null,
    connectedPeers: [],
    progress: null,
    error: null,
  };

  get status(): SyncStatus {
    return this._status;
  }

  /**
   * Устанавливает bridge API для связи с native-слоем.
   */
  setBridge(api: SyncBridgeAPI): void {
    this.bridge = api;
    this.setupEventSubscription();
  }

  /**
   * Подписывается на события от native-слоя.
   */
  private setupEventSubscription(): void {
    if (!this.bridge) return;

    this.unsubscribeEvent = this.bridge.onSyncEvent((event: SyncEvent) => {
      this.handleEvent(event);
    });
  }

  /**
   * Обрабатывает входящее событие и оповещает подписчиков.
   */
  private handleEvent(event: SyncEvent): void {
    switch (event.type) {
      case 'state_changed':
        this._status.state = event.data?.state || this._status.state;
        this._status.error = event.data?.error || null;
        break;
      case 'sync_progress':
        this._status.progress = event.data || this._status.progress;
        break;
      case 'sync_complete':
        this._status.lastSyncAt = event.timestamp;
        this._status.state = 'complete';
        this._status.progress = null;
        break;
      case 'error':
        this._status.error = event.data?.message || 'Unknown error';
        this._status.state = 'error';
        break;
    }

    for (const listener of this.listeners.values()) {
      listener.onStateChange(this._status.state);
      listener.onEvent(event);
    }
  }

  // ==================== ISyncTransport ====================

  async start(): Promise<boolean> {
    if (!this.bridge) return false;
    try {
      const result = await this.bridge.syncStart();
      return result.success;
    } catch (error) {
      console.error('[BluetoothTransport] Failed to start:', error);
      return false;
    }
  }

  async stop(): Promise<boolean> {
    if (!this.bridge) return false;
    try {
      const result = await this.bridge.syncStop();
      return result.success;
    } catch (error) {
      console.error('[BluetoothTransport] Failed to stop:', error);
      return false;
    }
  }

  getStatus(): SyncStatus {
    return this._status;
  }

  onEvent(callback: SyncEventCallback): () => void {
    // Используем механизм listener'ов
    const id = `bt-event-${Date.now()}-${Math.random()}`;
    this.listeners.set(id, {
      onStateChange: () => {},
      onEvent: callback,
    });
    return () => {
      this.listeners.delete(id);
    };
  }

  destroy(): void {
    if (this.unsubscribeEvent) {
      this.unsubscribeEvent();
      this.unsubscribeEvent = null;
    }
    this.listeners.clear();
    this.bridge = null;
  }

  // ==================== Bluetooth-specific методы ====================

  async discoverPeers(): Promise<PeerDevice[]> {
    if (!this.bridge) return [];
    return this.bridge.syncDiscoverPeers();
  }

  async getPeers(): Promise<PeerDevice[]> {
    if (!this.bridge) return [];
    return this.bridge.syncGetPeers();
  }

  async pairDevice(deviceId: string): Promise<boolean> {
    if (!this.bridge) return false;
    const result = await this.bridge.syncPairDevice(deviceId);
    return result.success;
  }

  async unpairDevice(deviceId: string): Promise<boolean> {
    if (!this.bridge) return false;
    const result = await this.bridge.syncUnpairDevice(deviceId);
    return result.success;
  }

  async getConflicts(): Promise<SyncConflict[]> {
    if (!this.bridge) return [];
    return this.bridge.syncGetConflicts();
  }

  async resolveConflict(conflictId: number, strategy: 'local_wins' | 'remote_wins'): Promise<boolean> {
    if (!this.bridge) return false;
    const result = await this.bridge.syncResolveConflict(conflictId, strategy);
    return result.success;
  }

  async refreshStatus(): Promise<SyncStatus | null> {
    if (!this.bridge) return null;
    try {
      this._status = await this.bridge.syncGetStatus();
      return this._status;
    } catch {
      return null;
    }
  }

  /**
   * Подписка для совместимости со старым TransportManager.
   */
  subscribe(id: string, listener: SyncStateListener): void {
    this.listeners.set(id, listener);
  }

  unsubscribe(id: string): void {
    this.listeners.delete(id);
  }
}
