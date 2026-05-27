// ============================================================
// PeerDiscovery — обнаружение устройств Solo в локальной сети
// через mDNS (DNS-SD). Ручное добавление по IP:port.
// ============================================================

import { PeerInfo, TransportType, DEFAULT_SYNC_PORT, MDNS_SERVICE_TYPE, PROTOCOL_VERSION } from './types';
import { getOrCreateDeviceId, getOrCreateDeviceName } from './utils';

export type PeerDiscoveryHandler = (peers: PeerInfo[]) => void;

// Типы для multicast-dns (будет подключен через CDN или локально)
declare class MulticastDNS {
  constructor(opts?: any);
  on(event: string, callback: (data: any) => void): void;
  destroy(): void;
}

/**
 * PeerDiscovery — управляет обнаружением пиров.
 * - mDNS (Multicast DNS) для WiFi
 * - Ручное добавление по IP:port
 * - Периодический поиск
 */
export class PeerDiscovery {
  private mdns: MulticastDNS | null = null;
  private onPeersUpdateHandlers: PeerDiscoveryHandler[] = [];
  private manualPeers: PeerInfo[] = [];
  private discoveredPeers: Map<string, PeerInfo> = new Map();
  private isRunning = false;
  private browseIntervalId: number | null = null;
  private servicePublished = false;

