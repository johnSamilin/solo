import { app, BrowserWindow, ipcMain, dialog, protocol, net } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';

let mainWindow: BrowserWindow | null = null;
let dataFolder: string | null = null;

const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');

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

const loadSettings = async () => {
  try {
    if (existsSync(SETTINGS_FILE)) {
      const data = await fs.readFile(SETTINGS_FILE, 'utf-8');
      const settings = JSON.parse(data);
      dataFolder = settings.dataFolder || null;
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
};

const saveSettings = async () => {
  try {
    const settings = { dataFolder };
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
};

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
};

app.whenReady().then(async () => {
  await loadSettings();

  protocol.handle('image', (request) => {
    const url = new URL(request.url);
    const filePath = url.pathname;

    if (!dataFolder) {
      return new Response('No data folder', { status: 404 });
    }

    const assetsPath = path.join(dataFolder, 'assets', filePath);

    if (!assetsPath.startsWith(path.join(dataFolder, 'assets'))) {
      return new Response('Forbidden', { status: 403 });
    }

    if (!existsSync(assetsPath)) {
      return new Response('Not found', { status: 404 });
    }

    return net.fetch('file://' + assetsPath);
  });

  protocol.handle('audio', (request) => {
    const url = new URL(request.url);
    const filePath = url.pathname;

    let audioPath: string;
    let basePath: string;

    if (process.env.NODE_ENV === 'development') {
      basePath = path.join(__dirname, '../../../public');
      audioPath = path.join(basePath, filePath);
    } else {
      basePath = path.join(__dirname, '../dist');
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

interface FileMetadata {
  id: string;
  tags: string[];
  date: string;
}

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  metadata?: FileMetadata;
}

ipcMain.handle('select-folder', async () => {
  if (!mainWindow) return { success: false, error: 'No window available' };

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Select Data Folder',
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { success: false, error: 'Folder selection cancelled' };
  }

  dataFolder = result.filePaths[0];
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

  const relativePath = path.relative(dataFolder, selectedPath);
  return { success: true, path: relativePath || '.' };
});

ipcMain.handle('open-file', async (_, relativePath: string) => {
  try {
    if (!dataFolder) {
      return { success: false, error: 'No data folder selected' };
    }

    const fullPath = path.join(dataFolder, relativePath);

    if (!fullPath.startsWith(dataFolder)) {
      return { success: false, error: 'Invalid path: path traversal detected' };
    }

    if (!existsSync(fullPath)) {
      return { success: false, error: 'File does not exist' };
    }

    const content = await fs.readFile(fullPath, 'utf-8');
    return { success: true, content };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('update-file', async (_, relativePath: string, content: string) => {
  try {
    if (!dataFolder) {
      return { success: false, error: 'No data folder selected' };
    }

    const fullPath = path.join(dataFolder, relativePath);

    if (!fullPath.startsWith(dataFolder)) {
      return { success: false, error: 'Invalid path: path traversal detected' };
    }

    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });

    await fs.writeFile(fullPath, content, 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('update-metadata', async (_, relativePath: string, metadata: FileMetadata) => {
  try {
    if (!dataFolder) {
      return { success: false, error: 'No data folder selected' };
    }

    const parsedPath = path.parse(relativePath);
    const metadataPath = path.join(parsedPath.dir, `${parsedPath.name}.json`);
    const fullPath = path.join(dataFolder, metadataPath);

    if (!fullPath.startsWith(dataFolder)) {
      return { success: false, error: 'Invalid path: path traversal detected' };
    }

    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });

    await fs.writeFile(fullPath, JSON.stringify(metadata, null, 2), 'utf-8');
    return { success: true, path: metadataPath };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('read-structure', async () => {
  try {
    if (!dataFolder) {
      return { success: false, error: 'No data folder selected' };
    }

    const readDirectory = async (dirPath: string, basePath: string): Promise<FileNode[]> => {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const nodes: FileNode[] = [];
      const processedMetadata = new Set<string>();

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const relativePath = path.relative(basePath, fullPath);

        if (entry.isDirectory()) {
          const children = await readDirectory(fullPath, basePath);
          nodes.push({
            name: entry.name,
            path: relativePath,
            type: 'folder',
            children,
          });
        } else if (entry.isFile() && entry.name.endsWith('.html')) {
          const metadataPath = fullPath.replace(/\.html$/, '.json');
          let metadata: FileMetadata | undefined;

          if (existsSync(metadataPath)) {
            try {
              const metadataContent = await fs.readFile(metadataPath, 'utf-8');
              metadata = JSON.parse(metadataContent);
              processedMetadata.add(path.basename(metadataPath));
            } catch (error) {
              console.error(`Failed to read metadata for ${entry.name}:`, error);
            }
          }

          nodes.push({
            name: entry.name,
            path: relativePath,
            type: 'file',
            metadata,
          });
        } else if (!entry.name.endsWith('.json')) {
          nodes.push({
            name: entry.name,
            path: relativePath,
            type: 'file',
          });
        }
      }

      return nodes.sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'folder' ? -1 : 1;
      });
    };

    const structure = await readDirectory(dataFolder, dataFolder);
    return { success: true, structure };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('scan-all-tags', async () => {
  try {
    if (!dataFolder) {
      return { success: false, error: 'No data folder selected' };
    }

    const tags = new Set<string>();

    const scanDirectory = async (dirPath: string): Promise<void> => {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          await scanDirectory(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.json')) {
          try {
            const content = await fs.readFile(fullPath, 'utf-8');
            const metadata: FileMetadata = JSON.parse(content);

            if (metadata.tags && Array.isArray(metadata.tags)) {
              metadata.tags.forEach(tag => tags.add(tag));
            }
          } catch (error) {
            continue;
          }
        }
      }
    };

    await scanDirectory(dataFolder);
    return { success: true, tags: Array.from(tags).sort() };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

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

interface SearchResult {
  path: string;
  type: 'filename' | 'content' | 'metadata';
  matches: string[];
  metadata?: FileMetadata;
}

ipcMain.handle('search', async (_, searchString?: string, tags?: string[]) => {
  try {
    if (!dataFolder) {
      return { success: false, error: 'No data folder selected' };
    }

    const results: SearchResult[] = [];
    const hasSearchString = searchString && searchString.trim().length > 0;
    const hasTags = tags && tags.length > 0;

    if (!hasSearchString && !hasTags) {
      return { success: true, results: [] };
    }

    const searchLower = searchString?.toLowerCase() || '';

    const searchDirectory = async (dirPath: string, basePath: string): Promise<void> => {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const relativePath = path.relative(basePath, fullPath);

        if (entry.isDirectory()) {
          await searchDirectory(fullPath, basePath);
        } else if (entry.isFile()) {
          const matches: string[] = [];
          let metadata: FileMetadata | undefined;

          if (entry.name.endsWith('.json')) {
            try {
              const content = await fs.readFile(fullPath, 'utf-8');
              const parsedMetadata: FileMetadata = JSON.parse(content);
              metadata = parsedMetadata;

              if (hasTags && parsedMetadata.tags) {
                const hasMatchingTag = tags.some(tag =>
                  parsedMetadata.tags.some(metaTag =>
                    metaTag.toLowerCase().includes(tag.toLowerCase())
                  )
                );

                if (hasMatchingTag) {
                  matches.push('metadata:tags');
                }
              }

              if (hasSearchString) {
                if (parsedMetadata.id?.toLowerCase().includes(searchLower)) {
                  matches.push('metadata:id');
                }
                if (parsedMetadata.tags?.some(tag => tag.toLowerCase().includes(searchLower))) {
                  matches.push('metadata:tags');
                }
              }

              if (matches.length > 0) {
                results.push({
                  path: relativePath,
                  type: 'metadata',
                  matches: [...new Set(matches)],
                  metadata: parsedMetadata,
                });
              }
            } catch (error) {
              continue;
            }
          } else if (entry.name.endsWith('.html')) {
            if (hasSearchString) {
              if (entry.name.toLowerCase().includes(searchLower)) {
                matches.push('filename');
              }

              try {
                const content = await fs.readFile(fullPath, 'utf-8');
                if (content.toLowerCase().includes(searchLower)) {
                  matches.push('content');
                }
              } catch (error) {
                continue;
              }
            }

            const metadataPath = fullPath.replace(/\.html$/, '.json');
            if (existsSync(metadataPath)) {
              try {
                const metadataContent = await fs.readFile(metadataPath, 'utf-8');
                const parsedHtmlMetadata: FileMetadata = JSON.parse(metadataContent);
                metadata = parsedHtmlMetadata;

                if (hasTags && parsedHtmlMetadata.tags) {
                  const hasMatchingTag = tags.some(tag =>
                    parsedHtmlMetadata.tags.some(metaTag =>
                      metaTag.toLowerCase().includes(tag.toLowerCase())
                    )
                  );

                  if (hasMatchingTag) {
                    matches.push('metadata:tags');
                  }
                }
              } catch (error) {
                continue;
              }
            }

            if (matches.length > 0) {
              results.push({
                path: relativePath,
                type: matches.includes('content') ? 'content' : 'filename',
                matches: [...new Set(matches)],
                metadata,
              });
            }
          } else if (hasSearchString) {
            if (entry.name.toLowerCase().includes(searchLower)) {
              results.push({
                path: relativePath,
                type: 'filename',
                matches: ['filename'],
              });
            }
          }
        }
      }
    };

    await searchDirectory(dataFolder, dataFolder);
    return { success: true, results };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('create-notebook', async (_, parentPath: string, name: string) => {
  try {
    if (!dataFolder) {
      return { success: false, error: 'No data folder selected' };
    }

    if (!name || name.trim().length === 0) {
      return { success: false, error: 'Notebook name is required' };
    }

    const sanitizedName = name.trim().replace(/[/\\?%*:|"<>]/g, '-');
    const fullParentPath = path.join(dataFolder, parentPath);

    if (!fullParentPath.startsWith(dataFolder)) {
      return { success: false, error: 'Invalid path: path traversal detected' };
    }

    const notebookPath = path.join(fullParentPath, sanitizedName);

    if (existsSync(notebookPath)) {
      return { success: false, error: 'Notebook folder already exists' };
    }

    await fs.mkdir(notebookPath, { recursive: true });

    const relativePath = path.relative(dataFolder, notebookPath);
    return { success: true, path: relativePath };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('create-note', async (_, parentPath: string, name: string) => {
  try {
    if (!dataFolder) {
      return { success: false, error: 'No data folder selected' };
    }

    if (!name || name.trim().length === 0) {
      return { success: false, error: 'Note name is required' };
    }

    const sanitizedName = name.trim().replace(/[/\\?%*:|"<>]/g, '-');
    const fullParentPath = path.join(dataFolder, parentPath);

    if (!fullParentPath.startsWith(dataFolder)) {
      return { success: false, error: 'Invalid path: path traversal detected' };
    }

    await fs.mkdir(fullParentPath, { recursive: true });

    const htmlPath = path.join(fullParentPath, `${sanitizedName}.html`);
    const jsonPath = path.join(fullParentPath, `${sanitizedName}.json`);

    if (existsSync(htmlPath)) {
      return { success: false, error: 'Note already exists' };
    }

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${sanitizedName}</title>
</head>
<body>
  <h1>${sanitizedName}</h1>
  <p>Start writing your note here...</p>
</body>
</html>`;

    const metadata: FileMetadata = {
      id: sanitizedName,
      tags: [],
      date: new Date().toISOString().split('T')[0],
    };

    await fs.writeFile(htmlPath, htmlContent, 'utf-8');
    await fs.writeFile(jsonPath, JSON.stringify(metadata, null, 2), 'utf-8');

    const relativeHtmlPath = path.relative(dataFolder, htmlPath);
    const relativeJsonPath = path.relative(dataFolder, jsonPath);

    return {
      success: true,
      htmlPath: relativeHtmlPath,
      jsonPath: relativeJsonPath,
    };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('delete-note', async (_, relativePath: string) => {
  try {
    if (!dataFolder) {
      return { success: false, error: 'No data folder selected' };
    }

    const fullPath = path.join(dataFolder, relativePath);

    if (!fullPath.startsWith(dataFolder)) {
      return { success: false, error: 'Invalid path: path traversal detected' };
    }

    if (!existsSync(fullPath)) {
      return { success: false, error: 'Note file does not exist' };
    }

    const jsonPath = fullPath.replace(/\.html$/, '.json');

    await fs.unlink(fullPath);
    if (existsSync(jsonPath)) {
      await fs.unlink(jsonPath);
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('delete-notebook', async (_, relativePath: string) => {
  try {
    if (!dataFolder) {
      return { success: false, error: 'No data folder selected' };
    }

    const fullPath = path.join(dataFolder, relativePath);

    if (!fullPath.startsWith(dataFolder)) {
      return { success: false, error: 'Invalid path: path traversal detected' };
    }

    if (!existsSync(fullPath)) {
      return { success: false, error: 'Notebook folder does not exist' };
    }

    await fs.rm(fullPath, { recursive: true, force: true });

    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('rename-note', async (_, relativePath: string, newName: string) => {
  try {
    if (!dataFolder) {
      return { success: false, error: 'No data folder selected' };
    }

    const sanitizedNewName = newName.trim().replace(/[/\\?%*:|"<>]/g, '-');
    const fullPath = path.join(dataFolder, relativePath);

    if (!fullPath.startsWith(dataFolder)) {
      return { success: false, error: 'Invalid path: path traversal detected' };
    }

    if (!existsSync(fullPath)) {
      return { success: false, error: 'Note file does not exist' };
    }

    const dirPath = path.dirname(fullPath);
    const newHtmlPath = path.join(dirPath, `${sanitizedNewName}.html`);
    const newJsonPath = path.join(dirPath, `${sanitizedNewName}.json`);
    const oldJsonPath = fullPath.replace(/\.html$/, '.json');

    if (existsSync(newHtmlPath)) {
      return { success: false, error: 'A note with this name already exists' };
    }

    await fs.rename(fullPath, newHtmlPath);
    if (existsSync(oldJsonPath)) {
      await fs.rename(oldJsonPath, newJsonPath);
    }

    const relativeNewPath = path.relative(dataFolder, newHtmlPath);
    return { success: true, newPath: relativeNewPath };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('rename-notebook', async (_, relativePath: string, newName: string) => {
  try {
    if (!dataFolder) {
      return { success: false, error: 'No data folder selected' };
    }

    const sanitizedNewName = newName.trim().replace(/[/\\?%*:|"<>]/g, '-');
    const fullPath = path.join(dataFolder, relativePath);

    if (!fullPath.startsWith(dataFolder)) {
      return { success: false, error: 'Invalid path: path traversal detected' };
    }

    if (!existsSync(fullPath)) {
      return { success: false, error: 'Notebook folder does not exist' };
    }

    const parentPath = path.dirname(fullPath);
    const newPath = path.join(parentPath, sanitizedNewName);

    if (existsSync(newPath)) {
      return { success: false, error: 'A notebook with this name already exists' };
    }

    await fs.rename(fullPath, newPath);

    const relativeNewPath = path.relative(dataFolder, newPath);
    return { success: true, newPath: relativeNewPath };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('upload-image', async (_event, imageData: string, fileName: string) => {
  try {
    if (!dataFolder) {
      return { success: false, error: 'No data folder selected' };
    }

    const assetsDir = path.join(dataFolder, 'assets');

    if (!existsSync(assetsDir)) {
      await fs.mkdir(assetsDir, { recursive: true });
    }

    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniqueFileName = `${timestamp}-${sanitizedFileName}`;
    const filePath = path.join(assetsDir, uniqueFileName);

    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    await fs.writeFile(filePath, buffer);

    return {
      success: true,
      fileName: uniqueFileName,
      url: `image://${uniqueFileName}`,
    };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});
