import { ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import { dataFolder, isPathSafe, FileMetadata } from '../utils';

export function registerFileHandlers(): void {
  ipcMain.handle('open-file', async (_, relativePath: string) => {
    try {
      if (!dataFolder) {
        return { success: false, error: 'No data folder selected' };
      }

      const fullPath = path.join(dataFolder, relativePath);

      if (!(await isPathSafe(fullPath, dataFolder))) {
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

  ipcMain.handle('open-pdf-file', async (_, relativePath: string) => {
    try {
      if (!dataFolder) {
        return { success: false, error: 'No data folder selected' };
      }

      const fullPath = path.join(dataFolder, relativePath);

      if (!(await isPathSafe(fullPath, dataFolder))) {
        return { success: false, error: 'Invalid path: path traversal detected' };
      }

      if (!existsSync(fullPath)) {
        return { success: false, error: 'File does not exist' };
      }

      const buffer = await fs.readFile(fullPath);
      return { success: true, data: buffer.toString('base64') };
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

      if (!(await isPathSafe(fullPath, dataFolder))) {
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

      if (!(await isPathSafe(fullPath, dataFolder))) {
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

  ipcMain.handle('delete-note', async (_, relativePath: string) => {
    try {
      if (!dataFolder) {
        return { success: false, error: 'No data folder selected' };
      }

      const fullPath = path.join(dataFolder, relativePath);
      if (!(await isPathSafe(fullPath, dataFolder))) {
        return { success: false, error: 'Invalid path: path traversal detected' };
      }

      if (!existsSync(fullPath)) {
        return { success: false, error: 'Note file does not exist' };
      }

      const ext = path.extname(fullPath);
      const jsonPath = fullPath.replace(new RegExp(`\\${ext}$`), '.json');
      const cssPath = fullPath.replace(new RegExp(`\\${ext}$`), '.css');

      await fs.unlink(fullPath);
      if (existsSync(jsonPath)) {
        await fs.unlink(jsonPath);
      }
      if (ext === '.html' && existsSync(cssPath)) {
        await fs.unlink(cssPath);
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

      if (!(await isPathSafe(fullPath, dataFolder))) {
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

      const sanitizedNewName = newName.replace(/[/\\?%*:|"<>]/g, '-');
      const fullPath = path.join(dataFolder, relativePath);

      if (!(await isPathSafe(fullPath, dataFolder))) {
        return { success: false, error: 'Invalid path: path traversal detected' };
      }

      if (!existsSync(fullPath)) {
        return { success: false, error: 'Note file does not exist' };
      }

      const ext = path.extname(fullPath);
      const dirPath = path.dirname(fullPath);
      const newFilePath = path.join(dirPath, `${sanitizedNewName}${ext}`);
      const newJsonPath = path.join(dirPath, `${sanitizedNewName}.json`);
      const oldJsonPath = fullPath.replace(new RegExp(`\\${ext}$`), '.json');

      if (existsSync(newFilePath)) {
        return { success: false, error: 'A note with this name already exists' };
      }

      await fs.rename(fullPath, newFilePath);
      if (existsSync(oldJsonPath)) {
        await fs.rename(oldJsonPath, newJsonPath);
      }

      if (ext === '.html') {
        const newCssPath = path.join(dirPath, `${sanitizedNewName}.css`);
        const oldCssPath = fullPath.replace(/\.html$/, '.css');
        if (existsSync(oldCssPath)) {
          await fs.rename(oldCssPath, newCssPath);
        }
      }

      const relativeNewPath = path.relative(dataFolder, newFilePath);
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

      const sanitizedNewName = newName.replace(/[/\\?%*:|"<>]/g, '-');
      const fullPath = path.join(dataFolder, relativePath);

      if (!(await isPathSafe(fullPath, dataFolder))) {
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
}
