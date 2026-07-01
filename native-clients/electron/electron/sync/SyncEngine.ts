/**
 * SyncEngine — основной движок P2P Bluetooth-синхронизации.
 *
 * Координирует:
 * - Обнаружение пиров (PeerDiscovery)
 * - Bluetooth-соединение (BluetoothManager)
 * - Обмен манифестами (Protocol)
 * - Вычисление diff'ов
 * - Передачу файлов
 * - Разрешение конфликтов (ConflictResolver)
 * - Отслеживание изменений ФС (FileWatcher)
 * - Boot-time scan (BootScanner)
 * - SQLite-базу (SyncDatabase)
 */

import { EventEmitter } from 'events';
import { SyncDatabase } from './SyncDatabase';
import { BluetoothManager, BluetoothPeer } from './BluetoothManager';
import { ConflictResolver } from './ConflictResolver';
import { FileWatcher } from './FileWatcher';
import { BootScanner, BootScanResult } from './BootScanner';
import { Protocol } from './Protocol';
import {
  SyncMessage,
  MessageType,
  SyncStatus,
  SyncConnectionState,
  SyncEvent,
  SyncEventType,
  SyncProgress,
  PeerDevice,
  PlatformType,
  HandshakePayload,
  HandshakeAckPayload,
  ManifestPayload,
  ManifestDiffPayload,
  FilePayload,
  FileAckPayload,
  TombstonePayload,
  SyncCompletePayload,
  SyncConflict,
  FileManifestEntry,
  TombstoneManifestEntry,
} from './types';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';

export interface SyncEngineConfig {
  deviceId: string;
  deviceName: string;
  platform: PlatformType;
  dataDir: string;
  dbDir: string;
  appVersion: string;
  protocolVersion: number;
  syncIntervalMs?: number; // Интервал автосинхронизации в миллисекундах (по умолчанию 300000 = 5 минут)
}

type SyncEventCallback = (event: SyncEvent) => void;

export class SyncEngine extends EventEmitter {
  private config: SyncEngineConfig;
  private db: SyncDatabase;
  private bluetoothManager: BluetoothManager;
  private conflictResolver: ConflictResolver;
  private fileWatcher: FileWatcher;
  private bootScanner: BootScanner;

  private _state: SyncConnectionState = 'idle';
  private connectedPeer: BluetoothPeer | null = null;
  private progress: SyncProgress | null = null;
  private eventSubscribers: Set<SyncEventCallback> = new Set();
  private activePeerId: string | null = null;

  // Состояние активной сессии
  private sessionFilesTransferred = 0;
  private sessionTombstonesApplied = 0;
  private sessionConflictsDetected = 0;
  private sessionStartTime = 0;
  
  // Автосинхронизация
  private autoSyncTimer: NodeJS.Timeout | null = null;
  private readonly defaultSyncInterval = 300000; // 5 минут по умолчанию

  constructor(config: SyncEngineConfig) {
    super();
    this.config = config;

    // Инициализируем БД
    this.db = new SyncDatabase(config.dbDir);

    // Инициализируем Bluetooth
    this.bluetoothManager = new BluetoothManager(config.platform);

    // Инициализируем разрешение конфликтов
    this.conflictResolver = new ConflictResolver(this.db);

    // Инициализируем FileWatcher
    this.fileWatcher = new FileWatcher(this.db, config.dataDir);

    // Инициализируем BootScanner
    this.bootScanner = new BootScanner(this.db, config.dataDir);

    // Подписываемся на события Bluetooth
    this.setupBluetoothHandlers();
  }

  // ==================== Публичные методы ====================

