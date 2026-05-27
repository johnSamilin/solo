// ============================================================
// SyncEngine — основной движок синхронизации
// Реализует полный цикл: handshake → diff → transfer → apply
// ============================================================

import {
  PeerInfo,
  SyncMessage,
  MessageType,
  VersionMap,
  VersionInfo,
  SyncFileRecord,
  SyncStatus,
  HelloPayload,
  FileRequestPayload,
  FileResponsePayload,
  FileAckPayload,
  ByePayload,
  TransportConfig,
  DEFAULT_TRANSPORT_CONFIG,
} from './types';
import {
  createHelloMessage,
  createVersionMapRequestMessage,
  createVersionMapResponseMessage,
  createFileRequestMessage,
  createFileResponseMessage,
  createFileAckMessage,
  createConflictMessage,
  createConflictResolutionMessage,
  createByeMessage,
  createPingMessage,
  createPongMessage,
} from './Protocol';
import { getOrCreateDeviceId, getOrCreateDeviceName, sha256, delay } from './utils';
import { syncStateDB } from './SyncStateDB';
import { transportManager } from './TransportManager';
import { conflictResolver } from './ConflictResolver';
import { changeTracker } from './ChangeTracker';
import { getNativeAPI } from '../utils/nativeBridge';

export type SyncStatusHandler = (status: SyncStatus, peerId?: string, progress?: string) => void;

/**
 * SyncEngine — управляет циклом синхронизации с пирами.
 */
export class SyncEngine {
  private deviceId: string;
  private deviceName: string;
  private isRunning = false;
  private syncInProgress = false;
  private onStatusHandlers: SyncStatusHandler[] = [];
  private connectedPeers: Map<string, PeerInfo> = new Map();
  private peerVersionMaps: Map<string, VersionMap> = new Map();
  private pendingFileRequests: Map<string, Set<string>> = new Map(); // peerId -> set of fileIds to request
  private pendingFileProvides: Map<string, Set<string>> = new Map(); // peerId -> set of fileIds to provide

  constructor() {
    this.deviceId = getOrCreateDeviceId();
    this.deviceName = getOrCreateDeviceName();
  }

  /**
   * Запускает SyncEngine.
   * Инициализирует БД, транспорты, ChangeTracker, PeerDiscovery.
   */
  async start(transportConfig?: Partial<TransportConfig>): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    // Инициализируем SyncStateDB
    await syncStateDB.initialize();

    // Настраиваем транспорты
    await transportManager.updateConfig(transportConfig || DEFAULT_TRANSPORT_CONFIG);
    await transportManager.start();

    // Подписываемся на сообщения
    transportManager.onMessage((msg, peer) => this.handleMessage(msg, peer));
    transportManager.onConnection((peer, connected) => this.handleConnection(peer, connected));

    // Запускаем ChangeTracker
    await changeTracker.start();

    // Подписываемся на конфликты
    conflictResolver.onConflict((conflicts) => {
      this.notifyStatus('error', undefined, `Обнаружено ${conflicts.length} конфликтов`);
    });

    // Изменения в файлах — отмечаем для синхронизации
    changeTracker.onChange((changes) => {
      if (this.syncInProgress) return;
      // Если есть подключённые пиры — запускаем синхронизацию
      if (this.connectedPeers.size > 0) {
        this.syncWithAllPeers();
      }
    });

