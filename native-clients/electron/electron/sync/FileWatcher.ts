/**
 * FileWatcher — отслеживание изменений файловой системы.
 *
 * Использует fs.watch для отслеживания создания, изменения и удаления файлов
 * в dataDirectory, пока приложение запущено.
 *
 * Интегрируется с SyncDatabase:
 * - Создание файла → sync_queue: CREATE
 * - Изменение файла → sync_queue: UPDATE
 * - Удаление файла → sync_queue: DELETE + tombstone
 */

import * as fs from 'fs';
import * as path from 'path';
import { SyncDatabase } from './SyncDatabase';
import { createHash } from 'crypto';

export class FileWatcher {
  private watchers: Map<string, fs.FSWatcher> = new Map();
  private db: SyncDatabase;
  private dataDir: string;
  private watching = false;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();

  // Расширения файлов, которые отслеживаем
  private watchExtensions = new Set([
    '.html', '.json', '.css', '.js', '.ts', '.tsx', '.jsx',
    '.txt', '.md', '.csv', '.xml', '.yaml', '.yml',
    '.pdf', '.doc', '.docx', '.png', '.jpg', '.jpeg', '.gif', '.svg'
  ]);

  constructor(db: SyncDatabase, dataDir: string) {
    this.db = db;
    this.dataDir = dataDir;
  }

  /**
   * Запускает отслеживание изменений в dataDirectory.
   */
  async start(): Promise<void> {
    if (this.watching) return;
    this.watching = true;

    console.log(`[FileWatcher] Starting to watch ${this.dataDir}`);

    try {
      // Рекурсивно отслеживаем изменения
      await this.watchDirectory(this.dataDir);

      // Отслеживаем новые поддиректории
      const rootWatcher = fs.watch(this.dataDir, (eventType, filename) => {
        if (!filename) return;

        const fullPath = path.join(this.dataDir, filename);

        try {
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            // Новая директория — начинаем отслеживать
            this.watchDirectory(fullPath);
          }
        } catch {
          // Файл/директория удалены
          this.handleDelete(fullPath);
        }
      });

      this.watchers.set(this.dataDir, rootWatcher);
    } catch (error) {
      console.error('[FileWatcher] Failed to start watching:', error);
      this.watching = false;
    }
  }

  /**
   * Рекурсивно отслеживает директорию и её поддиректории.
   */
  private async watchDirectory(dirPath: string): Promise<void> {
    try {
      // Пропускаем node_modules и .git
      if (dirPath.includes('node_modules') || dirPath.includes('.git')) {
        return;
      }

      // Уже отслеживается
      if (this.watchers.has(dirPath)) return;

      const watcher = fs.watch(dirPath, (eventType, filename) => {
        if (!filename) return;
        this.handleFileEvent(eventType, dirPath, filename);
      });

      this.watchers.set(dirPath, watcher);

      // Рекурсивно добавляем поддиректории
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          await this.watchDirectory(path.join(dirPath, entry.name));
        }
      }
    } catch (error) {
      console.error(`[FileWatcher] Failed to watch directory ${dirPath}:`, error);
    }
  }

  /**
   * Обрабатывает событие файловой системы.
   */
  private handleFileEvent(eventType: string, dirPath: string, filename: string): void {
    // Игнорируем временные файлы
    if (filename.startsWith('.')) return;

    const fullPath = path.join(dirPath, filename);
    const ext = path.extname(filename).toLowerCase();

    // Отслеживаем только определённые расширения
    if (!this.watchExtensions.has(ext)) return;

    // Относительный путь от dataDir
    const relativePath = path.relative(this.dataDir, fullPath);

    console.log(`[FileWatcher] Event: ${eventType} ${relativePath}`);

    // Debounce: ждём 300ms после последнего события
    const existingTimer = this.debounceTimers.get(fullPath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(async () => {
      this.debounceTimers.delete(fullPath);
      await this.processEvent(fullPath, relativePath);
    }, 300);

    this.debounceTimers.set(fullPath, timer);
  }

  /**
   * Обрабатывает событие с учётом debounce.
   */
  private async processEvent(fullPath: string, relativePath: string): Promise<void> {
    try {
      // Проверяем, существует ли файл
      const stat = fs.statSync(fullPath);

      if (stat.isFile()) {
        // Файл существует — это create или update
        const content = fs.readFileSync(fullPath, 'utf-8');
        const checksum = this.computeChecksum(content);
        const fileId = relativePath.replace(/\\/g, '/');

        // Проверяем, есть ли уже запись в ledger
        const existing = this.db.getLatestLedgerEntry(fileId);

        if (existing) {
          if (existing.checksum !== checksum) {
            // Файл изменился
            const newVersion = existing.version + 1;
            this.db.addLedgerEntry({
              fileId,
              filePath: relativePath,
              version: newVersion,
              checksum,
              sizeBytes: stat.size,
              modifiedAt: Date.now(),
              modifiedBy: null,
              operation: 'update',
              parentVersion: existing.version,
            });

            this.db.addToQueue({
              fileId,
              filePath: relativePath,
              operation: 'update',
              localVersion: newVersion,
              checksum,
            });
          }
        } else {
          // Новый файл
          this.db.addLedgerEntry({
            fileId,
            filePath: relativePath,
            version: 1,
            checksum,
            sizeBytes: stat.size,
            modifiedAt: Date.now(),
            modifiedBy: null,
            operation: 'create',
            parentVersion: null,
          });

          this.db.addToQueue({
            fileId,
            filePath: relativePath,
            operation: 'create',
            localVersion: 1,
            checksum,
          });
        }
      }
    } catch {
      // Файл не существует — удаление
      this.handleDelete(fullPath);
    }
  }

  /**
   * Обрабатывает удаление файла.
   */
  private handleDelete(fullPath: string): void {
    const relativePath = path.relative(this.dataDir, fullPath);
    const fileId = relativePath.replace(/\\/g, '/');

    const existing = this.db.getLatestLedgerEntry(fileId);

    if (existing) {
      console.log(`[FileWatcher] File deleted: ${relativePath}`);

      // Записываем tombstone
      this.db.addTombstone(fileId, relativePath, existing.checksum);

      // Добавляем в очередь
      this.db.addToQueue({
        fileId,
        filePath: relativePath,
        operation: 'delete',
        localVersion: existing.version + 1,
        checksum: existing.checksum,
      });

      // Добавляем запись в ledger
      this.db.addLedgerEntry({
        fileId,
        filePath: relativePath,
        version: existing.version + 1,
        checksum: existing.checksum,
        sizeBytes: 0,
        modifiedAt: Date.now(),
        modifiedBy: null,
        operation: 'delete',
        parentVersion: existing.version,
      });

      // Удаляем watcher для удалённой директории
      this.watchers.delete(fullPath);
    }
  }

  /**
   * Вычисляет SHA-256 хеш содержимого.
   */
  private computeChecksum(content: string): string {
    return createHash('sha256').update(content, 'utf-8').digest('hex');
  }

  /**
   * Останавливает отслеживание.
   */
  stop(): void {
    this.watching = false;

    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    for (const [dirPath, watcher] of this.watchers) {
      watcher.close();
    }
    this.watchers.clear();

    console.log('[FileWatcher] Stopped');
  }
}
