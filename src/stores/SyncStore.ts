/**
 * SyncStore — MobX-обёртка над TransportManager.
 *
 * Предоставляет наблюдаемое состояние синхронизации для React-компонентов.
 * Использует getNativeAPI() для доступа к методам SyncBridgeAPI,
 * которые проброшены через preload.ts (Electron) или JSInterface (Android).
 */

import { makeAutoObservable } from 'mobx';
import { getNativeAPI } from '../utils/nativeBridge';
import { TransportManager } from '../sync/TransportManager';
import {
  SyncBridgeAPI,
  SyncStatus,
  SyncConflict,
  PeerDevice,
  SyncConnectionState,
  SyncEvent,
} from '../sync/types';

export class SyncStore {
  private transportManager: TransportManager;

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

  constructor() {
    this.transportManager = new TransportManager();
    makeAutoObservable(this);
    this.initBridge();
  }

  // ========== Bridge ==========

  private initBridge(): void {
    const api = getNativeAPI();
    if (!api) return;

    // Проверяем, доступны ли методы синхронизации
    if (typeof api.syncStart !== 'function') {
      console.warn('[SyncStore] sync methods not available in native API');
      return;
    }

    // Проверяем наличие onSyncEvent
    if (typeof api.onSyncEvent !== 'function') {
      console.warn('[SyncStore] onSyncEvent not available in native API - sync events will not work');
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
        // Return no-op unsubscribe function if onSyncEvent is not available
        console.warn('[SyncStore] onSyncEvent called but not available');
        return () => {};
      },
    };

    this.transportManager.setBridge(bridge);
    this.setupSubscriptions();
    this.loadInitialState();
  }

  private setupSubscriptions(): void {
    this.transportManager.subscribe('sync-store', {
      onStateChange: (state: SyncConnectionState) => {
        // состояние уже обновляется в handleEvent
      },
      onEvent: (event: SyncEvent) => {
        this.handleSyncEvent(event);
      },
    });
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

  // ========== Загрузка начального состояния ==========

  private async loadInitialState(): Promise<void> {
    await this.refreshStatus();
    await this.refreshConflicts();
    await this.refreshPeers();

    // Загружаем настройки устройства
    const stored = localStorage.getItem('solo-sync-settings');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        this.deviceName = parsed.deviceName || '';
        this.isEnabled = parsed.isEnabled || false;
      } catch {
        // ignore
      }
    }
  }

  private saveSettings(): void {
    localStorage.setItem(
      'solo-sync-settings',
      JSON.stringify({
        deviceName: this.deviceName,
        isEnabled: this.isEnabled,
      })
    );
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
    try {
      const api = getNativeAPI();
      if (api?.syncGetConflicts) {
        this.conflicts = await api.syncGetConflicts();
      }
    } catch {
      // ignore
    }
  }

  async resolveConflict(
    conflictId: number,
    strategy: 'local_wins' | 'remote_wins'
  ): Promise<boolean> {
    try {
      const api = getNativeAPI();
      if (!api?.syncResolveConflict) return false;
      const result = await api.syncResolveConflict(conflictId, strategy);
      if (result.success) {
        await this.refreshConflicts();
        await this.refreshStatus();
      }
      return result.success;
    } catch {
      return false;
    }
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