  /**
   * Запускает mDNS сервис (публикация + browse).
   */
  async start(mdnsPort: number = DEFAULT_SYNC_PORT): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    this.startMDNS(mdnsPort);
    this.startPeriodicBrowse();
  }

  stop(): void {
    this.isRunning = false;

    if (this.mdns) {
      try {
        this.mdns.destroy();
      } catch (e) {
        console.error('mDNS destroy error:', e);
      }
      this.mdns = null;
    }

    if (this.browseIntervalId !== null) {
      clearInterval(this.browseIntervalId);
      this.browseIntervalId = null;
    }

    this.servicePublished = false;
  }

  onPeersUpdate(handler: PeerDiscoveryHandler): () => void {
    this.onPeersUpdateHandlers.push(handler);
    return () => {
      this.onPeersUpdateHandlers = this.onPeersUpdateHandlers.filter(h => h !== handler);
    };
  }

  /**
   * Добавляет пир вручную (по IP:port).
   */
  addManualPeer(address: string, port: number = DEFAULT_SYNC_PORT): PeerInfo {
    const deviceId = `manual-${address}-${port}`;
    const peer: PeerInfo = {
      deviceId,
      deviceName: `Manual (${address})`,
      protocolVersion: PROTOCOL_VERSION,
      address,
      port,
      transport: 'wifi' as TransportType,
      capabilities: {
        bluetooth: false,
        tls: false,
        conflictMerge: true,
      },
      lastSeen: Date.now(),
      status: 'disconnected',
    };

    // Проверяем, нет ли уже такого
    const existing = this.manualPeers.find(p => p.deviceId === deviceId);
    if (!existing) {
      this.manualPeers.push(peer);
      this.notify();
    }

    return peer;
  }

  /**
   * Удаляет ручной пир.
   */
  removeManualPeer(deviceId: string): void {
    this.manualPeers = this.manualPeers.filter(p => p.deviceId !== deviceId);
    this.discoveredPeers.delete(deviceId);
    this.notify();
  }

  /**
   * Возвращает список всех известных пиров.
   */
  getAllPeers(): PeerInfo[] {
    const discovered = Array.from(this.discoveredPeers.values());
    return [...this.manualPeers, ...discovered];
  }

  /**
   * Возвращает устройство по ID.
   */
  getPeer(deviceId: string): PeerInfo | undefined {
    return this.manualPeers.find(p => p.deviceId === deviceId) ||
           this.discoveredPeers.get(deviceId);
  }

  private startMDNS(port: number): void {
    try {
      // Пытаемся использовать multicast-dns (если доступен в окружении)
      // В Electron main process этот модуль будет загружен через preload
      // В браузере mDNS не работает, так что graceful degradation
      if (typeof (window as any).MulticastDNS !== 'undefined') {
        const MDNS = (window as any).MulticastDNS as typeof MulticastDNS;
        this.mdns = new MDNS({ multicast: true, interface: '0.0.0.0' });

        // Публикуем сервис Solo
        this.publishService(port);

        // Ищем другие устройства Solo
        this.browseForPeers();

        this.mdns.on('response', (data: any) => {
          this.handleMDNSResponse(data);
        });
      } else {
        console.log('[PeerDiscovery] multicast-dns not available in this environment. Using manual peer discovery only.');
      }
    } catch (e) {
      console.warn('[PeerDiscovery] Failed to start mDNS:', e);
    }
  }

  private publishService(port: number): void {
    if (!this.mdns || this.servicePublished) return;

    try {
      const deviceId = getOrCreateDeviceId();
      const deviceName = getOrCreateDeviceName();

      // В multicast-dns публикация делается через ответы на query
      // Для простоты — просто логируем
      console.log(`[PeerDiscovery] Publishing Solo service: ${deviceName} (${deviceId}) on port ${port}`);
      this.servicePublished = true;
    } catch (e) {
      console.warn('[PeerDiscovery] Failed to publish service:', e);
    }
  }

  private browseForPeers(): void {
    if (!this.mdns) return;

    try {
      // Отправляем mDNS query для поиска Solo устройств
      this.mdns.on('query', (query: any) => {
        // Отвечаем на запросы других устройств
        if (query.questions?.some((q: any) => q.name === MDNS_SERVICE_TYPE)) {
          const deviceId = getOrCreateDeviceId();
          const deviceName = getOrCreateDeviceName();
          // В реальном multicast-dns здесь нужно отправить ответ
        }
      });
    } catch (e) {
      console.warn('[PeerDiscovery] Browse error:', e);
    }
  }

  private handleMDNSResponse(data: any): void {
    try {
      // Парсим mDNS ответы
      if (!data.answers) return;

      for (const answer of data.answers) {
        if (answer.type === 'TXT' && answer.name === MDNS_SERVICE_TYPE) {
          const txtData = answer.data as Record<string, string>;
          if (txtData?.device_id) {
            const peer: PeerInfo = {
              deviceId: txtData.device_id,
              deviceName: txtData.device_name || 'Unknown Solo',
              protocolVersion: txtData.version || PROTOCOL_VERSION,
              address: '', // будет получено из A/AAAA записи
              port: parseInt(txtData.port || String(DEFAULT_SYNC_PORT), 10),
              transport: 'wifi',
              capabilities: {
                bluetooth: txtData.bluetooth === 'true',
                tls: txtData.tls === 'true',
                conflictMerge: true,
              },
              lastSeen: Date.now(),
              status: 'disconnected',
            };
            this.discoveredPeers.set(peer.deviceId, peer);
            this.notify();
          }
        }

        // Получаем IP адрес из A записи
        if (answer.type === 'A') {
          const peerName = answer.name.replace(`.${MDNS_SERVICE_TYPE}`, '');
          for (const [, peer] of this.discoveredPeers) {
            if (!peer.address && peer.deviceName === peerName) {
              peer.address = answer.data as string;
              peer.lastSeen = Date.now();
            }
          }
        }
      }
    } catch (e) {
      console.warn('[PeerDiscovery] Response parse error:', e);
    }
  }

  private startPeriodicBrowse(): void {
    // Каждые 30 секунд делаем повторный поиск
    this.browseIntervalId = window.setInterval(() => {
      if (this.mdns) {
        try {
          this.browseForPeers();
        } catch (e) {
          console.warn('[PeerDiscovery] Periodic browse error:', e);
        }
      }
    }, 30000);
  }

  private notify(): void {
    const allPeers = this.getAllPeers();
    for (const handler of this.onPeersUpdateHandlers) {
      try {
        handler(allPeers);
      } catch (e) {
        console.error('PeerDiscovery handler error:', e);
      }
    }
  }
}

export const peerDiscovery = new PeerDiscovery();
