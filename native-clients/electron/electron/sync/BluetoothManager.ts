/**
 * BluetoothManager — управление Bluetooth RFCOMM-соединениями.
 *
 * Реализует транспортный уровень для синхронизации.
 * Использует node-bluetooth-serial-port (macOS) или D-Bus BlueZ (Linux).
 *
 * Платформенные детали:
 * - macOS: IOBluetooth через @abandonware/noble (BLE) или node-bluetooth-serial-port (RFCOMM Classic)
 * - Linux: BlueZ D-Bus API
 */

import { EventEmitter } from 'events';
import { Protocol } from './Protocol';
import { SyncMessage, MessageType, PeerDevice, PlatformType } from './types';

export interface BluetoothPeer {
  address: string;
  name: string;
  connected: boolean;
}

export type DiscoveryCallback = (peers: BluetoothPeer[]) => void;
export type ConnectionCallback = (peer: BluetoothPeer) => void;
export type DataCallback = (peer: BluetoothPeer, message: SyncMessage) => void;

// Кастомный UUID сервиса Solo Sync (для SDP)
export const SOLO_SYNC_SERVICE_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
// Стандартный UUID для Serial Port Profile (RFCOMM)
export const RFCOMM_SPP_UUID = '00001101-0000-1000-8000-00805F9B34FB';

export class BluetoothManager extends EventEmitter {
  private discoveredPeers: Map<string, BluetoothPeer> = new Map();
  private connections: Map<string, { socket: any; buffer: ArrayBuffer }> = new Map();
  private scanning = false;

  // Callbacks для внешней подписки
  private onDataCallback: DataCallback | null = null;

  // Конфигурация
  private platform: PlatformType;
  private serviceUuid: string;
  
  // Динамически загружаемые зависимости
  private bluetoothSerialPort: any = null;
  private dbusClient: any = null;

  constructor(platform: PlatformType) {
    super();
    this.platform = platform;
    // На Android используем стандартный SPP UUID, на других платформах - кастомный
    this.serviceUuid = platform === 'android' ? RFCOMM_SPP_UUID : SOLO_SYNC_SERVICE_UUID;
  }

