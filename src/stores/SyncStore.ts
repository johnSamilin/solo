// ============================================================
// SyncStore — MobX store для управления синхронизацией
// ============================================================

import { makeAutoObservable } from 'mobx';
import {
  SyncStatus,
  PeerInfo,
  TransportConfig,
  SyncConflictRecord,
  DEFAULT_TRANSPORT_CONFIG,
} from '../sync/types';
import { syncEngine } from '../sync/SyncEngine';
import { peerDiscovery } from '../sync/PeerDiscovery';
import { conflictResolver } from '../sync/ConflictResolver';
import { getOrCreateDeviceId, getOrCreateDeviceName, setDeviceName } from '../sync/utils';

export class SyncStore {
  // Состояние
  enabled = false;
  deviceName: string = getOrCreateDeviceName();
  transportConfig: TransportConfig = { ...DEFAULT_TRANSPORT_CONFIG };
  syncStatus: SyncStatus = 'idle';
  discoveredPeers: PeerInfo[] = [];
  connectedPeers: PeerInfo[] = [];
  pendingConflicts: SyncConflictRecord[] = [];
  lastSyncTime: number | null = null;
  syncProgress: string = '';
  errorMessage: string = '';

  // Приватные cleanup функции
  private cleanupFns: (() => void)[] = [];

  constructor() {
    makeAutoObservable(this);
    this.loadSettings();
  }

  /**
   * Включает/выключает синхронизацию.
   */
  async toggleSync(): Promise<void> {
    if (this.enabled) {
      await this.disableSync();
    } else {
      await this.enableSync();
    }
  }

  /**
   * Включает синхронизацию.
   */
  async enableSync(): Promise<void> {
    if (this.enabled) return;

    try {
      await syncEngine.start(this.transportConfig);

      // Подписываемся на статус
      const unsubStatus = syncEngine.onStatus((status, peerId, progress) => {
        this.syncStatus = status;
        if (progress) this.syncProgress = progress;
        if (status === 'idle' && peerId) {
          this.lastSyncTime = Date.now();
        }
        if (status === 'error' && progress) {
          this.errorMessage = progress;
        }
      });
      this.cleanupFns.push(unsubStatus);

      // Подписываемся на пиров
      const unsubPeers = peerDiscovery.onPeersUpdate((peers) => {
        this.discoveredPeers = peers;
      });
      this.cleanupFns.push(unsubPeers);

      // Запускаем peer discovery
      await peerDiscovery.start();

      // Подписываемся на конфликты
      const unsubConflicts = conflictResolver.onConflict((conflicts) => {
        this.pendingConflicts = conflicts;
      });
      this.cleanupFns.push(unsubConflicts);

      this.enabled = true;
      this.errorMessage = '';
      this.saveSettings();
    } catch (e) {
      this.enabled = false;
      this.errorMessage = `Failed to enable sync: ${e}`;
      console.error('[SyncStore] Enable failed:', e);
    }
  }

  /**
   * Выключает синхронизацию.
   */
  async disableSync(): Promise<void> {
    if (!this.enabled) return;

    try {
      await syncEngine.stop();
      peerDiscovery.stop();

      // Отписываемся
      for (const cleanup of this.cleanupFns) {
        cleanup();
      }
      this.cleanupFns = [];

      this.enabled = false;
      this.syncStatus = 'idle';
      this.connectedPeers = [];
      this.syncProgress = '';
      this.saveSettings();
    } catch (e) {
      console.error('[SyncStore] Disable failed:', e);
    }
  }

  /**
   * Ручная синхронизация.
   */
  async manualSync(): Promise<void> {
    if (!this.enabled || syncEngine.isSyncInProgress()) return;

    try {
      await syncEngine.syncWithAllPeers();
    } catch (e) {
      this.errorMessage = `Sync failed: ${e}`;
    }
  }

  /**
   * Подключение к пиру по IP:port.
   */
  async connectToPeer(address: string, port: number): Promise<void> {
    if (!this.enabled) {
      await this.enableSync();
    }

    try {
      await syncEngine.connectToPeer(address, port);
    } catch (e) {
      this.errorMessage = `Failed to connect to ${address}:${port}: ${e}`;
    }
  }

  /**
   * Отключение от пира.
   */
  async disconnectFromPeer(deviceId: string): Promise<void> {
    try {
      await syncEngine.disconnectFromPeer(deviceId);
      this.updateConnectedPeers();
    } catch (e) {
      console.error('[SyncStore] Disconnect failed:', e);
    }
  }

  /**
   * Разрешение конфликта.
   */
  async resolveConflict(conflictId: string, resolution: 'keep_local' | 'keep_remote' | 'merge'): Promise<void> {
    try {
      await conflictResolver.resolveManually(conflictId, resolution);
      this.pendingConflicts = this.pendingConflicts.filter(c => c.conflictId !== conflictId);
    } catch (e) {
      this.errorMessage = `Failed to resolve conflict: ${e}`;
    }
  }

  /**
   * Обновление имени устройства.
   */
  setDeviceName(name: string): void {
    this.deviceName = name;
    setDeviceName(name);
    this.saveSettings();
  }

  /**
   * Обновление конфигурации транспортов.
   */
  async setTransportConfig(config: Partial<TransportConfig>): Promise<void> {
    this.transportConfig = { ...this.transportConfig, ...config };

    // Если синхронизация включена — применяем изменения на лету
    if (this.enabled) {
      await syncEngine.updateTransportConfig(this.transportConfig);
    }

    this.saveSettings();
  }

  /**
   * Обновляет список подключённых пиров.
   */
  updateConnectedPeers(): void {
    this.connectedPeers = syncEngine.getConnectedPeers();
  }

  /**
   * Загружает настройки из localStorage.
   */
  private loadSettings(): void {
    try {
      const stored = localStorage.getItem('solo-sync-settings');
      if (stored) {
        const data = JSON.parse(stored);
        this.enabled = data.enabled || false;
        this.transportConfig = data.transportConfig || DEFAULT_TRANSPORT_CONFIG;
        this.deviceName = data.deviceName || getOrCreateDeviceName();
      }
    } catch (e) {
      console.error('[SyncStore] Failed to load settings:', e);
    }
  }

  /**
   * Сохраняет настройки в localStorage.
   */
  private saveSettings(): void {
    try {
      const data = {
        enabled: this.enabled,
        transportConfig: this.transportConfig,
        deviceName: this.deviceName,
      };
      localStorage.setItem('solo-sync-settings', JSON.stringify(data));
    } catch (e) {
      console.error('[SyncStore] Failed to save settings:', e);
    }
  }
}