  /**
   * Инициализирует движок: запускает FileWatcher, BootScanner.
   */
  async initialize(): Promise<boolean> {
    console.log('[SyncEngine] Initializing...');

    // Шаг 1: boot-time scan
    try {
      const scanResult = await this.bootScanner.scan();
      console.log('[SyncEngine] Boot scan result:', scanResult);
      this.emitSyncEvent('state_changed', { state: 'idle', bootScan: scanResult });
    } catch (error) {
      console.error('[SyncEngine] Boot scan failed:', error);
    }

    // Шаг 2: инициализация Bluetooth
    const btReady = await this.bluetoothManager.initialize();
    if (!btReady) {
      console.warn('[SyncEngine] Bluetooth not available');
    }

    // Шаг 3: запуск FileWatcher
    await this.fileWatcher.start();

    // Шаг 4: настройка авто-разрешения конфликтов
    this.conflictResolver.onConflict((conflict) => {
      // По умолчанию авто-разрешаем LWW
      const strategy = this.conflictResolver.autoResolve(conflict);
      this.emitSyncEvent('conflict_detected', {
        conflict,
        autoResolved: true,
        strategy,
      });
    });

    // Регистрируем обработчик входящих данных
    this.bluetoothManager.onData((peer, message) => {
      this.handleMessage(peer, message);
    });

    console.log('[SyncEngine] Initialized');
    return true;
  }

  /**
   * Запускает синхронизацию (discovery + sync).
   */
  async startSync(): Promise<boolean> {
    if (this._state !== 'idle') {
      console.warn('[SyncEngine] Already syncing');
      return false;
    }

    this.setState('discovering');
    this.emitSyncEvent('state_changed', { state: 'discovering' });

    try {
      // Шаг 1: discover пиров
      const peers = await this.bluetoothManager.startDiscovery();

      if (peers.length === 0) {
        // Пробуем подключиться к доверенным пирам напрямую
        const trustedPeers = this.db.getTrustedPeers();
        for (const peer of trustedPeers) {
          if (peer.macAddress) {
            this.emitSyncEvent('state_changed', { state: 'connecting', peer: peer.name });
            const connected = await this.bluetoothManager.connect(peer.macAddress);
            if (connected) {
              await this.runSyncSession(peer.name, peer.macAddress);
              return true;
            }
          }
        }

        this.setState('idle');
        this.emitSyncEvent('error', { message: 'No peers found' });
        return false;
      }

      // Шаг 2: подключаемся к первому доступному пиру
      const targetPeer = peers[0];
      this.setState('connecting');
      this.emitSyncEvent('state_changed', { state: 'connecting', peer: targetPeer.name });

      const connected = await this.bluetoothManager.connect(targetPeer.address);
      if (!connected) {
        this.setState('error');
        this.emitSyncEvent('error', { message: `Failed to connect to ${targetPeer.name}` });
        return false;
      }

      // Шаг 3: сессия синхронизации
      return await this.runSyncSession(targetPeer.name, targetPeer.address);
    } catch (error) {
      console.error('[SyncEngine] Sync failed:', error);
      this.setState('error');
      this.emitSyncEvent('error', { message: (error as Error).message });
      return false;
    }
  }

  /**
   * Останавливает синхронизацию.
   */
  async stopSync(): Promise<boolean> {
    try {
      if (this.connectedPeer) {
        await this.bluetoothManager.sendMessage(this.connectedPeer.address, Protocol.disconnect('user_stopped'));
        await this.bluetoothManager.disconnect(this.connectedPeer.address);
      }
      this.bluetoothManager.stopDiscovery();
      this.setState('idle');
      this.emitSyncEvent('state_changed', { state: 'idle' });
      return true;
    } catch (error) {
      console.error('[SyncEngine] Stop failed:', error);
      return false;
    }
  }

  /**
   * Получает статус синхронизации.
   */
  getStatus(): SyncStatus {
    // Получаем время последней синхронизации из БД
    const lastSync = this.db.getLastSyncTime();
    
    return {
      state: this._state,
      lastSyncAt: lastSync,
      connectedPeers: this.bluetoothManager.getConnectedPeers().map(p => ({
        id: p.address,
        name: p.name,
        deviceType: this.config.platform,
        macAddress: p.address,
        lastSeenAt: Date.now(),
        firstSeenAt: Date.now(),
        trustStatus: 'trusted',
        isPaired: true,
        protocolVersion: this.config.protocolVersion,
      })),
      progress: this.progress,
      error: null,
    };
  }

