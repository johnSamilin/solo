import { ipcMain } from 'electron';
import { updateManager } from '../autoUpdater';

export function registerUpdateHandlers(): void {
  ipcMain.handle('check-for-updates', async () => {
    try {
      await updateManager.manualCheckForUpdates();
      return { success: true };
    } catch (error) {
      console.error('Failed to check for updates:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('download-update', async () => {
    try {
      updateManager.downloadUpdate();
      return { success: true };
    } catch (error) {
      console.error('Failed to download update:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('install-update', async () => {
    try {
      updateManager.quitAndInstall();
      return { success: true };
    } catch (error) {
      console.error('Failed to install update:', error);
      return { success: false, error: (error as Error).message };
    }
  });
}
