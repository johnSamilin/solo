// ============================================================
// TransportManager — управление транспортным слоем
// TCP (WiFi) — основной транспорт
// Bluetooth — опциональный, по умолчанию включён
// ============================================================

import {
  TransportType,
  TransportConfig,
  DEFAULT_TRANSPORT_CONFIG,
  DEFAULT_SYNC_PORT,
  PeerInfo,
  SyncMessage,
} from './types';
import { encodeMessage, decodeMessages } from './Protocol';

export type MessageHandler = (message: SyncMessage, peer: PeerInfo) => void;
export type ConnectionHandler = (peer: PeerInfo, connected: boolean) => void;

interface Transport {
  start(): Promise<void>;
  stop(): Promise<void>;
  connect(peer: PeerInfo): Promise<void>;
  disconnect(peer: PeerInfo): Promise<void>;
  send(peer: PeerInfo, message: SyncMessage): Promise<void>;
  isConnected(peerId: string): boolean;
  getType(): TransportType;
}

/**
 * TransportManager — управляет всеми доступными транспортами.
 * По умолчанию включены WiFi и Bluetooth.
 */
export class TransportManager {
  private config: TransportConfig;
  private transports: Map<TransportType, Transport> = new Map();
  private messageHandlers: MessageHandler[] = [];
  private connectionHandlers: ConnectionHandler[] = [];

  constructor(config?: Partial<TransportConfig>) {
    this.config = { ...DEFAULT_TRANSPORT_CONFIG, ...config };

    if (this.config.wifi) {
      this.transports.set('wifi', new TCPTransport());
    }
    if (this.config.bluetooth) {
      this.transports.set('bluetooth', new BluetoothTransport());
    }
  }

  /**
   * Обновляет конфигурацию транспортов.
   * Перезапускает транспорт если его статус изменился.
   */
  async updateConfig(config: Partial<TransportConfig>): Promise<void> {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...config };

    // WiFi
    if (this.config.wifi && !oldConfig.wifi) {
      const tcp = new TCPTransport();
      this.transports.set('wifi', tcp);
      await tcp.start();
    } else if (!this.config.wifi && oldConfig.wifi) {
      const tcp = this.transports.get('wifi');
      if (tcp) {
        await tcp.stop();
        this.transports.delete('wifi');
      }
    }

    // Bluetooth
    if (this.config.bluetooth && !oldConfig.bluetooth) {
      const bt = new BluetoothTransport();
      this.transports.set('bluetooth', bt);
      await bt.start();
    } else if (!this.config.bluetooth && oldConfig.bluetooth) {
      const bt = this.transports.get('bluetooth');
      if (bt) {
        await bt.stop();
        this.transports.delete('bluetooth');
      }
    }
  }

  getConfig(): TransportConfig {
    return { ...this.config };
  }

  async start(): Promise<void> {
    for (const [, transport] of this.transports) {
      await transport.start();
    }
  }

  async stop(): Promise<void> {
    for (const [, transport] of this.transports) {
      await transport.stop();
    }
  }

  async connect(peer: PeerInfo): Promise<void> {
    const transport = this.transports.get(peer.transport);
    if (!transport) {
      throw new Error(`Transport ${peer.transport} not available`);
    }
    await transport.connect(peer);
    this.notifyConnection(peer, true);
  }

  async disconnect(peer: PeerInfo): Promise<void> {
    const transport = this.transports.get(peer.transport);
    if (transport) {
      await transport.disconnect(peer);
    }
    this.notifyConnection(peer, false);
  }

  async send(peer: PeerInfo, message: SyncMessage): Promise<void> {
    const transport = this.transports.get(peer.transport);
    if (!transport) {
      throw new Error(`Transport ${peer.transport} not available for sending`);
    }
    await transport.send(peer, message);
  }

  isConnected(peerId: string): boolean {
    for (const [, transport] of this.transports) {
      if (transport.isConnected(peerId)) return true;
    }
    return false;
  }

  getAvailableTransports(): TransportType[] {
    return Array.from(this.transports.keys());
  }

  isTransportAvailable(type: TransportType): boolean {
    return this.transports.has(type);
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.push(handler);
    return () => {
      this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
    };
  }

  onConnection(handler: ConnectionHandler): () => void {
    this.connectionHandlers.push(handler);
    return () => {
      this.connectionHandlers = this.connectionHandlers.filter(h => h !== handler);
    };
  }

  protected notifyMessage(message: SyncMessage, peer: PeerInfo): void {
    for (const handler of this.messageHandlers) {
      try {
        handler(message, peer);
      } catch (e) {
        console.error('TransportManager message handler error:', e);
      }
    }
  }

  private notifyConnection(peer: PeerInfo, connected: boolean): void {
    for (const handler of this.connectionHandlers) {
      try {
        handler(peer, connected);
      } catch (e) {
        console.error('TransportManager connection handler error:', e);
      }
    }
  }
}

// ============================================================
// TCP Transport (WiFi)
// ============================================================

