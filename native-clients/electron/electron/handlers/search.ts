import { ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import { dataFolder, FileMetadata, SearchResult } from '../utils';

export function registerSearchHandlers(): void {
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
            await searchDirectory(fullPath, basePath);
          } else if (isFile) {
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
            } else if (entry.name.endsWith('.html') || entry.name.endsWith('.pdf')) {
              if (hasSearchString) {
                if (entry.name.toLowerCase().includes(searchLower)) {
                  matches.push('filename');
                }

                if (entry.name.endsWith('.html')) {
                  try {
                    const content = await fs.readFile(fullPath, 'utf-8');
                    if (content.toLowerCase().includes(searchLower)) {
                      matches.push('content');
                    }
                  } catch (error) {
                    // skip content search on read error
                  }
                }
              }

              const ext = path.extname(fullPath);
              const metadataPath = fullPath.replace(new RegExp(`\\${ext}$`), '.json');
              if (existsSync(metadataPath)) {
                try {
                  const metadataContent = await fs.readFile(metadataPath, 'utf-8');
                  const parsedFileMetadata: FileMetadata = JSON.parse(metadataContent);
                  metadata = parsedFileMetadata;

                  if (hasTags && parsedFileMetadata.tags) {
                    const hasMatchingTag = tags.some(tag =>
                      parsedFileMetadata.tags.some(metaTag =>
                        metaTag.toLowerCase().includes(tag.toLowerCase())
                      )
                    );

                    if (hasMatchingTag) {
                      matches.push('metadata:tags');
                    }
                  }
                } catch (error) {
                  // skip metadata on parse error
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
}
