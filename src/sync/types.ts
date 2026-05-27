// ============================================================
// Базовые типы для P2P-синхронизации Solo
// ============================================================

/** Типы сообщений протокола синхронизации */
export enum MessageType {
  HELLO = 'hello',
  VERSION_MAP_REQUEST = 'version_map_request',
  VERSION_MAP_RESPONSE = 'version_map_response',
  FILE_REQUEST = 'file_request',
  FILE_RESPONSE = 'file_response',
  FILE_ACK = 'file_ack',
  CONFLICT = 'conflict',
  CONFLICT_RESOLUTION = 'conflict_resolution',
  BYE = 'bye',
  PING = 'ping',
  PONG = 'pong',
}

/** Типы файлов, участвующих в синхронизации */
export type SyncFileType = 'html' | 'json' | 'css';

/** Доступные транспорты */
export type TransportType = 'wifi' | 'bluetooth';

/** Режим транспорта — какие транспорты включены */
export type TransportMode = 'wifi' | 'bluetooth' | 'both';

/** Статус синхронизации */
export type SyncStatus = 'idle' | 'scanning' | 'discovering' | 'syncing' | 'error';

/** Статус соединения с пиром */
export type PeerConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'syncing';

/** Разрешение конфликта */
export type ConflictResolution = 'keep_local' | 'keep_remote' | 'merge';

// ============================================================
// Сообщения протокола
// ============================================================

export interface SyncMessage {
  type: MessageType;
  senderId: string;
  targetId?: string;
  sequenceId: string;
  timestamp: number;
  payload: unknown;
}

export interface HelloPayload {
  deviceId: string;
  deviceName: string;
  protocolVersion: string;
  versionMap: VersionMap;
  capabilities: {
    bluetooth: boolean;
    tls: boolean;
    conflictMerge: boolean;
  };
}

export interface VersionInfo {
  fileId: string;
  noteId: string;
  deviceId: string;
  version: number;
  contentHash: string;
  mtime: number;
  deleted: boolean;
}

export interface VersionMap {
  entries: Record<string, VersionInfo>;
  deviceId: string;
  timestamp: number;
}

export interface FileRequestPayload {
  fileIds: string[];
}

export interface FileResponsePayload {
  fileId: string;
  content: string;
  hash: string;
  version: number;
}

export interface FileAckPayload {
  fileId: string;
  success: boolean;
  error?: string;
}

export interface ConflictPayload {
  fileId: string;
  noteId: string;
  localVersion: number;
  remoteVersion: number;
  localContentHash: string;
  remoteContentHash: string;
  localContent?: string;
  remoteContent?: string;
}

export interface ConflictResolutionPayload {
  fileId: string;
  resolution: ConflictResolution;
}

export interface ByePayload {
  reason: string;
}

export interface PeerInfo {
  deviceId: string;
  deviceName: string;
  protocolVersion: string;
  address: string;
  port: number;
  transport: TransportType;
  capabilities: {
    bluetooth: boolean;
    tls: boolean;
    conflictMerge: boolean;
  };
  lastSeen: number;
  status: PeerConnectionStatus;
  versionMap?: VersionMap;
}

// ============================================================
// Состояние синхронизации (Sync State DB сущности)
// ============================================================

export interface SyncFileRecord {
  fileId: string;
  noteId: string;
  deviceId: string;
  version: number;
  contentHash: string;
  mtime: number;
  deleted: boolean;
  fileType: SyncFileType;
}

export interface SyncPeerRecord {
  deviceId: string;
  deviceName: string;
  lastSeen: number;
  lastVersionMap: string; // JSON string of VersionMap
  address: string;
  transport: TransportType;
}

export interface SyncOperationRecord {
  opId: string;
  noteId: string;
  fileId: string;
  opType: 'create' | 'update' | 'delete' | 'rename' | 'startup_scan';
  oldPath?: string;
  newPath?: string;
  timestamp: number;
  deviceId: string;
  applied: boolean;
}

export interface SyncConflictRecord {
  conflictId: string;
  fileId: string;
  noteId: string;
  localVersion: number;
  remoteVersion: number;
  localContentHash: string;
  remoteContentHash: string;
  resolved: boolean;
  resolution?: ConflictResolution;
  createdAt: number;
}

// ============================================================
// Конфигурация транспорта
// ============================================================

export interface TransportConfig {
  wifi: boolean;
  bluetooth: boolean;
}

export const DEFAULT_TRANSPORT_CONFIG: TransportConfig = {
  wifi: true,
  bluetooth: true,
};

export const DEFAULT_SYNC_PORT = 54879;
export const MDNS_SERVICE_TYPE = '_solo-p2p._tcp.local';
export const PROTOCOL_VERSION = '1.0.0';
