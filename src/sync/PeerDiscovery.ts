/**
 * PeerDiscovery — обнаружение и управление пирами.
 *
 * Взаимодействует с native-слоем через TransportManager.
 * Предоставляет UI высокоуровневые методы для работы с устройствами.
 */

import { PeerDevice, SyncEvent, SyncEventType } from './types';
import { TransportManager } from './TransportManager';

export type DiscoveryCallback = (peers: PeerDevice[]) => void;

export class PeerDiscovery {
  private transport: TransportManager;
  private discoveryListeners: Set<DiscoveryCallback> = new Set();
  private discoveredPeers: PeerDevice[] = [];
  private isScanning = false;

  constructor(transport: TransportManager) {
    this.transport = transport;

    // Подписываемся на события обнаружения пиров
    this.transport.subscribe('peer-discovery', {
      onStateChange: () => {},
      onEvent: (event: SyncEvent) => {
        if (event.type === 'peer_discovered' && event.data) {
          this.handlePeerDiscovered(event.data);
        }
      },
    });
  }

  /**
   * Начинает сканирование Bluetooth-устройств.
   */
  async startDiscovery(): Promise<PeerDevice[]> {
    if (this.isScanning) return this.discoveredPeers;

    this.isScanning = true;
    this.discoveredPeers = [];

    try {
      const peers = await this.transport.discoverPeers();
      this.discoveredPeers = peers;
      this.notifyListeners();
      return peers;
    } catch (error) {
      console.error('Discovery failed:', error);
      return [];
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * Останавливает сканирование.
   */
  stopDiscovery(): void {
    this.isScanning = false;
  }

  /**
   * Подключается к устройству.
   */
  async pair(deviceId: string): Promise<boolean> {
    return this.transport.pairDevice(deviceId);
  }

  /**
   * Отключает устройство.
   */
  async unpair(deviceId: string): Promise<boolean> {
    return this.transport.unpairDevice(deviceId);
  }

  /**
   * Возвращает список спаренных устройств.
   */
  async getPairedPeers(): Promise<PeerDevice[]> {
    return this.transport.getPeers();
  }

  /**
   * Обрабатывает обнаружение нового пира.
   */
  private handlePeerDiscovered(peer: PeerDevice): void {
    const existing = this.discoveredPeers.findIndex(p => p.id === peer.id);
    if (existing >= 0) {
      this.discoveredPeers[existing] = peer;
    } else {
      this.discoveredPeers.push(peer);
    }
    this.notifyListeners();
  }

  /**
   * Уведомляет подписчиков об изменении списка пиров.
   */
  private notifyListeners(): void {
    for (const listener of this.discoveryListeners) {
      listener([...this.discoveredPeers]);
    }
  }

  /**
   * Подписка на изменения списка пиров.
   */
  onPeersChanged(callback: DiscoveryCallback): () => void {
    this.discoveryListeners.add(callback);
    return () => {
      this.discoveryListeners.delete(callback);
    };
  }

  /**
   * Очистка.
   */
  destroy(): void {
    this.stopDiscovery();
    this.discoveryListeners.clear();
    this.transport.unsubscribe('peer-discovery');
  }
}
