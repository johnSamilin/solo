/** Типы для системы P2P Bluetooth-синхронизации Solo */

// ========== Транспорт ==========

export type PlatformType = 'android' | 'linux' | 'mac' | 'electron';

export interface PeerDevice {
  id: string;               // UUID устройства
  name: string;             // человекочитаемое имя
  deviceType: PlatformType;
  macAddress?: string;      // Bluetooth MAC (опционально, может рандомизироваться)
  lastSeenAt: number;       // unix timestamp ms
  firstSeenAt: number;
  trustStatus: 'pending' | 'trusted' | 'blocked';
  isPaired: boolean;
  protocolVersion: number;
}

export type SyncConnectionState =
  | 'idle'
  | 'discovering'
  | 'connecting'
  | 'handshake'
  | 'syncing'
  | 'resolving_conflicts'
  | 'complete'
  | 'error';

// ========== Протокол ==========

export enum MessageType {
  HANDSHAKE         = 0x01,
  HANDSHAKE_ACK     = 0x02,
  MANIFEST          = 0x03,
  MANIFEST_DIFF     = 0x04,
  FILE              = 0x05,
  FILE_ACK          = 0x06,
  TOMBSTONE         = 0x07,
  TOMBSTONE_ACK     = 0x08,
  SYNC_COMPLETE     = 0x09,
  DISCONNECT        = 0x0A,
  CONFLICT_RESOLUTION = 0x0B,
  PING              = 0xFE,
  ERROR             = 0xFF,
}

export interface HandshakePayload {
  peerId: string;
  deviceName: string;
  platform: PlatformType;
  appVersion: string;
  protocolVersion: number;
}

export interface HandshakeAckPayload {
  peerId: string;
  accepted: boolean;
  rejectReason?: string;
}

export interface FileManifestEntry {
  fileId: string;
  version: number;
  checksum: string;        // SHA-256
  modifiedAt: number;      // unix timestamp ms
  path: string;
  sizeBytes: number;
}

export interface TombstoneManifestEntry {
  fileId: string;
  deletedAt: number;       // unix timestamp ms
  originalPath: string;
  checksum?: string;
}

export interface ManifestPayload {
  files: FileManifestEntry[];
  tombstones: TombstoneManifestEntry[];
}

export interface ManifestDiffPayload {
  neededFiles: string[];
  neededTombstones: string[];
}

export interface FilePayload {
  fileId: string;
  version: number;
  path: string;
  content: string;          // base64-encoded content
  metadata: string;         // JSON string of metadata
  checksum: string;         // SHA-256
  modifiedAt: number;
}

export interface FileAckPayload {
  fileId: string;
  version: number;
  accepted: boolean;
  conflict?: boolean;
}

export interface TombstonePayload {
  fileId: string;
  deletedAt: number;
  originalPath: string;
  checksum?: string;
}

export interface SyncCompletePayload {
  summary: {
    filesTransferred: number;
    tombstonesApplied: number;
    conflictsDetected: number;
    duration: number;       // ms
  };
}

export interface DisconnectPayload {
  reason: string;
}

export interface ConflictResolutionPayload {
  fileId: string;
  strategy: 'local_wins' | 'remote_wins' | 'lww';
  resolvedVersion: number;
}

export interface ErrorPayload {
  code: string;
  message: string;
}

// Обёртка сообщения
export interface SyncMessage {
  type: MessageType;
  payload: any;
}

// ========== Конфликты ==========

export interface SyncConflict {
  conflictId: number;
  fileId: string;
  filePath: string | null;
  localVersion: number;
  remoteVersion: number;
  localChecksum: string | null;
  remoteChecksum: string | null;
  localModifiedAt: number;
  remoteModifiedAt: number;
  resolution: 'pending' | 'auto_resolved' | 'manual';
  resolvedAt: number | null;
  resolvedBy: 'lww' | 'local_wins' | 'remote_wins' | 'manual_merge' | null;
  createdAt: number;
}

// ========== События для UI ==========

export type SyncEventType =
  | 'state_changed'
  | 'peer_discovered'
  | 'peer_connected'
  | 'peer_disconnected'
  | 'sync_progress'
  | 'sync_complete'
  | 'conflict_detected'
  | 'conflict_resolved'
  | 'error'
  | 'file_synced'
  | 'file_deleted_remotely';

export interface SyncEvent {
  type: SyncEventType;
  timestamp: number;
  data?: any;
}

export interface SyncProgress {
  totalFiles: number;
  transferredFiles: number;
  currentFile?: string;
  phase: 'manifest' | 'diff' | 'transfer' | 'conflicts' | 'complete';
}

export interface SyncStatus {
  state: SyncConnectionState;
  lastSyncAt: number | null;
  connectedPeers: PeerDevice[];
  progress: SyncProgress | null;
  error: string | null;
}

// ========== Bridge API (для preload / JSInterface) ==========

export interface SyncBridgeAPI {
  // Управление синхронизацией
  syncStart(): Promise<{ success: boolean }>;
  syncStop(): Promise<{ success: boolean }>;
  syncGetStatus(): Promise<SyncStatus>;

  // Пиры
  syncDiscoverPeers(): Promise<PeerDevice[]>;
  syncPairDevice(deviceId: string): Promise<{ success: boolean }>;
  syncUnpairDevice(deviceId: string): Promise<{ success: boolean }>;
  syncGetPeers(): Promise<PeerDevice[]>;

  // Конфликты
  syncGetConflicts(): Promise<SyncConflict[]>;
  syncResolveConflict(conflictId: number, strategy: 'local_wins' | 'remote_wins'): Promise<{ success: boolean }>;

  // События
  onSyncEvent(callback: (event: SyncEvent) => void): () => void;
}