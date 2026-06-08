/**
 * TransportManager — управляет транспортным уровнем синхронизации.
 *
 * Абстрагирует детали Bluetooth-соединения от веб-слоя.
 * Вся работа с RFCOMM происходит в native-клиенте (Electron main / Android).
 * Web-слой общается через Bridge (IPC / JSInterface).
 */

import { SyncBridgeAPI, SyncEvent, SyncEventType, SyncStatus, SyncConnectionState } from './types';

type SyncEventCallback = (event: SyncEvent) => void;

/**
 * Событие для подписки UI на изменения состояния синхронизации.
 */
export interface SyncStateListener {
  onStateChange(state: SyncConnectionState): void;
  onEvent(event: SyncEvent): void;
}

export class TransportManager {
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
    // Обновляем внутренний статус
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

    // Оповещаем всех подписчиков
    for (const listener of this.listeners.values()) {
      listener.onStateChange(this._status.state);
      listener.onEvent(event);
    }
  }

  /**
   * Запускает синхронизацию (обнаружение пиров и синхронизацию).
   */
  async startSync(): Promise<boolean> {
    if (!this.bridge) return false;

    try {
      const result = await this.bridge.syncStart();
      return result.success;
    } catch (error) {
      console.error('Failed to start sync:', error);
      return false;
    }
  }

  /**
   * Останавливает синхронизацию.
   */
  async stopSync(): Promise<boolean> {
    if (!this.bridge) return false;

    try {
      const result = await this.bridge.syncStop();
      return result.success;
    } catch (error) {
      console.error('Failed to stop sync:', error);
      return false;
    }
  }

  /**
   * Запрашивает список доступных пиров.
   */
  async discoverPeers() {
    if (!this.bridge) return [];
    return this.bridge.syncDiscoverPeers();
  }

  /**
   * Подключается к выбранному пиру.
   */
  async pairDevice(deviceId: string): Promise<boolean> {
    if (!this.bridge) return false;
    const result = await this.bridge.syncPairDevice(deviceId);
    return result.success;
  }

  /**
   * Отключает устройство.
   */
  async unpairDevice(deviceId: string): Promise<boolean> {
    if (!this.bridge) return false;
    const result = await this.bridge.syncUnpairDevice(deviceId);
    return result.success;
  }

  /**
   * Возвращает список доверенных пиров.
   */
  async getPeers() {
    if (!this.bridge) return [];
    return this.bridge.syncGetPeers();
  }

  /**
   * Получает актуальный статус.
   */
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
   * Подписка на события.
   */
  subscribe(id: string, listener: SyncStateListener): void {
    this.listeners.set(id, listener);
  }

  /**
   * Отписка от событий.
   */
  unsubscribe(id: string): void {
    this.listeners.delete(id);
  }

  /**
   * Очистка ресурсов.
   */
  destroy(): void {
    if (this.unsubscribeEvent) {
      this.unsubscribeEvent();
      this.unsubscribeEvent = null;
    }
    this.listeners.clear();
    this.bridge = null;
  }
}
