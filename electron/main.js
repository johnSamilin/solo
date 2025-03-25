import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import Store from 'electron-store';
import fs from 'fs';
import sqlite3 from 'sqlite3';
import TurndownService from 'turndown';
import { generateUniqueId } from './utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV === 'development';

// Initialize electron store
const store = new Store();

// Initialize Turndown
const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced'
});

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

ipcMain.handle('import-joplin', async () => {
  try {
    // Get default Joplin database path based on platform
    let defaultPath = '';
    if (process.platform === 'win32') {
      defaultPath = path.join(app.getPath('appData'), 'joplin-desktop');
    } else if (process.platform === 'darwin') {
      defaultPath = path.join(app.getPath('home'), 'Library', 'Application Support', 'joplin-desktop');
    } else {
      defaultPath = path.join(app.getPath('home'), '.config', 'joplin-desktop');
    }

    // Find the database file
    let dbPath = '';
    if (fs.existsSync(defaultPath)) {
      const files = fs.readdirSync(defaultPath);
      const dbFile = files.find(file => file.endsWith('.sqlite'));
      if (dbFile) {
        dbPath = path.join(defaultPath, dbFile);
      }
    }

    const result = await dialog.showOpenDialog({
      defaultPath: dbPath,
      properties: ['openFile'],
      filters: [{ name: 'Joplin Database', extensions: ['sqlite'] }]
    });

    if (result.canceled) {
      return null;
    }

    dbPath = result.filePaths[0];
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          reject(new Error(`Failed to open Joplin database: ${err.message}`));
          return;
        }
      });

      const notebooks = [];
      const notes = [];
      const tags = new Map();
      const noteTags = new Map();

      // First, get all folders (notebooks)
      db.all('SELECT id, parent_id, title FROM folders', [], (err, folders) => {
        if (err) {
          reject(new Error(`Failed to read folders: ${err.message}`));
          return;
        }

        folders.forEach(folder => {
          notebooks.push({
            id: folder.id, // generateUniqueId(),
            name: folder.title,
            parentId: folder.parent_id || null,
            isExpanded: false
          });
        });

        // Get all tags
        db.all('SELECT id, title FROM tags', [], (err, joplinTags) => {
          if (err) {
            reject(new Error(`Failed to read tags: ${err.message}`));
            return;
          }

          joplinTags.forEach(tag => {
            tags.set(tag.id, {
              id: tag.id, //generateUniqueId(),
              path: tag.title
            });
          });

          // Get note-tag relationships
          db.all('SELECT note_id, tag_id FROM note_tags', [], (err, noteTagRelations) => {
            if (err) {
              reject(new Error(`Failed to read note tags: ${err.message}`));
              return;
            }

            noteTagRelations.forEach(relation => {
              const tagIds = noteTags.get(relation.note_id) || [];
              const tag = tags.get(relation.tag_id);
              if (tag) {
                tagIds.push(tag.id);
                noteTags.set(relation.note_id, tagIds);
              }
            });

            // Finally, get all notes
            db.all(
              'SELECT id, parent_id, title, body, created_time, is_todo FROM notes WHERE is_todo = 0',
              [],
              (err, joplinNotes) => {
                if (err) {
                  reject(new Error(`Failed to read notes: ${err.message}`));
                  return;
                }

                joplinNotes.forEach(note => {
                  const notebookId = notebooks.find(nb => nb.id === note.parent_id)?.id || 'default';
                  const noteTagIds = noteTags.get(note.id) || [];
                  const noteTagsCorrected = noteTagIds.map(tagId => {
                    const tag = Array.from(tags.values()).find(t => t.id === tagId);
                    return tag || { id: generateUniqueId(), path: 'imported' };
                  });

                  notes.push({
                    id: note.id, // generateUniqueId(),
                    title: note.title,
                    content: note.body,//turndown.turndown(note.body),
                    createdAt: new Date(note.created_time),
                    notebookId,
                    tags: noteTagsCorrected,
                    isCensored: false
                  });
                });

                db.close();
                resolve({ notes, notebooks });
              }
            );
          });
        });
      });
    });
  } catch (error) {
    console.error('Error importing from Joplin:', error);
    return null;
  }
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