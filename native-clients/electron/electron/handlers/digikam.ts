import { ipcMain } from 'electron';
import { existsSync } from 'fs';
import Database from 'better-sqlite3';

export function registerDigikamHandlers(): void {
  ipcMain.handle('get-digikam-tags', async (_event, dbPath: string) => {
    let db: Database.Database | null = null;

    try {
      if (!existsSync(dbPath)) {
        return { success: false, error: 'Database file not found' };
      }

      db = new Database(dbPath, { readonly: true, fileMustExist: true });

      const query = `
        SELECT id, pid as parentId, name
        FROM Tags
        ORDER BY pid, name
      `;
      const stmt = db.prepare(query);
      const tags = stmt.all();

      return { success: true, tags };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    } finally {
      if (db) {
        try {
          db.close();
        } catch (closeError) {
          console.error('Error closing database:', closeError);
        }
      }
    }
  });

  ipcMain.handle('get-digikam-images-by-tag', async (_event, dbPath: string, tagId: number, limit: number = 10) => {
    let db: Database.Database | null = null;

    try {
      if (!existsSync(dbPath)) {
        return { success: false, error: 'Database file not found' };
      }

      db = new Database(dbPath, { readonly: true, fileMustExist: true });

      const query = `
        SELECT DISTINCT
          i.id,
          i.name,
          al.relativePath,
          ar.specificPath,
          it.tagid
        FROM Images i
        INNER JOIN ImageTags it ON i.id = it.imageid
        INNER JOIN Albums al ON i.album = al.id
        INNER JOIN AlbumRoots ar ON ar.id = 1
        WHERE it.tagid=?
        ORDER BY i.modificationDate ASC
        LIMIT ?
      `;

      const stmt = db.prepare(query);
      const images = stmt.all(tagId, limit);
      console.log('Digikam query: ' + query + ` (results: ${images.length}). params: ${JSON.stringify({tagId})}`);

      return { success: true, images };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    } finally {
      if (db) {
        try {
          db.close();
        } catch (closeError) {
          console.error('Error closing database:', closeError);
        }
      }
    }
  });
}
