import { app, BrowserWindow, protocol, net, shell, Menu, MenuItem } from 'electron';
import * as path from 'path';
import { existsSync } from 'fs';
import { logger } from './logger';
import { updateManager } from './autoUpdater';
import {
  mainWindow,
  dataFolder,
  setMainWindow,
  loadSettings,
} from './utils';
import { registerDialogHandlers } from './handlers/dialog';
import { registerFileHandlers } from './handlers/file';
import { registerStructureHandlers } from './handlers/structure';
import { registerSearchHandlers } from './handlers/search';
import { registerNotebookHandlers } from './handlers/notebook';
import { registerImageHandlers } from './handlers/image';
import { registerDigikamHandlers } from './handlers/digikam';
import { registerSyncDbHandlers } from './handlers/sync-db';
import { registerZenModeHandlers } from './handlers/zen-mode';
import { registerUpdateHandlers } from './handlers/updates';
import { registerLogHandlers } from './handlers/logs';

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'image',
    privileges: {
      secure: true,
      supportFetchAPI: true,
      bypassCSP: false,
      corsEnabled: false,
      standard: true,
    }
  },
  {
    scheme: 'audio',
    privileges: {
      secure: true,
      supportFetchAPI: true,
      bypassCSP: false,
      corsEnabled: false,
      standard: true,
    }
  }
]);

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(process.resourcesPath, 'dist/assets/assets/icons/png', '64x64.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
  });

  setMainWindow(win);

  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    const indexPath = path.join(process.resourcesPath, 'dist', 'index.html');
    console.log('Loading index.html from:', indexPath);
    console.log('Resources path:', process.resourcesPath);
    win.loadFile(indexPath);
  }

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  updateManager.setMainWindow(win);

  createMenu();
};

const createMenu = () => {
  const currentMenu = Menu.getApplicationMenu();
  const menuTemplate = currentMenu ? currentMenu.items.filter(item => {
    if (!['windowmenu', 'viewmenu'].includes(item.role ?? '')) {
      return item;
    }
  }) : [];
  const helpMenu = menuTemplate.find(item => item.role === 'help');
  helpMenu?.submenu?.append(new MenuItem({
    label: 'Check for Updates...',
    click: async () => {
      try {
        await updateManager.manualCheckForUpdates();
      } catch (error) {
        console.error('Failed to check for updates:', error);
      }
    },
  }));
  helpMenu?.submenu?.append(new MenuItem({
    label: 'Open Logs',
    click: async () => {
      try {
        const logFile = logger.getLogFile();
        await shell.openPath(logFile);
      } catch (error) {
        console.error('Failed to open logs:', error);
      }
    },
  }));
  helpMenu?.submenu?.append(new MenuItem({
    label: 'Open DevTools',
    click: () => {
      mainWindow?.webContents.openDevTools();
    },
  }));

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
};

async function getFile(filePath: string) {
  const result = {
    success: false,
    response: new Response(),
  };

  if (!dataFolder) {
    result.response = new Response('No data folder', { status: 404 });
    return result;
  }

  const assetsPath = path.join(dataFolder, 'assets', filePath);

  if (!assetsPath.startsWith(path.join(dataFolder, 'assets'))) {
    result.response = new Response('Forbidden', { status: 403 });
    return result;
  }

  if (!existsSync(assetsPath)) {
    result.response = new Response('Not found', { status: 404 });
    return result;
  }

  result.success = true;
  result.response = await net.fetch('file://' + assetsPath);

  return result;
}

// ============================================================
// Register all IPC handlers
// ============================================================
registerDialogHandlers();
registerFileHandlers();
registerStructureHandlers();
registerSearchHandlers();
registerNotebookHandlers();
registerImageHandlers();
registerDigikamHandlers();
registerSyncDbHandlers();
registerZenModeHandlers();
registerUpdateHandlers();
registerLogHandlers();

// ============================================================
// App lifecycle
// ============================================================

app.whenReady().then(async () => {
  await logger.init();

  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalInfo = console.info;

  console.log = (...args: any[]) => {
    originalLog(...args);
    logger.log(...args);
  };

  console.error = (...args: any[]) => {
    originalError(...args);
    logger.error(...args);
  };

  console.warn = (...args: any[]) => {
    originalWarn(...args);
    logger.warn(...args);
  };

  console.info = (...args: any[]) => {
    originalInfo(...args);
    logger.info(...args);
  };

  await loadSettings();

  protocol.handle('image', async (request) => {
    const url = new URL(request.url);
    const hostnameFile = await getFile(url.hostname);
    if (hostnameFile.success) {
      return hostnameFile.response;
    } else {
      const pathnameFile = await getFile(url.pathname);
      if (pathnameFile.success) {
        return pathnameFile.response;
      }
    }

    return Promise.reject();
  });

  protocol.handle('audio', (request) => {
    const url = new URL(request.url);
    const filePath = url.hostname;

    let audioPath: string;
    let basePath: string;

    if (process.env.NODE_ENV === 'development') {
      basePath = path.join(__dirname, '../../../public');
      audioPath = path.join(basePath, filePath);
    } else {
      basePath = path.join(process.resourcesPath, 'dist');
      audioPath = path.join(basePath, filePath);
    }

    if (!audioPath.startsWith(basePath)) {
      return new Response('Forbidden', { status: 403 });
    }

    if (!existsSync(audioPath)) {
      return new Response('Not found', { status: 404 });
    }

    return net.fetch('file://' + audioPath);
  });

  createWindow();

  if (process.env.NODE_ENV !== 'development') {
    updateManager.startPeriodicChecks();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