    this.notifyStatus('idle');
    console.log(`[SyncEngine] Started: deviceId=${this.deviceId}, name=${this.deviceName}`);
  }

  /**
   * Останавливает SyncEngine.
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    changeTracker.stop();
    await transportManager.stop();
    this.connectedPeers.clear();
    this.peerVersionMaps.clear();
    this.pendingFileRequests.clear();
    this.pendingFileProvides.clear();
    this.notifyStatus('idle');
  }

  /**
   * Обновляет конфигурацию транспортов.
   */
  async updateTransportConfig(config: Partial<TransportConfig>): Promise<void> {
    await transportManager.updateConfig(config);
  }

  /**
   * Возвращает текущую конфигурацию транспортов.
   */
  getTransportConfig(): TransportConfig {
    return transportManager.getConfig();
  }

  /**
   * Запускает синхронизацию со всеми подключёнными пирами.
   */
  async syncWithAllPeers(): Promise<void> {
    if (this.syncInProgress) return;
    this.syncInProgress = true;

    try {
      for (const [peerId, peer] of this.connectedPeers) {
        await this.syncWithPeer(peer);
      }
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Полный цикл синхронизации с одним пиром.
   */
  async syncWithPeer(peer: PeerInfo): Promise<void> {
    this.notifyStatus('syncing', peer.deviceId, 'Начало синхронизации...');

    try {
      // 1. Handshake
      await this.handshake(peer);

      // 2. Diff — вычисляем, какие файлы нужны
      const { toRequest, toProvide, conflicts } = await this.computeDiff(peer);

      this.notifyStatus('syncing', peer.deviceId,
        `Запросить: ${toRequest.length}, Отдать: ${toProvide.length}, Конфликтов: ${conflicts.length}`);

      // 3. Transfer — запрашиваем файлы, которых у нас нет
      if (toRequest.length > 0) {
        this.notifyStatus('syncing', peer.deviceId, `Запрос ${toRequest.length} файлов...`);
        await this.requestFiles(peer, toRequest);
      }

      // 4. Transfer — отдаём файлы, которых нет у пира
      if (toProvide.length > 0) {
        this.notifyStatus('syncing', peer.deviceId, `Отправка ${toProvide.length} файлов...`);
        await this.provideFiles(peer, toProvide);
      }

      // 5. Конфликты
      for (const conflict of conflicts) {
        const conflictMsg = createConflictMessage(this.deviceId, {
          fileId: conflict.fileId,
          noteId: conflict.noteId,
          localVersion: conflict.localVersion,
          remoteVersion: conflict.remoteVersion,
          localContentHash: conflict.localContentHash,
          remoteContentHash: conflict.remoteContentHash,
        });
        await transportManager.send(peer, conflictMsg);
      }

      // 6. Finalize
      const byeMsg = createByeMessage(this.deviceId, 'sync_complete');
      await transportManager.send(peer, byeMsg);

      this.notifyStatus('idle', peer.deviceId, 'Синхронизация завершена');
    } catch (e) {
      console.error(`[SyncEngine] Sync with ${peer.deviceName} failed:`, e);
      this.notifyStatus('error', peer.deviceId, `Ошибка: ${e}`);
    }
  }

  /**
   * Ручное подключение к пиру по адресу.
   */
  async connectToPeer(address: string, port: number): Promise<void> {
    const peer: PeerInfo = {
      deviceId: `manual-${address}-${port}`,
      deviceName: `Manual (${address})`,
      protocolVersion: '1.0.0',
      address,
      port,
      transport: 'wifi',
      capabilities: { bluetooth: false, tls: false, conflictMerge: true },
      lastSeen: Date.now(),
      status: 'disconnected',
    };

    await transportManager.connect(peer);
    this.connectedPeers.set(peer.deviceId, peer);
    await this.syncWithPeer(peer);
  }

  /**
   * Отключается от пира.
   */
  async disconnectFromPeer(peerId: string): Promise<void> {
    const peer = this.connectedPeers.get(peerId);
    if (peer) {
      const byeMsg = createByeMessage(this.deviceId, 'user_disconnect');
      try {
        await transportManager.send(peer, byeMsg);
      } catch {}
      await transportManager.disconnect(peer);
      this.connectedPeers.delete(peerId);
      this.peerVersionMaps.delete(peerId);
    }
  }

  /**
   * Возвращает список подключённых пиров.
   */
  getConnectedPeers(): PeerInfo[] {
    return Array.from(this.connectedPeers.values());
  }

  /**
   * Возвращает статус синхронизации.
   */
  isSyncInProgress(): boolean {
    return this.syncInProgress;
  }

  isRunningStatus(): boolean {
    return this.isRunning;
  }

  onStatus(handler: SyncStatusHandler): () => void {
    this.onStatusHandlers.push(handler);
    return () => {
      this.onStatusHandlers = this.onStatusHandlers.filter(h => h !== handler);
    };
  }

  // ============================================================
  // Handshake
  // ============================================================

  private async handshake(peer: PeerInfo): Promise<void> {
    const versionMap = await syncStateDB.buildVersionMap(this.deviceId);

    const helloMsg = createHelloMessage(
      this.deviceId,
      this.deviceName,
      versionMap,
      {
        bluetooth: transportManager.isTransportAvailable('bluetooth'),
        tls: false,
        conflictMerge: true,
      },
    );

    await transportManager.send(peer, helloMsg);
  }

  // ============================================================
  // Diff
  // ============================================================

  private async computeDiff(peer: PeerInfo): Promise<{
    toRequest: string[];
    toProvide: string[];
    conflicts: any[];
  }> {
    const remoteVM = this.peerVersionMaps.get(peer.deviceId);
    if (!remoteVM) {
      return { toRequest: [], toProvide: [], conflicts: [] };
    }

    const localEntries = (await syncStateDB.buildVersionMap(this.deviceId)).entries;

    const toRequest: string[] = [];
    const toProvide: string[] = [];
    const conflicts: any[] = [];

    // Файлы, которые есть у пира
    for (const [fileId, remoteInfo] of Object.entries(remoteVM.entries)) {
      const localInfo = localEntries[fileId];

      if (!localInfo) {
        // Файла нет локально — нужно скачать
        if (!remoteInfo.deleted) {
          toRequest.push(fileId);
        }
      } else if (localInfo.contentHash !== remoteInfo.contentHash) {
        // Разные хэши — проверяем версии
        if (remoteInfo.version > localInfo.version) {
          // У пира новее — скачиваем
          toRequest.push(fileId);
        } else if (localInfo.version > remoteInfo.version) {
          // У нас новее — отдаём
          toProvide.push(fileId);
        } else {
          // Одинаковые версии, но разные хэши — конфликт
          const conflict = await conflictResolver.detectConflicts(
            localEntries,
            remoteVM.entries,
          );
          conflicts.push(...conflict);
        }
      }
    }

    // Файлы, которые есть у нас, но нет у пира
    for (const [fileId, localInfo] of Object.entries(localEntries)) {
      const remoteInfo = remoteVM.entries[fileId];
      if (!remoteInfo && !localInfo.deleted) {
        toProvide.push(fileId);
      }
    }

    return { toRequest, toProvide, conflicts };
  }

  // ============================================================
  // Transfer: Request
  // ============================================================

  private async requestFiles(peer: PeerInfo, fileIds: string[]): Promise<void> {
    // Запрашиваем файлы пачками
    const batchSize = 10;
    for (let i = 0; i < fileIds.length; i += batchSize) {
      const batch = fileIds.slice(i, i + batchSize);
      const requestMsg = createFileRequestMessage(this.deviceId, batch);
      await transportManager.send(peer, requestMsg);

      // Ждём ответа
      this.pendingFileRequests.set(peer.deviceId, new Set(batch));
    }
  }

  private async handleFileRequest(peer: PeerInfo, payload: FileRequestPayload): Promise<void> {
    for (const fileId of payload.fileIds) {
      try {
        const content = await this.readFileContent(fileId);
        const hash = await sha256(content);

        const record = await syncStateDB.getFile(fileId);
        const version = record?.version || 1;

        const responseMsg = createFileResponseMessage(
          this.deviceId,
          fileId,
          content,
          hash,
          version,
        );
        await transportManager.send(peer, responseMsg);
      } catch (e) {
        console.error(`[SyncEngine] Failed to read file ${fileId}:`, e);
        const ackMsg = createFileAckMessage(this.deviceId, fileId, false, String(e));
        await transportManager.send(peer, ackMsg);
      }
    }
  }

  private async handleFileResponse(peer: PeerInfo, payload: FileResponsePayload): Promise<void> {
    try {
      // Сохраняем полученный файл
      await this.writeFileContent(payload.fileId, payload.content);

      // Обновляем SyncStateDB
      const record: SyncFileRecord = {
        fileId: payload.fileId,
        noteId: payload.fileId.replace(/\.(html|json|css)$/, ''),
        deviceId: peer.deviceId,
        version: payload.version,
        contentHash: payload.hash,
        mtime: Date.now(),
        deleted: false,
        fileType: payload.fileId.endsWith('.html') ? 'html' :
                 payload.fileId.endsWith('.json') ? 'json' : 'css',
      };
      await syncStateDB.putFile(record);

      // Отправляем ACK
      const ackMsg = createFileAckMessage(this.deviceId, payload.fileId, true);
      await transportManager.send(peer, ackMsg);
    } catch (e) {
      console.error(`[SyncEngine] Failed to apply file ${payload.fileId}:`, e);
      const ackMsg = createFileAckMessage(this.deviceId, payload.fileId, false, String(e));
      await transportManager.send(peer, ackMsg);
    }
  }

  // ============================================================
  // Transfer: Provide
  // ============================================================

  private async provideFiles(peer: PeerInfo, fileIds: string[]): Promise<void> {
    // Отдаём файлы, которые пир запросит через FILE_REQUEST
    this.pendingFileProvides.set(peer.deviceId, new Set(fileIds));
  }

  // ============================================================
  // Message handling
  // ============================================================

  private async handleMessage(msg: SyncMessage, peer: PeerInfo): Promise<void> {
    switch (msg.type) {
      case MessageType.HELLO:
        await this.handleHello(peer, msg.payload as HelloPayload);
        break;

      case MessageType.VERSION_MAP_REQUEST:
        await this.handleVersionMapRequest(peer);
        break;

      case MessageType.VERSION_MAP_RESPONSE:
        await this.handleVersionMapResponse(peer, msg.payload as VersionMap);
        break;

      case MessageType.FILE_REQUEST:
        await this.handleFileRequest(peer, msg.payload as FileRequestPayload);
        break;

      case MessageType.FILE_RESPONSE:
        await this.handleFileResponse(peer, msg.payload as FileResponsePayload);
        break;

      case MessageType.FILE_ACK:
        await this.handleFileAck(peer, msg.payload as FileAckPayload);
        break;

      case MessageType.CONFLICT:
        console.log(`[SyncEngine] Conflict reported by ${peer.deviceName}:`, msg.payload);
        break;

      case MessageType.CONFLICT_RESOLUTION:
        console.log(`[SyncEngine] Conflict resolution from ${peer.deviceName}:`, msg.payload);
        break;

      case MessageType.BYE:
        await this.handleBye(peer, msg.payload as ByePayload);
        break;

      case MessageType.PING: {
        const pong = createPongMessage(this.deviceId);
        await transportManager.send(peer, pong);
        break;
      }

      case MessageType.PONG:
        // Всё ок, пир жив
        break;
    }
  }

  private async handleHello(peer: PeerInfo, payload: HelloPayload): Promise<void> {
    // Обновляем информацию о пире
    peer.deviceId = payload.deviceId;
    peer.deviceName = payload.deviceName;
    peer.protocolVersion = payload.protocolVersion;
    peer.capabilities = payload.capabilities;
    peer.lastSeen = Date.now();
    peer.status = 'connected';

    this.connectedPeers.set(payload.deviceId, peer);
    this.peerVersionMaps.set(payload.deviceId, payload.versionMap);

    // Отвечаем своим HELLO
    const versionMap = await syncStateDB.buildVersionMap(this.deviceId);
    const helloResponse = createHelloMessage(
      this.deviceId,
      this.deviceName,
      versionMap,
      {
        bluetooth: transportManager.isTransportAvailable('bluetooth'),
        tls: false,
        conflictMerge: true,
      },
    );
    await transportManager.send(peer, helloResponse);

    // Запускаем синхронизацию
    await this.syncWithPeer(peer);
  }

  private async handleVersionMapRequest(peer: PeerInfo): Promise<void> {
    const versionMap = await syncStateDB.buildVersionMap(this.deviceId);
    const response = createVersionMapResponseMessage(this.deviceId, versionMap);
    await transportManager.send(peer, response);
  }

  private async handleVersionMapResponse(peer: PeerInfo, versionMap: VersionMap): Promise<void> {
    this.peerVersionMaps.set(peer.deviceId, versionMap);
  }

  private async handleFileAck(peer: PeerInfo, payload: FileAckPayload): Promise<void> {
    if (payload.success) {
      // Файл успешно получен пиром
      console.log(`[SyncEngine] ${peer.deviceName} confirmed receipt of ${payload.fileId}`);
    } else {
      console.warn(`[SyncEngine] ${peer.deviceName} failed to receive ${payload.fileId}: ${payload.error}`);
    }
  }

  private async handleBye(peer: PeerInfo, payload: ByePayload): Promise<void> {
    console.log(`[SyncEngine] ${peer.deviceName} disconnected: ${payload.reason}`);
    this.connectedPeers.delete(peer.deviceId);
    this.peerVersionMaps.delete(peer.deviceId);
    peer.status = 'disconnected';
  }

  private handleConnection(peer: PeerInfo, connected: boolean): void {
    if (connected) {
      console.log(`[SyncEngine] Connected to ${peer.deviceName}`);
      peer.status = 'connected';
      this.connectedPeers.set(peer.deviceId, peer);
    } else {
      console.log(`[SyncEngine] Disconnected from ${peer.deviceName}`);
      this.connectedPeers.delete(peer.deviceId);
      this.peerVersionMaps.delete(peer.deviceId);
      peer.status = 'disconnected';
    }
  }

  // ============================================================
  // File I/O (через нативный API)
  // ============================================================

  private async readFileContent(fileId: string): Promise<string> {
    const api = getNativeAPI();
    if (!api) throw new Error('Native API not available');

    const result = await api.openFile(fileId);
    if (!result.success || result.content === undefined) {
      throw new Error(result.error || 'Failed to read file');
    }
    return result.content;
  }

  private async writeFileContent(fileId: string, content: string): Promise<void> {
    const api = getNativeAPI();
    if (!api) throw new Error('Native API not available');

    // Сохраняем файл через нативный API
    const result = await api.updateFile(fileId, content);
    if (!result.success) {
      throw new Error(result.error || 'Failed to write file');
    }
  }

  // ============================================================
  // Status notifications
  // ============================================================

  private notifyStatus(status: SyncStatus, peerId?: string, progress?: string): void {
    for (const handler of this.onStatusHandlers) {
      try {
        handler(status, peerId, progress);
      } catch (e) {
        console.error('SyncEngine status handler error:', e);
      }
    }
  }
}

export const syncEngine = new SyncEngine();
