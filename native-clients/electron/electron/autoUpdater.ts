import { autoUpdater } from 'electron-updater';
import { BrowserWindow, dialog } from 'electron';
import { logger } from './logger';

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export class AutoUpdateManager {
  private mainWindow: BrowserWindow | null = null;
  private updateCheckInterval: NodeJS.Timeout | null = null;
  private lastCheckTime: number = 0;

  constructor() {
    autoUpdater.logger = logger as any;
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.allowDowngrade = false;

    autoUpdater.on('checking-for-update', () => {
      logger.info('Checking for updates...');
      this.sendStatusToWindow('checking-for-update');
    });

    autoUpdater.on('update-available', (info) => {
      logger.info('Update available:', info);
      this.sendStatusToWindow('update-available', info);
      this.showUpdateAvailableDialog(info);
    });

    autoUpdater.on('update-not-available', (info) => {
      logger.info('Update not available:', info);
      this.sendStatusToWindow('update-not-available', info);
    });

    autoUpdater.on('error', (err) => {
      logger.error('Error in auto-updater:', err);
      this.sendStatusToWindow('update-error', { message: err.message });
    });

    autoUpdater.on('download-progress', (progressObj) => {
      const message = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}% (${progressObj.transferred}/${progressObj.total})`;
      logger.info(message);
      this.sendStatusToWindow('download-progress', progressObj);
    });

    autoUpdater.on('update-downloaded', (info) => {
      logger.info('Update downloaded:', info);
      this.sendStatusToWindow('update-downloaded', info);
      this.showUpdateDownloadedDialog(info);
    });
  }

  setMainWindow(window: BrowserWindow) {
    this.mainWindow = window;
  }

  private sendStatusToWindow(status: string, data?: any) {
    if (this.mainWindow) {
      this.mainWindow.webContents.send('update-status', { status, data });
    }
  }

  private showUpdateAvailableDialog(info: any) {
    if (!this.mainWindow) return;

    dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: 'Update Available',
      message: `A new version (${info.version}) is available!`,
      detail: `Current version: ${autoUpdater.currentVersion}\nNew version: ${info.version}\n\nWould you like to download it now?`,
      buttons: ['Download', 'Later'],
      defaultId: 0,
      cancelId: 1,
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.downloadUpdate();
        this.sendStatusToWindow('downloading-update');
      }
    });
  }

  private showUpdateDownloadedDialog(info: any) {
    if (!this.mainWindow) return;

    dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: 'Update Ready',
      message: 'Update downloaded successfully!',
      detail: `Version ${info.version} has been downloaded and will be installed on restart.\n\nWould you like to restart now?`,
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
      cancelId: 1,
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall(false, true);
      }
    });
  }

  async checkForUpdates(force = false) {
    const now = Date.now();

    if (!force && (now - this.lastCheckTime) < ONE_WEEK_MS) {
      logger.info('Skipping update check - last check was less than a week ago');
      return;
    }

    this.lastCheckTime = now;

    try {
      await autoUpdater.checkForUpdates();
    } catch (error) {
      logger.error('Failed to check for updates:', error);
    }
  }

  startPeriodicChecks() {
    this.checkForUpdates(false);

    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
    }

    this.updateCheckInterval = setInterval(() => {
      this.checkForUpdates(false);
    }, ONE_WEEK_MS);
  }

  stopPeriodicChecks() {
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
      this.updateCheckInterval = null;
    }
  }

  async manualCheckForUpdates() {
    await this.checkForUpdates(true);
  }

  downloadUpdate() {
    autoUpdater.downloadUpdate();
  }

  quitAndInstall() {
    autoUpdater.quitAndInstall(false, true);
  }
}

export const updateManager = new AutoUpdateManager();
