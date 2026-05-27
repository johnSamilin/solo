import { ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import { dataFolder, isPathSafe, FileMetadata } from '../utils';

export function registerNotebookHandlers(): void {
  ipcMain.handle('create-notebook', async (_, parentPath: string, name: string) => {
    try {
      if (!dataFolder) {
        return { success: false, error: 'No data folder selected' };
      }

      if (!name || name.trim().length === 0) {
        return { success: false, error: 'Notebook name is required' };
      }

      const sanitizedName = name.replace(/[/\\?%*:|"<>]/g, '-');
      const fullParentPath = path.join(dataFolder, parentPath);

      if (!(await isPathSafe(fullParentPath, dataFolder))) {
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

      const sanitizedName = name.replace(/[/\\?%*:|"<>]/g, '-');
      const fullParentPath = path.join(dataFolder, parentPath);

      if (!(await isPathSafe(fullParentPath, dataFolder))) {
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
        id: Date.now().toString(),
        tags: [],
        createdAt: new Date().toISOString().split('T')[0],
      };

      await fs.writeFile(htmlPath, htmlContent, 'utf-8');
      await fs.writeFile(jsonPath, JSON.stringify(metadata, null, 2), 'utf-8');

      const relativeHtmlPath = path.relative(dataFolder, htmlPath);
      const relativeJsonPath = path.relative(dataFolder, jsonPath);

      return {
        success: true,
        htmlPath: relativeHtmlPath,
        id: metadata.id,
        jsonPath: relativeJsonPath,
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });
}
