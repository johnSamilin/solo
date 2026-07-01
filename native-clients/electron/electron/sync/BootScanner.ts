/**
 * BootScanner — сканирование файловой системы при запуске приложения.
 *
 * Задача: обнаружить файлы, которые были удалены в тот момент,
 * когда приложение было выключено. При старте:
 * 1. Сравниваем список файлов в sync_ledger с тем, что на диске
 * 2. Для пропавших файлов создаём tombstones и записи в sync_queue
 * 3. Для новых файлов (которых нет в ledger) добавляем записи
 */

import * as fs from 'fs';
import * as path from 'path';
import { SyncDatabase } from './SyncDatabase';
import { createHash } from 'crypto';

export class BootScanner {
  private db: SyncDatabase;
  private dataDir: string;

  constructor(db: SyncDatabase, dataDir: string) {
    this.db = db;
    this.dataDir = dataDir;
  }

  /**
   * Запускает сканирование при старте.
   * Вызывается один раз при инициализации приложения.
   */
  async scan(): Promise<BootScanResult> {
    const result: BootScanResult = {
      totalFilesOnDisk: 0,
      filesMissingOnDisk: 0,
      filesNewOnDisk: 0,
      tombstonesCreated: 0,
      queueEntriesAdded: 0,
    };

    console.log('[BootScanner] Starting boot-time scan...');

    // Шаг 1: Получаем список файлов на диске
    const diskFiles = this.scanDiskSync();
    const diskFileSet = new Set(diskFiles);

    result.totalFilesOnDisk = diskFileSet.size;

    // Шаг 2: Получаем список файлов из ledger (только живые, не удалённые)
    const ledgerEntries = this.db.getAllLatestLedgerEntries();
    const ledgerFiles = new Map<string, { filePath: string; checksum: string; version: number }>();

    for (const entry of ledgerEntries) {
      if (entry.operation !== 'delete') {
        ledgerFiles.set(entry.fileId, {
          filePath: entry.filePath,
          checksum: entry.checksum,
          version: entry.version,
        });
      }
    }

    // Шаг 3: Проверяем, какие файлы из ledger отсутствуют на диске (удалены офлайн)
    for (const [fileId, fileInfo] of ledgerFiles) {
      if (!diskFileSet.has(fileId)) {
        // Файл был удалён, когда приложение не работало
        console.log(`[BootScanner] File missing on disk: ${fileInfo.filePath}`);

        // Проверяем, есть ли уже tombstone для этого файла
        const existingTombstone = this.db.getTombstone(fileId);

        if (!existingTombstone) {
          // Создаём tombstone
          this.db.addTombstone(fileId, fileInfo.filePath, fileInfo.checksum);
          result.tombstonesCreated++;

          // Добавляем в очередь синхронизации
          this.db.addToQueue({
            fileId,
            filePath: fileInfo.filePath,
            operation: 'delete',
            localVersion: fileInfo.version + 1,
            checksum: fileInfo.checksum,
          });
          result.queueEntriesAdded++;

          // Добавляем запись в ledger
          this.db.addLedgerEntry({
            fileId,
            filePath: fileInfo.filePath,
            version: fileInfo.version + 1,
            checksum: fileInfo.checksum,
            sizeBytes: 0,
            modifiedAt: Date.now(),
            modifiedBy: null,
            operation: 'delete',
            parentVersion: fileInfo.version,
          });
        }

        result.filesMissingOnDisk++;
      }
    }

    // Шаг 4: Проверяем, какие файлы на диске отсутствуют в ledger (новые файлы)
    for (const fileId of diskFileSet) {
      if (!ledgerFiles.has(fileId)) {
        // Новый файл, созданный, когда приложение не работало
        const filePath = fileId.replace(/\//g, path.sep);
        const fullPath = path.join(this.dataDir, filePath);

        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const stat = fs.statSync(fullPath);
          const checksum = this.computeChecksum(content);

          // Добавляем в ledger
          this.db.addLedgerEntry({
            fileId,
            filePath,
            version: 1,
            checksum,
            sizeBytes: stat.size,
            modifiedAt: stat.mtimeMs,
            modifiedBy: null,
            operation: 'create',
            parentVersion: null,
          });

          // Добавляем в очередь
          this.db.addToQueue({
            fileId,
            filePath,
            operation: 'create',
            localVersion: 1,
            checksum,
          });

          result.filesNewOnDisk++;
          result.queueEntriesAdded++;
        } catch (error) {
          console.error(`[BootScanner] Failed to read new file ${filePath}:`, error);
        }
      }
    }

    console.log(`[BootScanner] Scan complete:`, result);
    return result;
  }

  /**
   * Рекурсивно сканирует директорию и возвращает список относительных путей.
   */
  private scanDiskSync(): string[] {
    const files: string[] = [];

    const walkDir = (dirPath: string): void => {
      try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);
          const relativePath = path.relative(this.dataDir, fullPath).replace(/\\/g, '/');

          // Игнорируем служебные директории
          if (entry.name === 'node_modules' || entry.name === '.git') continue;

          if (entry.isDirectory()) {
            walkDir(fullPath);
          } else if (entry.isFile()) {
            // Отслеживаем только .html, .json, .css
            const ext = path.extname(entry.name).toLowerCase();
            if (['.html', '.json', '.css'].includes(ext)) {
              files.push(relativePath);
            }
          }
        }
      } catch (error) {
        console.error(`[BootScanner] Error scanning directory ${dirPath}:`, error);
      }
    };

    walkDir(this.dataDir);
    return files;
  }

  /**
   * Вычисляет SHA-256 хеш.
   */
  private computeChecksum(content: string): string {
    return createHash('sha256').update(content, 'utf-8').digest('hex');
  }
}

export interface BootScanResult {
  totalFilesOnDisk: number;
  filesMissingOnDisk: number;
  filesNewOnDisk: number;
  tombstonesCreated: number;
  queueEntriesAdded: number;
}