  /**
   * Инициирует обнаружение пиров.
   */
  async discoverPeers(): Promise<PeerDevice[]> {
    const peers = await this.bluetoothManager.startDiscovery();
    return peers.map((p, i) => ({
      id: `bt:${p.address}`,
      name: p.name || `Device ${i + 1}`,
      deviceType: this.config.platform,
      macAddress: p.address,
      lastSeenAt: Date.now(),
      firstSeenAt: Date.now(),
      trustStatus: 'pending' as const,
      isPaired: false,
      protocolVersion: this.config.protocolVersion,
    }));
  }

  /**
   * Подключается к пиру.
   */
  async pairDevice(deviceId: string): Promise<boolean> {
    // deviceId — это MAC-адрес или UUID
    const connected = await this.bluetoothManager.connect(deviceId);
    if (connected) {
      const peer = this.bluetoothManager.getConnectedPeers().find(p => p.address === deviceId);
      if (peer) {
        // Сохраняем в БД
        this.db.upsertPeer({
          id: `bt:${deviceId}`,
          name: peer.name || 'Unknown',
          deviceType: this.config.platform,
          macAddress: deviceId,
          lastSeenAt: Date.now(),
          firstSeenAt: Date.now(),
          trustStatus: 'trusted',
          publicKey: null,
          protocolVersion: this.config.protocolVersion,
          isPaired: 1,
        });
      }
      return true;
    }
    return false;
  }

  /**
   * Отключает пир.
   */
  async unpairDevice(deviceId: string): Promise<boolean> {
    await this.bluetoothManager.disconnect(deviceId);
    this.db.deletePeer(`bt:${deviceId}`);
    return true;
  }

  /**
   * Возвращает список пиров из БД.
   */
  getPeers(): PeerDevice[] {
    return this.db.getAllPeers().map(p => ({
      id: p.id,
      name: p.name,
      deviceType: p.deviceType as PlatformType,
      macAddress: p.macAddress || undefined,
      lastSeenAt: p.lastSeenAt,
      firstSeenAt: p.firstSeenAt,
      trustStatus: p.trustStatus,
      isPaired: p.isPaired === 1,
      protocolVersion: p.protocolVersion,
    }));
  }

  // ==================== Конфликты ====================

  getConflicts(): SyncConflict[] {
    return this.conflictResolver.getPendingConflicts();
  }

  resolveConflict(conflictId: number, strategy: 'local_wins' | 'remote_wins'): void {
    this.conflictResolver.manualResolve(conflictId, strategy);
    this.emitSyncEvent('conflict_resolved', { conflictId, strategy });
  }

  // ==================== События ====================

  onSyncEvent(callback: (event: SyncEvent) => void): () => void {
    this.eventSubscribers.add(callback);
    return () => {
      this.eventSubscribers.delete(callback);
    };
  }

  /**
  /**
   * Запускает автоматическую синхронизацию по таймеру.
   */
  startAutoSync(): void {
    if (this.autoSyncTimer) {
      this.stopAutoSync();
    }

    const interval = this.config.syncIntervalMs || this.defaultSyncInterval;
    console.log(`[SyncEngine] Auto-sync started with interval ${interval}ms`);

    this.autoSyncTimer = setInterval(async () => {
      if (this._state === 'idle') {
        console.log('[SyncEngine] Auto-sync triggered');
        await this.startSync();
      } else {
        console.log(`[SyncEngine] Auto-sync skipped, current state: ${this._state}`);
      }
    }, interval);
  }

  /**
   * Останавливает автоматическую синхронизацию.
   */
  stopAutoSync(): void {
    if (this.autoSyncTimer) {
      clearInterval(this.autoSyncTimer);
      this.autoSyncTimer = null;
      console.log('[SyncEngine] Auto-sync stopped');
    }
  }

  /**
   * Очищает ресурсы.
   */
  destroy(): void {
    this.stopAutoSync();
    this.fileWatcher.stop();
    this.bluetoothManager.destroy();
    this.db.close();
    this.eventSubscribers.clear();
    this.removeAllListeners();
  }

