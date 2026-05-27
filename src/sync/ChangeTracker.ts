// ============================================================
// ChangeTracker — отслеживание изменений файлов заметок
// ============================================================

import { syncStateDB } from './SyncStateDB';
import { SyncFileRecord, SyncFileType, SyncOperationRecord } from './types';
import { sha256, uuid } from './utils';
import { getNativeAPI } from '../utils/nativeBridge';

export type ChangeHandler = (changes: SyncFileRecord[]) => void;

export class ChangeTracker {
  private watcher: FileWatcher | null = null;
  private onChangeHandlers: ChangeHandler[] = [];
  private scanIntervalId: number | null = null;
  private debounceTimer: number | null = null;
  private pendingChanges: SyncFileRecord[] = [];

  /**
   * Запускает отслеживание изменений.
   * Если доступен нативный API — используем FileWatcher.
   * Иначе — polling раз в N секунд.
   */
  async start(intervalMs: number = 5000): Promise<void> {
    // Startup scan — проверяем все существующие файлы
    await this.startupScan();

    const api = getNativeAPI();
    if (api) {
      // Используем polling через readStructure (доступно и в Electron, и в Android)
      this.watcher = new PollingWatcher(api, intervalMs, (changes) => {
        this.handleChanges(changes);
      });
      this.watcher.start();
    } else {
      // Fallback polling по readStructure
      this.scanIntervalId = window.setInterval(async () => {
        const changes = await this.scanForChanges();
        if (changes.length > 0) {
          this.handleChanges(changes);
        }
      }, intervalMs);
    }
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.stop();
      this.watcher = null;
    }
    if (this.scanIntervalId !== null) {
      clearInterval(this.scanIntervalId);
      this.scanIntervalId = null;
    }
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.pendingChanges = [];
  }

  onChange(handler: ChangeHandler): () => void {
    this.onChangeHandlers.push(handler);
    return () => {
      this.onChangeHandlers = this.onChangeHandlers.filter(h => h !== handler);
    };
  }

  /**
   * Startup Scan — проверяет файловую систему при старте и синхронизирует
   * с SyncStateDB. Обнаруживает изменения, сделанные в обход приложения.
   */
  private async startupScan(): Promise<void> {
    const api = getNativeAPI();
    if (!api) return;

    const result = await api.readStructure();
    if (!result.success || !result.structure) return;

    const knownFiles = await syncStateDB.getAllFiles();
    const knownMap = new Map(knownFiles.map(f => [f.fileId, f]));

    const foundFileIds = new Set<string>();
    const changes: SyncFileRecord[] = [];

    // Рекурсивно обходим структуру
    const walkStructure = (nodes: any[], parentPath: string) => {
      for (const node of nodes) {
        const currentPath = parentPath ? `${parentPath}/${node.name}` : node.name;
        if (node.type === 'folder' && node.children) {
          walkStructure(node.children, currentPath);
        } else if (node.type === 'file' && (node.name.endsWith('.html') || node.name.endsWith('.json') || node.name.endsWith('.css'))) {
          const fileId = currentPath;
          foundFileIds.add(fileId);

          const fileType = node.name.endsWith('.html') ? 'html' :
                           node.name.endsWith('.json') ? 'json' : 'css';

          const known = knownMap.get(fileId);
          if (!known) {
            // Новый файл
            const record: SyncFileRecord = {
              fileId,
              noteId: node.metadata?.id || fileId.replace(/\.(html|json|css)$/, ''),
              deviceId: 'local',
              version: 1,
              contentHash: '',
              mtime: Date.now(),
              deleted: false,
              fileType: fileType as SyncFileType,
            };
            changes.push(record);
          } else if (known.deleted) {
            // Файл был восстановлен
            known.deleted = false;
            known.version += 1;
            known.mtime = Date.now();
            changes.push(known);
          }
          // При старте не проверяем content_hash — это будет сделано
          // при загрузке/сохранении заметок через NotesStore
        }
      }
    };

    for (const node of result.structure) {
      walkStructure([node], '');
    }

    // Проверяем удалённые файлы
    for (const known of knownFiles) {
      if (!foundFileIds.has(known.fileId) && !known.deleted) {
        known.deleted = true;
        known.version += 1;
        changes.push(known);
      }
    }

    // Применяем изменения
    for (const change of changes) {
      await syncStateDB.putFile(change);
    }

    if (changes.length > 0) {
      const op: SyncOperationRecord = {
        opId: uuid(),
        noteId: '',
        fileId: '',
        opType: 'startup_scan',
        timestamp: Date.now(),
        deviceId: 'local',
        applied: true,
      };
      await syncStateDB.putOperation(op);

      this.notify(changes);
    }
  }

  /**
   * Сканирует изменения через readStructure и сравнивает с SyncStateDB.
   */
  private async scanForChanges(): Promise<SyncFileRecord[]> {
    const api = getNativeAPI();
    if (!api) return [];

    const result = await api.readStructure();
    if (!result.success || !result.structure) return [];

    const knownFiles = await syncStateDB.getAllFiles();
    const knownMap = new Map(knownFiles.map(f => [f.fileId, f]));
    const changes: SyncFileRecord[] = [];
    const foundFileIds = new Set<string>();

    const walkStructure = (nodes: any[], parentPath: string) => {
      for (const node of nodes) {
        const currentPath = parentPath ? `${parentPath}/${node.name}` : node.name;
        if (node.type === 'folder' && node.children) {
          walkStructure(node.children, currentPath);
        } else if (node.type === 'file' && (node.name.endsWith('.html') || node.name.endsWith('.json') || node.name.endsWith('.css'))) {
          const fileId = currentPath;
          foundFileIds.add(fileId);

          const fileType = node.name.endsWith('.html') ? 'html' :
                           node.name.endsWith('.json') ? 'json' : 'css';

          const known = knownMap.get(fileId);
          if (!known) {
            const record: SyncFileRecord = {
              fileId,
              noteId: node.metadata?.id || fileId.replace(/\.(html|json|css)$/, ''),
              deviceId: 'local',
              version: 1,
              contentHash: '',
              mtime: Date.now(),
              deleted: false,
              fileType: fileType as SyncFileType,
            };
            changes.push(record);
          }
        }
      }
    };

    for (const node of result.structure) {
      walkStructure([node], '');
    }

    // Удалённые файлы
    for (const known of knownFiles) {
      if (!foundFileIds.has(known.fileId) && !known.deleted) {
        known.deleted = true;
        known.version += 1;
        changes.push(known);
      }
    }

    return changes;
  }

  private handleChanges(changes: SyncFileRecord[]): void {
    // Debounce для группировки изменений
    this.pendingChanges.push(...changes);

    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = window.setTimeout(async () => {
      const batch = [...this.pendingChanges];
      this.pendingChanges = [];

      for (const change of batch) {
        await syncStateDB.putFile(change);
      }

      this.notify(batch);
    }, 1000);
  }

  private notify(changes: SyncFileRecord[]): void {
    for (const handler of this.onChangeHandlers) {
      try {
        handler(changes);
      } catch (e) {
        console.error('ChangeTracker handler error:', e);
      }
    }
  }
}

