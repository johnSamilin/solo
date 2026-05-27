// ============================================================
// Протокол сообщений синхронизации Solo
// ============================================================

import {
  SyncMessage,
  MessageType,
  HelloPayload,
  VersionMap,
  FileRequestPayload,
  FileResponsePayload,
  FileAckPayload,
  ConflictPayload,
  ConflictResolutionPayload,
  ByePayload,
  PROTOCOL_VERSION,
} from './types';

let _sequenceCounter = 0;

function generateSequenceId(): string {
  _sequenceCounter++;
  return `${Date.now()}-${_sequenceCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Формирует JSON-line сообщение для отправки по транспортному протоколу.
 */
export function encodeMessage(msg: SyncMessage): string {
  return JSON.stringify(msg) + '\n';
}

/**
 * Парсит JSON-line сообщение из строки.
 */
export function decodeMessage(raw: string): SyncMessage | null {
  try {
    const parsed = JSON.parse(raw.trim());
    if (!parsed.type || !parsed.senderId || !parsed.sequenceId) {
      return null;
    }
    return parsed as SyncMessage;
  } catch {
    return null;
  }
}

/**
 * Парсит буфер (возможны множественные сообщения, разделённые \n).
 */
export function decodeMessages(buffer: string): SyncMessage[] {
  const lines = buffer.split('\n').filter(Boolean);
  const messages: SyncMessage[] = [];
  for (const line of lines) {
    const msg = decodeMessage(line);
    if (msg) messages.push(msg);
  }
  return messages;
}

// ============================================================
// Фабрики сообщений
// ============================================================

export function createHelloMessage(
  senderId: string,
  deviceName: string,
  versionMap: VersionMap,
  capabilities: { bluetooth: boolean; tls: boolean; conflictMerge: boolean },
): SyncMessage {
  const payload: HelloPayload = {
    deviceId: senderId,
    deviceName,
    protocolVersion: PROTOCOL_VERSION,
    versionMap,
    capabilities,
  };
  return {
    type: MessageType.HELLO,
    senderId,
    sequenceId: generateSequenceId(),
    timestamp: Date.now(),
    payload,
  };
}

export function createVersionMapRequestMessage(senderId: string): SyncMessage {
  return {
    type: MessageType.VERSION_MAP_REQUEST,
    senderId,
    sequenceId: generateSequenceId(),
    timestamp: Date.now(),
    payload: {},
  };
}

export function createVersionMapResponseMessage(
  senderId: string,
  versionMap: VersionMap,
): SyncMessage {
  return {
    type: MessageType.VERSION_MAP_RESPONSE,
    senderId,
    sequenceId: generateSequenceId(),
    timestamp: Date.now(),
    payload: versionMap,
  };
}

export function createFileRequestMessage(
  senderId: string,
  fileIds: string[],
): SyncMessage {
  const payload: FileRequestPayload = { fileIds };
  return {
    type: MessageType.FILE_REQUEST,
    senderId,
    sequenceId: generateSequenceId(),
    timestamp: Date.now(),
    payload,
  };
}

export function createFileResponseMessage(
  senderId: string,
  fileId: string,
  content: string,
  hash: string,
  version: number,
): SyncMessage {
  const payload: FileResponsePayload = { fileId, content, hash, version };
  return {
    type: MessageType.FILE_RESPONSE,
    senderId,
    sequenceId: generateSequenceId(),
    timestamp: Date.now(),
    payload,
  };
}

export function createFileAckMessage(
  senderId: string,
  fileId: string,
  success: boolean,
  error?: string,
): SyncMessage {
  const payload: FileAckPayload = { fileId, success, error };
  return {
    type: MessageType.FILE_ACK,
    senderId,
    sequenceId: generateSequenceId(),
    timestamp: Date.now(),
    payload,
  };
}

export function createConflictMessage(
  senderId: string,
  conflict: ConflictPayload,
): SyncMessage {
  return {
    type: MessageType.CONFLICT,
    senderId,
    sequenceId: generateSequenceId(),
    timestamp: Date.now(),
    payload: conflict,
  };
}

export function createConflictResolutionMessage(
  senderId: string,
  fileId: string,
  resolution: 'keep_local' | 'keep_remote' | 'merge',
): SyncMessage {
  const payload: ConflictResolutionPayload = { fileId, resolution };
  return {
    type: MessageType.CONFLICT_RESOLUTION,
    senderId,
    sequenceId: generateSequenceId(),
    timestamp: Date.now(),
    payload,
  };
}

export function createByeMessage(
  senderId: string,
  reason: string,
): SyncMessage {
  const payload: ByePayload = { reason };
  return {
    type: MessageType.BYE,
    senderId,
    sequenceId: generateSequenceId(),
    timestamp: Date.now(),
    payload,
  };
}

export function createPingMessage(senderId: string): SyncMessage {
  return {
    type: MessageType.PING,
    senderId,
    sequenceId: generateSequenceId(),
    timestamp: Date.now(),
    payload: {},
  };
}

export function createPongMessage(senderId: string): SyncMessage {
  return {
    type: MessageType.PONG,
    senderId,
    sequenceId: generateSequenceId(),
    timestamp: Date.now(),
    payload: {},
  };
}
