"use strict";
/** Типы для системы P2P Bluetooth-синхронизации Solo */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageType = void 0;
// ========== Протокол ==========
var MessageType;
(function (MessageType) {
    MessageType[MessageType["HANDSHAKE"] = 1] = "HANDSHAKE";
    MessageType[MessageType["HANDSHAKE_ACK"] = 2] = "HANDSHAKE_ACK";
    MessageType[MessageType["MANIFEST"] = 3] = "MANIFEST";
    MessageType[MessageType["MANIFEST_DIFF"] = 4] = "MANIFEST_DIFF";
    MessageType[MessageType["FILE"] = 5] = "FILE";
    MessageType[MessageType["FILE_ACK"] = 6] = "FILE_ACK";
    MessageType[MessageType["TOMBSTONE"] = 7] = "TOMBSTONE";
    MessageType[MessageType["TOMBSTONE_ACK"] = 8] = "TOMBSTONE_ACK";
    MessageType[MessageType["SYNC_COMPLETE"] = 9] = "SYNC_COMPLETE";
    MessageType[MessageType["DISCONNECT"] = 10] = "DISCONNECT";
    MessageType[MessageType["CONFLICT_RESOLUTION"] = 11] = "CONFLICT_RESOLUTION";
    MessageType[MessageType["PING"] = 254] = "PING";
    MessageType[MessageType["ERROR"] = 255] = "ERROR";
})(MessageType || (exports.MessageType = MessageType = {}));
