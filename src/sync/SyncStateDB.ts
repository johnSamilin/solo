// ============================================================
// SyncStateDB — локальное хранилище состояния синхронизации
// на основе SQLite через нативный мост (Electron IPC / Android bridge)
// ============================================================

import {
  SyncFileRecord,
  SyncPeerRecord,
  SyncOperationRecord,
  SyncConflictRecord,
  VersionInfo,
  VersionMap,
} from './types';
import { getNativeAPI } from '../utils/nativeBridge';

export class SyncStateDB {
  private initialized = false;

  async initialize(): Promise<void> {
    // Инициализация происходит на стороне нативного кода (main.ts / Android)
    // Проверяем доступность API
    const api = getNativeAPI();
    if (!api) {
      console.warn('[SyncStateDB] Native API not available, sync DB disabled');
    }
    this.initialized = true;
  }

  private async invoke<T>(operation: string, ...params: any[]): Promise<T> {
    const api = getNativeAPI();
    if (!api) {
      throw new Error('Native API not available for sync DB operations');
    }
    const result = await api.syncDBInvoke(operation, ...params);
    if (!result.success) {
      throw new Error(result.error || `Sync DB operation "${operation}" failed`);
    }
    return result.data as T;
  }

  // ============================================================
  // Sync Files
  // ============================================================

  async getFile(fileId: string): Promise<SyncFileRecord | null> {
    return this.invoke<SyncFileRecord | null>('getFile', fileId);
  }

  async getAllFiles(): Promise<SyncFileRecord[]> {
    return this.invoke<SyncFileRecord[]>('getAllFiles');
  }

  async putFile(record: SyncFileRecord): Promise<void> {
    await this.invoke('putFile', record);
  }

  async deleteFile(fileId: string): Promise<void> {
    await this.invoke('deleteFile', fileId);
  }

  async getFilesByNoteId(noteId: string): Promise<SyncFileRecord[]> {
    return this.invoke<SyncFileRecord[]>('getFilesByNoteId', noteId);
  }

  // ============================================================
  // Version Map
  // ============================================================

  async buildVersionMap(deviceId: string): Promise<VersionMap> {
    return this.invoke<VersionMap>('buildVersionMap', deviceId);
  }

  // ============================================================
  // Sync Peers
  // ============================================================

  async getPeer(deviceId: string): Promise<SyncPeerRecord | null> {
    return this.invoke<SyncPeerRecord | null>('getPeer', deviceId);
  }

  async getAllPeers(): Promise<SyncPeerRecord[]> {
    return this.invoke<SyncPeerRecord[]>('getAllPeers');
  }

  async putPeer(record: SyncPeerRecord): Promise<void> {
    await this.invoke('putPeer', record);
  }

  async deletePeer(deviceId: string): Promise<void> {
    await this.invoke('deletePeer', deviceId);
  }

  // ============================================================
  // Sync Operations
  // ============================================================

  async getOperation(opId: string): Promise<SyncOperationRecord | null> {
    return this.invoke<SyncOperationRecord | null>('getOperation', opId);
  }

  async getAllOperations(): Promise<SyncOperationRecord[]> {
    return this.invoke<SyncOperationRecord[]>('getAllOperations');
  }

  async putOperation(record: SyncOperationRecord): Promise<void> {
    await this.invoke('putOperation', record);
  }

  async getUnappliedOperations(): Promise<SyncOperationRecord[]> {
    return this.invoke<SyncOperationRecord[]>('getUnappliedOperations');
  }

  async markOperationApplied(opId: string): Promise<void> {
    await this.invoke('markOperationApplied', opId);
  }

  // ============================================================
  // Sync Conflicts
  // ============================================================

  async getConflict(conflictId: string): Promise<SyncConflictRecord | null> {
    return this.invoke<SyncConflictRecord | null>('getConflict', conflictId);
  }

  async getAllConflicts(): Promise<SyncConflictRecord[]> {
    return this.invoke<SyncConflictRecord[]>('getAllConflicts');
  }

  async getUnresolvedConflicts(): Promise<SyncConflictRecord[]> {
    return this.invoke<SyncConflictRecord[]>('getUnresolvedConflicts');
  }

  async putConflict(record: SyncConflictRecord): Promise<void> {
    await this.invoke('putConflict', record);
  }

  async resolveConflict(conflictId: string, resolution: 'keep_local' | 'keep_remote' | 'merge'): Promise<void> {
    await this.invoke('resolveConflict', conflictId, resolution);
  }

  // ============================================================
  // Cleanup
  // ============================================================

  async clearAll(): Promise<void> {
    await this.invoke('clearAll');
  }
}

// Singleton
export const syncStateDB = new SyncStateDB();