class TCPConnection {
  private peerId: string;
  private url: string;
  private ws: WebSocket | null = null;
  private onMessage: ((msg: SyncMessage) => void) | null = null;
  private onDisconnect: (() => void) | null = null;

  constructor(peer: PeerInfo, onMessage: (msg: SyncMessage) => void, onDisconnect: () => void) {
    this.peerId = peer.deviceId;
    this.url = `ws://${peer.address}:${peer.port}`;
    this.onMessage = onMessage;
    this.onDisconnect = onDisconnect;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log(`[TCP] Connected to ${this.url}`);
          resolve();
        };

        this.ws.onmessage = (event) => {
          const messages = decodeMessages(event.data);
          for (const msg of messages) {
            this.onMessage?.(msg);
          }
        };

        this.ws.onclose = () => {
          console.log(`[TCP] Disconnected from ${this.url}`);
          this.onDisconnect?.();
        };

        this.ws.onerror = (err) => {
          console.error(`[TCP] Error:`, err);
          reject(new Error(`WebSocket connection failed to ${this.url}`));
        };
      } catch (e) {
        reject(e);
      }
    });
  }

  async send(message: SyncMessage): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('TCP connection not open');
    }
    this.ws.send(encodeMessage(message));
  }

  close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  get isOpen(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

class TCPTransport implements Transport {
  private connections: Map<string, TCPConnection> = new Map();
  private messageHandlers: MessageHandler[] = [];
  private connectionHandlers: ConnectionHandler[] = [];

  async start(): Promise<void> {
    console.log('[TCPTransport] Started');
  }

  async stop(): Promise<void> {
    for (const [, conn] of this.connections) {
      conn.close();
    }
    this.connections.clear();
  }

  async connect(peer: PeerInfo): Promise<void> {
    if (this.connections.has(peer.deviceId)) return;

    const conn = new TCPConnection(
      peer,
      (msg) => this.handleMessage(msg, peer),
      () => this.handleDisconnect(peer),
    );
    this.connections.set(peer.deviceId, conn);
    await conn.connect();
  }

  async disconnect(peer: PeerInfo): Promise<void> {
    const conn = this.connections.get(peer.deviceId);
    if (conn) {
      conn.close();
      this.connections.delete(peer.deviceId);
    }
  }

  async send(peer: PeerInfo, message: SyncMessage): Promise<void> {
    const conn = this.connections.get(peer.deviceId);
    if (!conn) {
      throw new Error(`Not connected to ${peer.deviceId}`);
    }
    await conn.send(message);
  }

  isConnected(peerId: string): boolean {
    const conn = this.connections.get(peerId);
    return conn?.isOpen ?? false;
  }

  getType(): TransportType {
    return 'wifi';
  }

  private handleMessage(msg: SyncMessage, peer: PeerInfo): void {
    for (const handler of this.messageHandlers) {
      try {
        handler(msg, peer);
      } catch (e) {
        console.error('TCPTransport handler error:', e);
      }
    }
  }

  private handleDisconnect(peer: PeerInfo): void {
    this.connections.delete(peer.deviceId);
    for (const handler of this.connectionHandlers) {
      try {
        handler(peer, false);
      } catch (e) {
        console.error('TCPTransport disconnect handler error:', e);
      }
    }
  }
}

// ============================================================
// Bluetooth Transport
// ============================================================

class BluetoothTransport implements Transport {
  private connectedPeers: Set<string> = new Set();
  private messageHandlers: MessageHandler[] = [];
  private connectionHandlers: ConnectionHandler[] = [];

  async start(): Promise<void> {
    console.log('[BluetoothTransport] Started (simulated)');
    // В реальном приложении здесь была бы инициализация
    // Bluetooth-адаптера, регистрация RFCOMM сервиса и т.д.
    // На десктопе через noble / bluetooth-serial-port
    // На Android через BluetoothAdapter / BluetoothServerSocket
  }

  async stop(): Promise<void> {
    this.connectedPeers.clear();
  }

  async connect(peer: PeerInfo): Promise<void> {
    // Симуляция Bluetooth соединения
    console.log(`[BluetoothTransport] Connecting to ${peer.deviceName} (${peer.deviceId})`);
    this.connectedPeers.add(peer.deviceId);
  }

  async disconnect(peer: PeerInfo): Promise<void> {
    this.connectedPeers.delete(peer.deviceId);
  }

  async send(peer: PeerInfo, message: SyncMessage): Promise<void> {
    if (!this.connectedPeers.has(peer.deviceId)) {
      throw new Error(`Not connected via Bluetooth to ${peer.deviceId}`);
    }
    // Симуляция отправки по Bluetooth
    console.log(`[BluetoothTransport] Sending message to ${peer.deviceId}: ${message.type}`);
  }

  isConnected(peerId: string): boolean {
    return this.connectedPeers.has(peerId);
  }

  getType(): TransportType {
    return 'bluetooth';
  }
}

export const transportManager = new TransportManager();
