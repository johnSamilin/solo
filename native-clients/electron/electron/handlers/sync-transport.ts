/**
 * sync-transport — IPC-обработчики для Bluetooth-синхронизации.
 *
 * Регистрирует ipcMain.handle для каждого метода SyncBridgeAPI.
 * Управляет жизненным циклом SyncEngine.
 */

import { ipcMain, BrowserWindow } from 'electron';
import { SyncEngine } from '../sync/SyncEngine';
import { SyncStatus, PeerDevice, SyncConflict } from '../sync/types';

let syncEngine: SyncEngine | null = null;

/**
 * Инициализирует SyncEngine и регистрирует IPC-обработчики.
 * Должен быть вызван после выбора dataFolder.
 */
export function initSyncHandlers(dataDir: string, dbDir: string): void {
  if (syncEngine) {
    console.warn('[SyncHandlers] SyncEngine already initialized');
    return;
  }

  const { machineIdSync } = require('node-machine-id');
  const os = require('os');

  const deviceId = `solo:${machineIdSync()}`;
  const deviceName = os.hostname();

  syncEngine = new SyncEngine({
    deviceId,
    deviceName,
    platform: process.platform === 'darwin' ? 'mac' : 'linux',
    dataDir,
    dbDir,
    appVersion: '3.5.0',
    protocolVersion: 1,
  });

  // Инициализируем движок (boot scan, file watcher, bluetooth)
  syncEngine.initialize().then(ready => {
    if (ready) {
      console.log('[SyncHandlers] SyncEngine initialized successfully');
    } else {
      console.error('[SyncHandlers] SyncEngine initialization failed');
    }
  });

  // Передаём события синхронизации в renderer process
  syncEngine.onSyncEvent((event) => {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('sync-event', event);
      }
    }
  });

  registerHandlers();
}

/**
 * Регистрирует IPC-обработчики.
 */
function registerHandlers(): void {
  if (!syncEngine) return;

  // ==================== Управление синхронизацией ====================

  ipcMain.handle('sync-start', async () => {
    try {
      const success = await syncEngine!.startSync();
      return { success };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('sync-stop', async () => {
    try {
      const success = await syncEngine!.stopSync();
      return { success };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('sync-get-status', async (): Promise<{ success: boolean; status?: SyncStatus }> => {
    try {
      const status = syncEngine!.getStatus();
      return { success: true, status };
    } catch (error) {
      return { success: false };
    }
  });

  // ==================== Пиры ====================

  ipcMain.handle('sync-discover-peers', async (): Promise<{ success: boolean; peers?: PeerDevice[]; error?: string }> => {
    try {
      const peers = await syncEngine!.discoverPeers();
      return { success: true, peers };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('sync-pair-device', async (_, deviceId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const success = await syncEngine!.pairDevice(deviceId);
      return { success };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('sync-unpair-device', async (_, deviceId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const success = await syncEngine!.unpairDevice(deviceId);
      return { success };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('sync-get-peers', async (): Promise<{ success: boolean; peers?: PeerDevice[]; error?: string }> => {
    try {
      const peers = syncEngine!.getPeers();
      return { success: true, peers };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // ==================== Конфликты ====================

  ipcMain.handle('sync-get-conflicts', async (): Promise<{ success: boolean; conflicts?: SyncConflict[]; error?: string }> => {
    try {
      const conflicts = syncEngine!.getConflicts();
      return { success: true, conflicts };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('sync-resolve-conflict', async (_, conflictId: number, strategy: 'local_wins' | 'remote_wins'): Promise<{ success: boolean; error?: string }> => {
    try {
      syncEngine!.resolveConflict(conflictId, strategy);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });
}

/**
 * Останавливает SyncEngine и удаляет IPC-обработчики.
 */
export function destroySyncHandlers(): void {
  if (syncEngine) {
    syncEngine.destroy();
    syncEngine = null;
  }

  // Удаляем все зарегистрированные обработчики
  const handlers = [
    'sync-start',
    'sync-stop',
    'sync-get-status',
    'sync-discover-peers',
    'sync-pair-device',
    'sync-unpair-device',
    'sync-get-peers',
    'sync-get-conflicts',
    'sync-resolve-conflict',
  ];

  for (const handler of handlers) {
    ipcMain.removeHandler(handler);
  }

  console.log('[SyncHandlers] Destroyed');
}
