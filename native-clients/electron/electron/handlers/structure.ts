import { ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import { dataFolder, FileMetadata, FileNode } from '../utils';

export function registerStructureHandlers(): void {
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

          let isDirectory = entry.isDirectory();
          let isFile = entry.isFile();

          if (entry.isSymbolicLink()) {
            try {
              const stats = await fs.stat(fullPath);
              isDirectory = stats.isDirectory();
              isFile = stats.isFile();
            } catch (error) {
              console.error(`Failed to resolve symlink ${entry.name}:`, error);
              continue;
            }
          }

          if (isDirectory) {
            const children = await readDirectory(fullPath, basePath);
            nodes.push({
              name: entry.name,
              path: relativePath,
              type: 'folder',
              children,
            });
          } else if (isFile && (entry.name.endsWith('.html') || entry.name.endsWith('.pdf'))) {
            const ext = path.extname(entry.name);
            const metadataPath = fullPath.replace(new RegExp(`\\${ext}$`), '.json');
            const cssPath = fullPath.replace(new RegExp(`\\${ext}$`), '.css');
            let metadata: FileMetadata | undefined;
            let cssRelativePath: string | undefined;

            if (existsSync(metadataPath)) {
              try {
                const metadataContent = await fs.readFile(metadataPath, 'utf-8');
                metadata = JSON.parse(metadataContent);
                if (metadata) {
                  // migration
                  metadata.tags = (metadata.tags ?? []).map((tag) => {
                    if (typeof tag === 'object') {
                      // @ts-ignore
                      return tag.path;
                    } else {
                      return tag;
                    }
                  });
                  processedMetadata.add(path.basename(metadataPath));
                }
              } catch (error) {
                console.error(`Failed to read metadata for ${entry.name}:`, error);
              }
            }

            if (ext === '.html' && existsSync(cssPath)) {
              cssRelativePath = path.relative(basePath, cssPath);
            }

            nodes.push({
              name: entry.name,
              path: relativePath,
              type: 'file',
              metadata,
              cssPath: cssRelativePath,
            });
          } else if (!entry.name.endsWith('.json') && !entry.name.endsWith('.css')) {
            nodes.push({
              name: entry.name,
              path: relativePath,
              type: 'file',
            });
          }
        }

        return nodes.sort((a, b) => {
          if (a.type === b.type && a.type === 'file') {
            return (a.metadata?.createdAt ?? 0) > (b.metadata?.createdAt ?? 0) ? 1 : -1;
          }
          if (a.type === 'folder') {
            return -1;
          }
          return 0;
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

          let isDirectory = entry.isDirectory();
          let isFile = entry.isFile();

          if (entry.isSymbolicLink()) {
            try {
              const stats = await fs.stat(fullPath);
              isDirectory = stats.isDirectory();
              isFile = stats.isFile();
            } catch (error) {
              console.error(`Failed to resolve symlink ${entry.name}:`, error);
              continue;
            }
          }

          if (isDirectory) {
            await scanDirectory(fullPath);
          } else if (isFile && entry.name.endsWith('.json')) {
            try {
              const content = await fs.readFile(fullPath, 'utf-8');
              const metadata: FileMetadata = JSON.parse(content);

              if (metadata.tags && Array.isArray(metadata.tags)) {
                metadata.tags.forEach(tag => {
                  if (typeof tag === 'object') {
                    // @ts-ignore
                    tags.add(tag.path);
                  } else {
                    tags.add(tag);
                  }
                });
              }
              if (metadata.paragraphTags && Array.isArray(metadata.paragraphTags)) {
                metadata.paragraphTags.forEach(tag => tags.add(tag));
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
}