  // ==================== Приватные методы ====================

  private setState(state: SyncConnectionState): void {
    this._state = state;
  }

  private emitSyncEvent(type: SyncEventType, data?: any): void {
    const event: SyncEvent = { type, timestamp: Date.now(), data };
    for (const cb of this.eventSubscribers) {
      try {
        cb(event);
      } catch (error) {
        console.error('[SyncEngine] Event callback error:', error);
      }
    }
    this.emit('event', event);
  }

  private setupBluetoothHandlers(): void {
    this.bluetoothManager.on('connected', (peer: BluetoothPeer) => {
      this.connectedPeer = peer;
      this.emitSyncEvent('peer_connected', peer);
    });

    this.bluetoothManager.on('disconnected', (address: string) => {
      if (this.connectedPeer?.address === address) {
        this.connectedPeer = null;
      }
      this.setState('idle');
      this.emitSyncEvent('peer_disconnected', { address });
    });

    this.bluetoothManager.on('discovery_complete', (peers: BluetoothPeer[]) => {
      for (const peer of peers) {
        this.emitSyncEvent('peer_discovered', peer);
      }
    });
  }

  /**
   * Запускает сессию синхронизации с подключённым пиром.
   */
  private async runSyncSession(peerName: string, peerAddress: string): Promise<boolean> {
    this.sessionStartTime = Date.now();
    this.sessionFilesTransferred = 0;
    this.sessionTombstonesApplied = 0;
    this.sessionConflictsDetected = 0;

    this.setState('handshake');
    this.emitSyncEvent('state_changed', { state: 'handshake' });

    try {
      // Шаг 1: HANDSHAKE
      const handshakeMsg = Protocol.handshake({
        peerId: this.config.deviceId,
        deviceName: this.config.deviceName,
        platform: this.config.platform,
        appVersion: this.config.appVersion,
        protocolVersion: this.config.protocolVersion,
      });

      const sent = await this.bluetoothManager.sendMessage(peerAddress, handshakeMsg);
      if (!sent) {
        throw new Error('Failed to send handshake');
      }

      // Ожидаем HANDSHAKE_ACK (обрабатывается в handleMessage)
      // Для простоты эмулируем успешный handshake
      this.activePeerId = `bt:${peerAddress}`;

      // Сохраняем пира в БД
      this.db.upsertPeer({
        id: this.activePeerId,
        name: peerName,
        deviceType: this.config.platform,
        macAddress: peerAddress,
        lastSeenAt: Date.now(),
        firstSeenAt: Date.now(),
        trustStatus: 'trusted',
        publicKey: null,
        protocolVersion: this.config.protocolVersion,
        isPaired: 1,
      });

      // Шаг 2: Отправляем MANIFEST
      this.setState('syncing');
      this.setProgress({ totalFiles: 0, transferredFiles: 0, phase: 'manifest' });

      const manifest = this.buildManifest();
      await this.bluetoothManager.sendMessage(peerAddress, Protocol.manifest(manifest));
      this.emitSyncEvent('sync_progress', { phase: 'manifest' });

      // Шаг 3: Ждем MANIFEST от пира
      console.log('[SyncEngine] Waiting for remote manifest...');
      // Устанавливаем флаг ожидания MANIFEST
      const remoteManifestPromise = new Promise<ManifestPayload>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout waiting for remote manifest'));
        }, 30000); // 30 секунд таймаут
        
        const handleMessage = async (peer: BluetoothPeer, message: SyncMessage) => {
          if (peer.address === peerAddress && message.type === MessageType.MANIFEST) {
            // Убираем обработчик
            this.bluetoothManager.off('message', handleMessage);
            clearTimeout(timeout);
            
            resolve(message.payload as ManifestPayload);
          }
        };
        
