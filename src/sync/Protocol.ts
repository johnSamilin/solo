/**
 * Protocol — кодирование/декодирование бинарных сообщений для P2P Bluetooth-синхронизации.
 *
 * Формат сообщения:
 * ┌──────────────────────────────────────────┐
 * │ Byte 0: Message Type (1 byte)            │
 * │ Byte 1-4: Payload Length (4 bytes, BE)   │
 * │ Byte 5+: Payload (JSON, UTF-8)           │
 * └──────────────────────────────────────────┘
 */

import {
  MessageType,
  SyncMessage,
  HandshakePayload,
  HandshakeAckPayload,
  ManifestPayload,
  ManifestDiffPayload,
  FilePayload,
  FileAckPayload,
  TombstonePayload,
  SyncCompletePayload,
  DisconnectPayload,
  ConflictResolutionPayload,
  ErrorPayload,
} from '../shared/types';

const HEADER_SIZE = 5; // 1 byte type + 4 bytes length

export class Protocol {
  /**
   * Кодирует сообщение в бинарный буфер для отправки по RFCOMM.
   */
  static encode(message: SyncMessage): ArrayBuffer {
    const payloadStr = JSON.stringify(message.payload);
    const payloadBytes = new TextEncoder().encode(payloadStr);
    const buffer = new ArrayBuffer(HEADER_SIZE + payloadBytes.length);
    const view = new DataView(buffer);

    // Byte 0: Message Type
    view.setUint8(0, message.type);

    // Bytes 1-4: Payload Length (big-endian, uint32)
    view.setUint32(1, payloadBytes.length, false);

    // Bytes 5+: Payload
    if (payloadBytes.length > 0) {
      new Uint8Array(buffer, HEADER_SIZE, payloadBytes.length).set(payloadBytes);
    }

    return buffer;
  }

  /**
   * Декодирует бинарный буфер в сообщение.
   * Возвращает null, если данных недостаточно.
   */
  static decode(buffer: ArrayBuffer | ArrayBufferView): SyncMessage | null {
    const bytes = buffer instanceof ArrayBuffer
      ? new Uint8Array(buffer)
      : new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);

    if (bytes.length < HEADER_SIZE) return null;

    const type = bytes[0] as MessageType;
    const payloadLength = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(1, false);

    if (bytes.length < HEADER_SIZE + payloadLength) return null;

    let payload: any = {};
    if (payloadLength > 0) {
      const payloadBytes = bytes.slice(HEADER_SIZE, HEADER_SIZE + payloadLength);
      const payloadStr = new TextDecoder().decode(payloadBytes);
      payload = JSON.parse(payloadStr);
    }

    return { type, payload };
  }

  /**
   * Создаёт HANDSHAKE сообщение.
   */
  static handshake(data: HandshakePayload): SyncMessage {
    return { type: MessageType.HANDSHAKE, payload: data };
  }

  /**
   * Создаёт HANDSHAKE_ACK сообщение.
   */
  static handshakeAck(data: HandshakeAckPayload): SyncMessage {
    return { type: MessageType.HANDSHAKE_ACK, payload: data };
  }

  /**
   * Создаёт MANIFEST сообщение.
   */
  static manifest(data: ManifestPayload): SyncMessage {
    return { type: MessageType.MANIFEST, payload: data };
  }

  /**
   * Создаёт MANIFEST_DIFF сообщение.
   */
  static manifestDiff(data: ManifestDiffPayload): SyncMessage {
    return { type: MessageType.MANIFEST_DIFF, payload: data };
  }

  /**
   * Создаёт FILE сообщение.
   */
  static file(data: FilePayload): SyncMessage {
    return { type: MessageType.FILE, payload: data };
  }

  /**
   * Создаёт FILE_ACK сообщение.
   */
  static fileAck(data: FileAckPayload): SyncMessage {
    return { type: MessageType.FILE_ACK, payload: data };
  }

  /**
   * Создаёт TOMBSTONE сообщение.
   */
  static tombstone(data: TombstonePayload): SyncMessage {
    return { type: MessageType.TOMBSTONE, payload: data };
  }

  /**
   * Создаёт TOMBSTONE_ACK сообщение.
   */
  static tombstoneAck(fileId: string): SyncMessage {
    return { type: MessageType.TOMBSTONE_ACK, payload: { fileId, accepted: true } };
  }

  /**
   * Создаёт SYNC_COMPLETE сообщение.
   */
  static syncComplete(data: SyncCompletePayload): SyncMessage {
    return { type: MessageType.SYNC_COMPLETE, payload: data };
  }

  /**
   * Создаёт DISCONNECT сообщение.
   */
  static disconnect(reason: string): SyncMessage {
    return { type: MessageType.DISCONNECT, payload: { reason } };
  }

  /**
   * Создаёт CONFLICT_RESOLUTION сообщение.
   */
  static conflictResolution(data: ConflictResolutionPayload): SyncMessage {
    return { type: MessageType.CONFLICT_RESOLUTION, payload: data };
  }

  /**
   * Создаёт PING сообщение (keepalive).
   */
  static ping(): SyncMessage {
    return { type: MessageType.PING, payload: {} };
  }

  /**
   * Создаёт ERROR сообщение.
   */
  static error(code: string, message: string): SyncMessage {
    return { type: MessageType.ERROR, payload: { code, message } };
  }
}
