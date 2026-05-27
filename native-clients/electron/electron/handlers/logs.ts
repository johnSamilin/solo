import { ipcMain, shell } from 'electron';
import { logger } from '../logger';

const openLogFile = async () => {
  try {
    const logFile = logger.getLogFile();
    await shell.openPath(logFile);
    return { success: true };
  } catch (error) {
    console.error('Failed to open log file:', error);
    return { success: false, error: (error as Error).message };
  }
};

export function registerLogHandlers(): void {
  ipcMain.handle('open-log-file', openLogFile);
}
