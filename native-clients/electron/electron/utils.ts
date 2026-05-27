import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';

// ============================================================
// Global state
// ============================================================

export let mainWindow: BrowserWindow | null = null;
export let dataFolder: string | null = null;

export function setMainWindow(win: BrowserWindow | null): void {
  mainWindow = win;
}

export function setDataFolder(folder: string | null): void {
  dataFolder = folder;
}

// ============================================================
// Settings persistence
// ============================================================

const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');

export async function loadSettings(): Promise<void> {
  try {
    if (existsSync(SETTINGS_FILE)) {
      const data = await fs.readFile(SETTINGS_FILE, 'utf-8');
      const settings = JSON.parse(data);
      dataFolder = settings.dataFolder || null;
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
}

export async function saveSettings(): Promise<void> {
  try {
    const settings = { dataFolder };
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
}

// ============================================================
// Path safety (symlink-aware)
// ============================================================

export const isPathSafe = async (fullPath: string, basePath: string): Promise<boolean> => {
  try {
    if (fullPath.startsWith(basePath)) {
      return true;
    }

    const realPath = await fs.realpath(fullPath);
    if (realPath.startsWith(basePath)) {
      return true;
    }

    let currentPath = fullPath;
    while (currentPath !== basePath && currentPath !== path.dirname(currentPath)) {
      try {
        const stats = await fs.lstat(currentPath);
        if (stats.isSymbolicLink()) {
          const linkTarget = await fs.readlink(currentPath);
          const resolvedLink = path.resolve(path.dirname(currentPath), linkTarget);
          if (currentPath.startsWith(basePath)) {
            return true;
          }
        }
      } catch {
        // Continue checking parent directories
      }
      currentPath = path.dirname(currentPath);
    }

    return false;
  } catch {
    return fullPath.startsWith(basePath);
  }
};

// ============================================================
// Shared interfaces
// ============================================================

export interface FileMetadata {
  id: string;
  tags: string[];
  createdAt: string;
  paragraphTags?: string[];
}

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  metadata?: FileMetadata;
  cssPath?: string;
}

export interface SearchResult {
  path: string;
  type: 'filename' | 'content' | 'metadata';
  matches: string[];
  metadata?: FileMetadata;
}
