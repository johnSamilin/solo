/**
 * Protocol — кодирование/декодирование бинарных сообщений (Electron main process).
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
} from './types';

const HEADER_SIZE = 5;

export class Protocol {
  static encode(message: SyncMessage): Buffer {
    const payloadStr = JSON.stringify(message.payload);
    const payloadBytes = Buffer.from(payloadStr, 'utf-8');

    const header = Buffer.alloc(HEADER_SIZE);
    header.writeUInt8(message.type, 0);
    header.writeUInt32BE(payloadBytes.length, 1);

    return Buffer.concat([header, payloadBytes]);
  }

  static decode(buffer: Buffer): SyncMessage | null {
    if (buffer.length < HEADER_SIZE) return null;

    const type = buffer.readUInt8(0) as MessageType;
    const payloadLength = buffer.readUInt32BE(1);

    if (buffer.length < HEADER_SIZE + payloadLength) return null;

    let payload: any = {};
    if (payloadLength > 0) {
      const payloadStr = buffer.toString('utf-8', HEADER_SIZE, HEADER_SIZE + payloadLength);
      payload = JSON.parse(payloadStr);
    }

    return { type, payload };
  }

  static handshake(data: HandshakePayload): SyncMessage {
    return { type: MessageType.HANDSHAKE, payload: data };
  }

  static handshakeAck(data: HandshakeAckPayload): SyncMessage {
    return { type: MessageType.HANDSHAKE_ACK, payload: data };
  }

  static manifest(data: ManifestPayload): SyncMessage {
    return { type: MessageType.MANIFEST, payload: data };
  }

  static manifestDiff(data: ManifestDiffPayload): SyncMessage {
    return { type: MessageType.MANIFEST_DIFF, payload: data };
  }

  static file(data: FilePayload): SyncMessage {
    return { type: MessageType.FILE, payload: data };
  }

  static fileAck(data: FileAckPayload): SyncMessage {
    return { type: MessageType.FILE_ACK, payload: data };
  }

  static tombstone(data: TombstonePayload): SyncMessage {
    return { type: MessageType.TOMBSTONE, payload: data };
  }

  static tombstoneAck(fileId: string): SyncMessage {
    return { type: MessageType.TOMBSTONE_ACK, payload: { fileId, accepted: true } };
  }

  static syncComplete(data: SyncCompletePayload): SyncMessage {
    return { type: MessageType.SYNC_COMPLETE, payload: data };
  }

  static disconnect(reason: string): SyncMessage {
    return { type: MessageType.DISCONNECT, payload: { reason } };
  }

  static conflictResolution(data: ConflictResolutionPayload): SyncMessage {
    return { type: MessageType.CONFLICT_RESOLUTION, payload: data };
  }

  static ping(): SyncMessage {
    return { type: MessageType.PING, payload: {} };
  }

  static error(code: string, message: string): SyncMessage {
    return { type: MessageType.ERROR, payload: { code, message } };
  }
}