// ============================================================
// File Watcher interface
// ============================================================

interface FileWatcher {
  start(): void;
  stop(): void;
}

/**
 * PollingWatcher — периодически опрашивает readStructure
 * и вызывает callback при обнаружении изменений.
 */
class PollingWatcher implements FileWatcher {
  private api: any;
  private interval: number;
  private callback: (changes: SyncFileRecord[]) => void;
  private timerId: number | null = null;
  private knownFiles: Map<string, { mtime: number }> = new Map();

  constructor(api: any, interval: number, callback: (changes: SyncFileRecord[]) => void) {
    this.api = api;
    this.interval = interval;
    this.callback = callback;
  }

  start(): void {
    this.timerId = window.setInterval(async () => {
      try {
        const result = await this.api.readStructure();
        if (result.success && result.structure) {
          const changes = this.detectChanges(result.structure);
          if (changes.length > 0) {
            this.callback(changes);
          }
        }
      } catch (e) {
        console.error('PollingWatcher error:', e);
      }
    }, this.interval);
  }

  stop(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  private detectChanges(structure: any[]): SyncFileRecord[] {
    const changes: SyncFileRecord[] = [];
    const currentFiles = new Map<string, { mtime: number }>();

    const walk = (nodes: any[], parentPath: string) => {
      for (const node of nodes) {
        const currentPath = parentPath ? `${parentPath}/${node.name}` : node.name;
        if (node.type === 'folder' && node.children) {
          walk(node.children, currentPath);
        } else if (node.type === 'file') {
          currentFiles.set(currentPath, { mtime: Date.now() });
        }
      }
    };

    for (const node of structure) {
      walk([node], '');
    }

    // Проверяем новые/изменённые
    for (const [fileId] of currentFiles) {
      const known = this.knownFiles.get(fileId);
      if (!known) {
        changes.push({
          fileId,
          noteId: fileId.replace(/\.(html|json|css)$/, ''),
          deviceId: 'local',
          version: 1,
          contentHash: '',
          mtime: Date.now(),
          deleted: false,
          fileType: 'html',
        });
      }
    }

    // Проверяем удалённые
    for (const [fileId] of this.knownFiles) {
      if (!currentFiles.has(fileId)) {
        changes.push({
          fileId,
          noteId: fileId.replace(/\.(html|json|css)$/, ''),
          deviceId: 'local',
          version: 1,
          contentHash: '',
          mtime: Date.now(),
          deleted: true,
          fileType: 'html',
        });
      }
    }

    this.knownFiles = currentFiles;
    return changes;
  }
}

export const changeTracker = new ChangeTracker();