        this.bluetoothManager.on('message', handleMessage);
      });
      
      let remoteManifest: ManifestPayload;
      try {
        remoteManifest = await remoteManifestPromise;
      } catch (error) {
        console.error('[SyncEngine] Failed to receive remote manifest:', error);
        throw error;
      }

      // Шаг 4: Вычисляем diff и отправляем MANIFEST_DIFF
      const diff = this.computeDiff(remoteManifest);
      await this.bluetoothManager.sendMessage(peerAddress, Protocol.manifestDiff(diff));
      this.emitSyncEvent('sync_progress', { phase: 'diff' });

      // Шаг 5: Обрабатываем запрошенные файлы от пира
      // Это происходит асинхронно в handleMessage, но мы можем ждать завершения
      
      // Шаг 6: Ждем MANIFEST_DIFF от пира (файлы, которые ему нужны от нас)
      console.log('[SyncEngine] Waiting for remote diff...');
      const remoteDiffPromise = new Promise<ManifestDiffPayload>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout waiting for remote diff'));
        }, 30000);
        
        const handleMessage = async (peer: BluetoothPeer, message: SyncMessage) => {
          if (peer.address === peerAddress && message.type === MessageType.MANIFEST_DIFF) {
            // Убираем обработчик
            this.bluetoothManager.off('message', handleMessage);
            clearTimeout(timeout);
            
            resolve(message.payload as ManifestDiffPayload);
          }
        };
        
        this.bluetoothManager.on('message', handleMessage);
      });
      
      let remoteDiff: ManifestDiffPayload;
      try {
        remoteDiff = await remoteDiffPromise;
      } catch (error) {
        console.error('[SyncEngine] Failed to receive remote diff:', error);
        throw error;
      }

      // Отправляем запрошенные файлы пиру
      for (const fileId of remoteDiff.neededFiles) {
        const fileData = await this.readFileForSync(fileId);
        if (fileData) {
          await this.bluetoothManager.sendMessage(peerAddress, Protocol.file(fileData));
          this.sessionFilesTransferred++;
          
          // Ждем подтверждения получения
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error(`Timeout waiting for ACK for file ${fileId}`));
            }, 10000);
            
            const handleMessage = async (peer: BluetoothPeer, message: SyncMessage) => {
              if (peer.address === peerAddress && message.type === MessageType.FILE_ACK &&
                  message.payload.fileId === fileId) {
                this.bluetoothManager.off('message', handleMessage);
                clearTimeout(timeout);
                
                if (message.payload.conflict) {
                  this.sessionConflictsDetected++;
                }
                
                resolve();
              }
            };
            
            this.bluetoothManager.on('message', handleMessage);
          });
        }
      }

      // Отправляем запрошенные tombstones пиру
      for (const fileId of remoteDiff.neededTombstones) {
        const tombstone = this.db.getTombstone(fileId);
        if (tombstone) {
          await this.bluetoothManager.sendMessage(peerAddress, Protocol.tombstone({
            fileId: tombstone.fileId,
            deletedAt: tombstone.deletedAt,
            originalPath: tombstone.originalPath,
            checksum: tombstone.checksum || undefined,
          }));
          this.db.markTombstoneSynced(fileId);
          this.sessionTombstonesApplied++;
        }
      }

      // Шаг 7: Завершаем
      await this.bluetoothManager.sendMessage(peerAddress, Protocol.syncComplete({
        summary: {
          filesTransferred: this.sessionFilesTransferred,
          tombstonesApplied: this.sessionTombstonesApplied,
          conflictsDetected: this.sessionConflictsDetected,
          duration: Date.now() - this.sessionStartTime,
        },
      }));

      this.setState('complete');
      this.setProgress(null);
      
      // Обновляем время последней синхронизации
      this.db.updateLastSyncTime(Date.now());

      this.emitSyncEvent('sync_complete', {
        summary: {
          filesTransferred: this.sessionFilesTransferred,
          tombstonesApplied: this.sessionTombstonesApplied,
          conflictsDetected: this.sessionConflictsDetected,
          duration: Date.now() - this.sessionStartTime,
        },
      });

      return true;
    } catch (error) {
      console.error('[SyncEngine] Session failed:', error);
      this.setState('error');
      this.emitSyncEvent('error', { message: (error as Error).message });
      return false;
    }
  }

  /**
   * Строит манифест из sync_ledger + tombstones.
   */
  private buildManifest(): ManifestPayload {
    const entries = this.db.getAllLatestLedgerEntries();
    const tombstones = this.db.getAllTombstones();

    const files = entries
      .filter(e => e.operation !== 'delete')
      .map(e => ({
        fileId: e.fileId,
        version: e.version,
        checksum: e.checksum,
        modifiedAt: e.modifiedAt,
        path: e.filePath,
        sizeBytes: e.sizeBytes,
      }));

    return {
      files,
      tombstones: tombstones.map(t => ({
        fileId: t.fileId,
        deletedAt: t.deletedAt,
        originalPath: t.originalPath,
        checksum: t.checksum || undefined,
      })),
    };
  }

  /**
   * Обрабатывает входящее сообщение от пира.
   */
  private async handleMessage(peer: BluetoothPeer, message: SyncMessage): Promise<void> {
    console.log(`[SyncEngine] Received ${MessageType[message.type]} from ${peer.address}`);

    switch (message.type) {
      case MessageType.HANDSHAKE: {
        const payload = message.payload as HandshakePayload;
        // Отвечаем подтверждением
        await this.bluetoothManager.sendMessage(peer.address, Protocol.handshakeAck({
          peerId: this.config.deviceId,
          accepted: true,
        }));
        this.activePeerId = payload.peerId;
        this.emitSyncEvent('peer_connected', { id: payload.peerId, name: payload.deviceName });
        break;
      }

      case MessageType.HANDSHAKE_ACK: {
        const payload = message.payload as HandshakeAckPayload;
        if (!payload.accepted) {
          this.emitSyncEvent('error', { message: `Handshake rejected: ${payload.rejectReason}` });
        }
        break;
      }

      case MessageType.MANIFEST: {
        const payload = message.payload as ManifestPayload;
        // Вычисляем diff и отправляем MANIFEST_DIFF
        const diff = this.computeDiff(payload);
        await this.bluetoothManager.sendMessage(peer.address, Protocol.manifestDiff(diff));
        this.emitSyncEvent('sync_progress', { phase: 'diff' });
        break;
      }

      case MessageType.MANIFEST_DIFF: {
        const payload = message.payload as ManifestDiffPayload;
        // Отправляем запрошенные файлы
        for (const fileId of payload.neededFiles) {
          const fileData = await this.readFileForSync(fileId);
          if (fileData) {
            await this.bluetoothManager.sendMessage(peer.address, Protocol.file(fileData));
            this.sessionFilesTransferred++;
          }
        }
        // Отправляем запрошенные tombstones
        for (const fileId of payload.neededTombstones) {
          const tombstone = this.db.getTombstone(fileId);
          if (tombstone) {
            await this.bluetoothManager.sendMessage(peer.address, Protocol.tombstone({
              fileId: tombstone.fileId,
              deletedAt: tombstone.deletedAt,
              originalPath: tombstone.originalPath,
              checksum: tombstone.checksum || undefined,
            }));
            this.db.markTombstoneSynced(fileId);
            this.sessionTombstonesApplied++;
          }
        }
        this.emitSyncEvent('sync_progress', { phase: 'transfer', totalFiles: payload.neededFiles.length, transferredFiles: this.sessionFilesTransferred });
        break;
      }

      case MessageType.FILE: {
        const payload = message.payload as FilePayload;
        const saved = await this.saveReceivedFile(payload);
        if (saved) {
          await this.bluetoothManager.sendMessage(peer.address, Protocol.fileAck({
            fileId: payload.fileId,
            version: payload.version,
            accepted: true,
          }));
        }
        break;
      }

      case MessageType.FILE_ACK: {
        const payload = message.payload as FileAckPayload;
        if (payload.accepted) {
          this.db.markLedgerSynced(payload.fileId, payload.version);
        }
        if (payload.conflict) {
          this.sessionConflictsDetected++;
        }
        break;
      }

      case MessageType.TOMBSTONE: {
        const payload = message.payload as TombstonePayload;
        // Удаляем локальный файл
        await this.applyRemoteTombstone(payload);
        await this.bluetoothManager.sendMessage(peer.address, Protocol.tombstoneAck(payload.fileId));
        break;
      }

      case MessageType.TOMBSTONE_ACK: {
        const fileId = message.payload.fileId;
        this.db.markTombstoneSynced(fileId);
        break;
      }

      case MessageType.SYNC_COMPLETE: {
        const payload = message.payload as SyncCompletePayload;
        this.setState('complete');
        this.emitSyncEvent('sync_complete', payload);
        break;
      }

      case MessageType.DISCONNECT: {
        await this.bluetoothManager.disconnect(peer.address);
        break;
      }

      case MessageType.ERROR: {
        this.emitSyncEvent('error', message.payload);
        break;
      }

      case MessageType.PING: {
        // Keepalive — ничего не делаем
        break;
      }
    }
  }

  /**
   * Вычисляет diff между локальным состоянием и удалённым манифестом.
   */
  private computeDiff(remoteManifest: ManifestPayload): ManifestDiffPayload {
    const neededFiles: string[] = [];
    const neededTombstones: string[] = [];

    // Создаём карту локальных файлов
    const localFiles = new Map<string, { fileId: string; version: number; checksum: string; modifiedAt: number }>();
    for (const entry of this.db.getAllLatestLedgerEntries()) {
      if (entry.operation !== 'delete') {
        localFiles.set(entry.fileId, {
          fileId: entry.fileId,
          version: entry.version,
          checksum: entry.checksum,
          modifiedAt: entry.modifiedAt,
        });
      }
    }

    // Создаём карту локальных tombstones
    const localTombstones = new Set(
      this.db.getAllTombstones().map(t => t.fileId)
    );

    // Создаём карту удалённых файлов
    const remoteFiles = new Map<string, FileManifestEntry>(remoteManifest.files.map(f => [f.fileId, f]));
    const remoteTombstones = new Set<string>(remoteManifest.tombstones.map(t => t.fileId));

    // 1. Файлы, которые есть у пира, но нет у нас (или старые версии)
    for (const [fileId, remoteFile] of remoteFiles) {
      const localFile = localFiles.get(fileId);

      if (!localFile) {
        // Файла нет локально — запрашиваем
        neededFiles.push(fileId);
      } else if (remoteFile.version > localFile.version) {
        // У пира новее — запрашиваем
        // Проверяем на конфликт
        const conflictCheck = this.conflictResolver.checkForConflict(localFile, remoteFile);
        if (conflictCheck.hasConflict) {
          this.sessionConflictsDetected++;
        }
        neededFiles.push(fileId);
      } else if (remoteFile.version === localFile.version && remoteFile.checksum !== localFile.checksum) {
        // Версии совпадают, но контрольные суммы разные — конфликт
        // Запрашиваем файл для разрешения
        const conflictCheck = this.conflictResolver.checkForConflict(localFile, remoteFile);
        if (conflictCheck.hasConflict) {
          this.sessionConflictsDetected++;
        }
        neededFiles.push(fileId);
      } else if (localFile.version > remoteFile.version) {
        // Локальная версия новее — пиру нужен наш файл
        // Не добавляем в neededFiles, потому что мы ему отправим его в ответ на его MANIFEST_DIFF
      }
    }

    // 2. Файлы, которые есть у нас, но нет у пира (отправим их в MANIFEST_DIFF)
    // Это обрабатывается в ответ на MANIFEST_DIFF

    // 3. Tombstones, которые есть у пира, но нет у нас
    for (const fileId of remoteTombstones) {
      if (!localTombstones.has(fileId) && localFiles.has(fileId)) {
        // Пир удалил файл, который у нас есть — применяем удаление
        neededTombstones.push(fileId);
      }
    }

    // 4. Tombstones, которые есть у нас, но нет у пира
    // Это будет отправлено в MANIFEST, и пир запросит их через MANIFEST_DIFF

    return { neededFiles, neededTombstones };
  }

  /**
   * Читает файл с диска для отправки пиру.
   */
  private async readFileForSync(fileId: string): Promise<FilePayload | null> {
    try {
      const entry = this.db.getLatestLedgerEntry(fileId);
      if (!entry) return null;

      const fullPath = path.join(this.config.dataDir, entry.filePath);
      if (!fs.existsSync(fullPath)) return null;

      const content = fs.readFileSync(fullPath, 'utf-8');

      // Читаем metadata, если есть
      const parsedPath = path.parse(fullPath);
      const metadataPath = path.join(parsedPath.dir, `${parsedPath.name}.json`);
      let metadata = '{}';
      if (fs.existsSync(metadataPath)) {
        metadata = fs.readFileSync(metadataPath, 'utf-8');
      }

      return {
        fileId: entry.fileId,
        version: entry.version,
        path: entry.filePath,
        content: Buffer.from(content).toString('base64'),
        metadata,
        checksum: entry.checksum,
        modifiedAt: entry.modifiedAt,
      };
    } catch (error) {
      console.error(`[SyncEngine] Failed to read file ${fileId}:`, error);
      return null;
    }
  }

  /**
   * Сохраняет полученный от пира файл.
   */
  private async saveReceivedFile(payload: FilePayload): Promise<boolean> {
    try {
      const fullPath = path.join(this.config.dataDir, payload.path);

      // Создаём директорию
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Декодируем и сохраняем содержимое
      const content = Buffer.from(payload.content, 'base64').toString('utf-8');
      fs.writeFileSync(fullPath, content, 'utf-8');

      // Проверяем контрольную сумму
      const checksum = createHash('sha256').update(content, 'utf-8').digest('hex');
      if (checksum !== payload.checksum) {
        console.warn(`[SyncEngine] Checksum mismatch for ${payload.path}`);
        // TODO: retry logic
      }

      // Сохраняем metadata
      if (payload.metadata && payload.metadata !== '{}') {
        const parsedPath = path.parse(fullPath);
        const metadataPath = path.join(parsedPath.dir, `${parsedPath.name}.json`);
        fs.writeFileSync(metadataPath, payload.metadata, 'utf-8');
      }

      // Обновляем ledger
      this.db.addLedgerEntry({
        fileId: payload.fileId,
        filePath: payload.path,
        version: payload.version,
        checksum: payload.checksum,
        sizeBytes: content.length,
        modifiedAt: payload.modifiedAt,
        modifiedBy: this.activePeerId,
        operation: 'update',
        parentVersion: payload.version - 1,
      });

      this.db.markLedgerSynced(payload.fileId, payload.version);

      this.emitSyncEvent('file_synced', {
        fileId: payload.fileId,
        path: payload.path,
        version: payload.version,
      });

      return true;
    } catch (error) {
      console.error(`[SyncEngine] Failed to save file ${payload.fileId}:`, error);
      return false;
    }
  }

  /**
   * Применяет удаление файла, полученное от пира.
   */
  private async applyRemoteTombstone(payload: TombstonePayload): Promise<void> {
    const fullPath = path.join(this.config.dataDir, payload.originalPath);

    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      console.log(`[SyncEngine] Deleted local file: ${payload.originalPath}`);

      // Удаляем metadata
      const parsedPath = path.parse(fullPath);
      const metadataPath = path.join(parsedPath.dir, `${parsedPath.name}.json`);
      if (fs.existsSync(metadataPath)) {
        fs.unlinkSync(metadataPath);
      }
    }

    // Добавляем tombstone локально, если его нет
    const existing = this.db.getTombstone(payload.fileId);
    if (!existing) {
      this.db.addTombstone(payload.fileId, payload.originalPath, payload.checksum);
    }

    this.emitSyncEvent('file_deleted_remotely', {
      fileId: payload.fileId,
      path: payload.originalPath,
    });
  }

  /**
   * Устанавливает прогресс синхронизации.
   */
  private setProgress(progress: SyncProgress | null): void {
    this.progress = progress;
  }
}