  /**
   * Инициализирует Bluetooth-адаптер.
   */
  async initialize(): Promise<boolean> {
    try {
      console.log(`[BluetoothManager] Initializing on ${this.platform}`);
      
      // Проверяем, доступен ли Bluetooth
      const isEnabled = await this.isBluetoothEnabled();
      if (!isEnabled) {
        console.warn('[BluetoothManager] Bluetooth is not enabled on this platform');
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('[BluetoothManager] Initialization failed:', error);
      return false;
    }
  }

  /**
   * Запускает сканирование Bluetooth-устройств.
   */
  async startDiscovery(): Promise<BluetoothPeer[]> {
    if (this.scanning) return Array.from(this.discoveredPeers.values());

    this.scanning = true;
    this.discoveredPeers.clear();

    console.log('[BluetoothManager] Starting discovery...');

    // TODO: Реальная имплементация discovery
    // - Linux: вызвать StartDiscovery через BlueZ D-Bus
    // - macOS: IOBluetoothDeviceInquiry
    // - Android: BluetoothAdapter.startDiscovery()

    // Эмулируем сканирование
    await new Promise(resolve => setTimeout(resolve, 3000));

    this.scanning = false;
    this.emit('discovery_complete', Array.from(this.discoveredPeers.values()));

    return Array.from(this.discoveredPeers.values());
  }

  /**
   * Останавливает сканирование.
   */
  stopDiscovery(): void {
    this.scanning = false;
    console.log('[BluetoothManager] Discovery stopped');
    // TODO: Остановить Bluetooth discovery
  }

  /**
   * Подключается к устройству по Bluetooth-адресу.
   */
  async connect(address: string): Promise<boolean> {
    try {
      console.log(`[BluetoothManager] Connecting to ${address}...`);

      // TODO: Реальная имплементация RFCOMM-соединения
      // - Linux: Connect через BlueZ D-Bus (org.bluez.Network1)
      // - macOS: IOBluetoothRFCOMMChannel
      // - Android: BluetoothDevice.createRfcommSocketToServiceRecord()

      // Создаём сокет (заглушка)
      const socket = { address, write: (data: Buffer) => {} };
      this.connections.set(address, { socket, buffer: new ArrayBuffer(0) });

      this.emit('connected', { address, name: '', connected: true });
      return true;
    } catch (error) {
      console.error(`[BluetoothManager] Connection to ${address} failed:`, error);
      return false;
    }
  }

  /**
   * Отключается от устройства.
   */
  async disconnect(address: string): Promise<void> {
    const conn = this.connections.get(address);
    if (conn) {
      try {
        // TODO: Закрыть сокет
        this.connections.delete(address);
        this.emit('disconnected', address);
      } catch (error) {
        console.error(`[BluetoothManager] Disconnect from ${address} failed:`, error);
      }
    }
  }

  /**
   * Отключается от всех устройств.
   */
  async disconnectAll(): Promise<void> {
    for (const address of this.connections.keys()) {
      await this.disconnect(address);
    }
  }

  /**
   * Отправляет сообщение указанному устройству.
   */
  async sendMessage(address: string, message: SyncMessage, retries: number = 3, timeout: number = 10000): Promise<boolean> {
    const conn = this.connections.get(address);
    if (!conn) {
      console.error(`[BluetoothManager] No connection to ${address}`);
      return false;
    }

    let attempts = 0;
    while (attempts < retries) {
      try {
        const buffer = Protocol.encode(message);
        // TODO: Отправить данные через реальный сокет
        // conn.socket.write(Buffer.from(buffer));
        console.log(`[BluetoothManager] Sent ${MessageType[message.type]} to ${address}`);
        
        // В реальной реализации здесь будет ожидание подтверждения с таймаутом
        return true;
      } catch (error) {
        attempts++;
        console.error(`[BluetoothManager] Send to ${address} failed (attempt ${attempts}):`, error);
        
        if (attempts >= retries) {
          console.error(`[BluetoothManager] Failed to send message after ${retries} attempts`);
          return false;
        }
        
        // Ожидание перед повторной попыткой
        await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
      }
    }
    
    return false;
  }

  /**
   * Обрабатывает входящие данные от устройства.
   */
  private handleData(address: string, data: ArrayBuffer): void {
    const conn = this.connections.get(address);
    if (!conn) return;

    // Буферизируем данные
    const combined = new Uint8Array(conn.buffer.byteLength + data.byteLength);
    combined.set(new Uint8Array(conn.buffer));
    combined.set(new Uint8Array(data), conn.buffer.byteLength);

    // Пытаемся декодировать сообщение
    let offset = 0;
    while (offset < combined.length) {
      const remaining = combined.slice(offset);
      // Преобразуем Uint8Array в Buffer для Protocol.decode
      const buffer = Buffer.from(remaining);
      const message = Protocol.decode(buffer);

      if (message) {
        const msgSize = 5 + new TextEncoder().encode(JSON.stringify(message.payload)).length;
        offset += msgSize;

        if (this.onDataCallback) {
          this.onDataCallback(
            { address, name: '', connected: true },
            message
          );
        }
        this.emit('message', address, message);
      } else {
        break; // Недостаточно данных
      }
    }

    // Сохраняем необработанные данные
    conn.buffer = combined.slice(offset).buffer;
  }

  /**
   * Регистрирует callback для входящих сообщений.
   */
  onData(callback: DataCallback): void {
    this.onDataCallback = callback;
  }

  /**
   * Возвращает список обнаруженных устройств.
   */
  getDiscoveredPeers(): BluetoothPeer[] {
    return Array.from(this.discoveredPeers.values());
  }

  /**
   * Возвращает список подключённых устройств.
   */
  getConnectedPeers(): BluetoothPeer[] {
    const peers: BluetoothPeer[] = [];
    for (const [address] of this.connections) {
      peers.push({ address, name: '', connected: true });
    }
    return peers;
  }

  /**
   * Проверяет, включён ли Bluetooth.
   */
  async isBluetoothEnabled(): Promise<boolean> {
    // TODO: Проверить состояние Bluetooth через платформенный API
    return true;
  }

  /**
   * Очищает ресурсы.
   */
  destroy(): void {
    this.disconnectAll();
    this.removeAllListeners();
    this.onDataCallback = null;
  }
}
