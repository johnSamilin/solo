import { ipcMain } from 'electron';
import { mainWindow } from '../utils';

export function registerZenModeHandlers(): void {
  ipcMain.handle('toggle-zen-mode', async (_, enable: boolean) => {
    try {
      if (!mainWindow) {
        return { success: false, error: 'No window available' };
      }

      mainWindow.setFullScreen(enable);
      return { success: true, isZenMode: enable };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('get-zen-mode', async () => {
    try {
      if (!mainWindow) {
        return { success: false, error: 'No window available' };
      }

      const isZenMode = mainWindow.isFullScreen();
      return { success: true, isZenMode };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });
}
