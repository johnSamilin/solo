import { ipcMain, dialog } from 'electron';
import { mainWindow, dataFolder, setDataFolder, saveSettings } from '../utils';

export function registerDialogHandlers(): void {
  ipcMain.handle('select-folder', async () => {
    if (!mainWindow) return { success: false, error: 'No window available' };

    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Data Folder',
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, error: 'Folder selection cancelled' };
    }

    setDataFolder(result.filePaths[0]);
    await saveSettings();
    return { success: true, path: dataFolder };
  });

  ipcMain.handle('get-data-folder', async () => {
    return { success: true, path: dataFolder };
  });

  ipcMain.handle('select-file', async (_, filters?: { name: string; extensions: string[] }[]) => {
    if (!mainWindow) return { success: false, error: 'No window available' };

    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: filters || [],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, error: 'File selection cancelled' };
    }

    return { success: true, path: result.filePaths[0] };
  });

  ipcMain.handle('select-parent-folder', async () => {
    if (!mainWindow) return { success: false, error: 'No window available' };
    if (!dataFolder) return { success: false, error: 'No data folder selected' };

    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Select Parent Folder',
      defaultPath: dataFolder,
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, error: 'Folder selection cancelled' };
    }

    const selectedPath = result.filePaths[0];

    if (!selectedPath.startsWith(dataFolder)) {
      return { success: false, error: 'Selected folder must be within data folder' };
    }

    const path = await import('path');
    const relativePath = path.relative(dataFolder, selectedPath);
    return { success: true, path: relativePath || '.' };
  });
}
