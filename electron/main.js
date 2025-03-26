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

// Function to convert Markdown to HTML
const markdownToHtml = (markdown) => {
  // Process task lists first
  let html = markdown.replace(/^(\s*)-\s+\[([ x])\]\s+(.+)$/gm, (match, indent, checked, text) => {
    const isChecked = checked === 'x';
    return `${indent}<ul data-type="taskList"><li><label><input type="checkbox" ${isChecked ? 'checked' : ''}/><div>${text}</div></label></li></ul>`;
  });

  // Process nested lists
  const processLists = (text) => {
    const listRegex = /^(\s*)([-*+]|\d+\.)\s+([^\n]+)(?:\n|$)/gm;
    const lines = text.split('\n');
    const result = [];
    let currentIndent = 0;
    let listStack = [];

    lines.forEach(line => {
      const match = line.match(/^(\s*)([-*+]|\d+\.)\s+([^\n]+)/);
      if (match) {
        const [, indent, marker, content] = match;
        const indentLevel = indent.length;
        const isOrdered = /\d+\./.test(marker);
        const listType = isOrdered ? 'ol' : 'ul';

        if (indentLevel > currentIndent) {
          // Start a new nested list
          listStack.push(listType);
          result.push(`<${listType}><li>${content}`);
        } else if (indentLevel < currentIndent) {
          // Close nested lists
          while (indentLevel < currentIndent && listStack.length > 0) {
            result.push(`</li></${listStack.pop()}>`);
            currentIndent -= 2;
          }
          result.push(`</li><li>${content}`);
        } else {
          // Same level
          if (result.length > 0) {
            result.push(`</li><li>${content}`);
          } else {
            result.push(`<${listType}><li>${content}`);
            listStack.push(listType);
          }
        }
        currentIndent = indentLevel;
      } else {
        // Close all open lists when encountering non-list content
        while (listStack.length > 0) {
          result.push(`</li></${listStack.pop()}>`);
        }
        currentIndent = 0;
        result.push(line);
      }
    });

    // Close any remaining open lists
    while (listStack.length > 0) {
      result.push(`</li></${listStack.pop()}>`);
    }

    return result.join('\n');
  };

  html = processLists(html);

  // Process other Markdown elements
  html = html
    // Headers
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    // Bold and italic
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Code blocks
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // Paragraphs (must be last)
    .replace(/^(?!<[houpl]).+$/gm, '<p>$&</p>');

  // Clean up multiple newlines and list artifacts
  html = html
    .replace(/\n{2,}/g, '\n')
    .replace(/<\/ul>\n<ul>/g, '')
    .replace(/<\/ol>\n<ol>/g, '')
    .replace(/<\/ul>\n<\/ul>/g, '</ul>')
    .replace(/<\/ol>\n<\/ol>/g, '</ol>');

  return html;
};

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
    const resourcesDir = path.join(path.dirname(dbPath), 'resources');

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
      const resources = new Map();

      // First, get all resources
      db.all('SELECT id, mime, filename, title FROM resources', [], (err, joplinResources) => {
        if (err) {
          reject(new Error(`Failed to read resources: ${err.message}`));
          return;
        }

        joplinResources.forEach(resource => {
          const resourcePath = path.join(resourcesDir, `${resource.id}.${resource.mime.split('/')[1]}`);
          if (fs.existsSync(resourcePath)) {
            const data = fs.readFileSync(resourcePath);
            resources.set(resource.id, {
              mime: resource.mime,
              filename: resource.filename || resource.title,
              data: data.toString('base64')
            });
          }
        });

        // Get all folders (notebooks)
        db.all('SELECT id, parent_id, title FROM folders', [], (err, folders) => {
          if (err) {
            reject(new Error(`Failed to read folders: ${err.message}`));
            return;
          }

          folders.forEach(folder => {
            notebooks.push({
              id: folder.id,
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
                id: tag.id,
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

                    // Process note content and replace resource links with base64 images
                    let content = note.body;
                    const resourceRegex = /!\[([^\]]*)\]\(:\/([^)]+)\)/g;
                    // ![a0de4510b43692ac5e0841e036a6d29a.png](:/73e541515dd74d42aa34a4cba48ad679)
                    content = content.replace(resourceRegex, (match, alt, resourceId) => {
                      const resource = resources.get(resourceId);
                      if (resource && resource.mime.startsWith('image/')) {
                        return `<img src="data:${resource.mime};base64,${resource.data}" />`;
                      }
                      return match;
                    });

                    notes.push({
                      id: note.id,
                      title: note.title,
                      content: markdownToHtml(content),
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