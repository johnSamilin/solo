import { ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import { dataFolder } from '../utils';

export function registerImageHandlers(): void {
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
      const uniqueFileName = `${timestamp}-${sanitizedFileName}`.toLowerCase();
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
}
