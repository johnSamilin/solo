import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import Store from 'electron-store';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV === 'development';

// Initialize electron store
const store = new Store();

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.mjs')
    },
    icon: isDev 
      ? path.join(__dirname, '../assets/icons/png/512x512.png')
      : path.join(__dirname, '../assets/icons/png/512x512.png')
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

// Handle IPC messages
ipcMain.handle('loadFromStorage', (event, key) => {
  return store.get(key);
});

ipcMain.handle('saveToStorage', (event, key, data) => {
  store.set(key, data);
  return true;
});

ipcMain.handle('pick-folder', async (event, operation) => {
  const properties = operation === 'export' ? ['openDirectory', 'createDirectory'] : ['openDirectory'];
  const result = await dialog.showOpenDialog({
      properties: properties
  });
  if (result.canceled) {
      return '';
  } else {
      return result.filePaths[0];
  }
});

const mkdirAsync = (path) => {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(path)) {
      fs.mkdir(path, (er) => {
        if (er) {
          return reject(er);
        }
      });
    }
    return resolve();
  });
}

const createFileAsync = (path, name, content) => {
  return new Promise((resolve, reject) => {
    if (!path) {
      return reject('path in empty');
    }

    fs.open(`${path}/${name}`, 'w', (err, fd) => {
      if (err) {
        return reject(err);
      }
      fs.writeFileSync(fd, content);
      fs.close(fd);
      return resolve();
    });
  });
}

ipcMain.handle('export-data', (event, data, exportPath) => {
  const { notes, notebooks } = JSON.parse(data);
  const notesByNotebookId = notes.reduce((agr, note) => {
    if (!Array.isArray(agr[note.notebookId])) {
      agr[note.notebookId] = [];
    }
    agr[note.notebookId].push(note);
    return agr;
  }, {});
  const getNotebooks = (parentId = null) => {
    return notebooks.filter((notebook) => notebook.parentId === parentId);
  }
  const makeDir = (basePath = '') => async (notebook) => {
    const notebookPath = [basePath, notebook.name].join('/');
    await mkdirAsync(notebookPath);
    await Promise.all(
      notesByNotebookId[notebook.id]
        .map(
          (note) => createFileAsync(notebookPath, `${note.title}.json`, JSON.stringify(note, null, 2))
      )
    );
    const childNotebooks = getNotebooks(notebook.id);
    childNotebooks.forEach(makeDir(notebookPath));
  }
  // top-level first
  getNotebooks().forEach(makeDir(exportPath));


});

app.whenReady().then(() => {
  createWindow();

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