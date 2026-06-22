/**
 * WebDAVClient — низкоуровневый HTTP-клиент для взаимодействия с WebDAV сервером.
 *
 * Использует встроенный fetch. Поддерживает:
 * - PROPFIND (список директории)
 * - GET (чтение файла)
 * - PUT (запись файла)
 * - DELETE (удаление файла)
 * - Базовую аутентификацию
 */

import { WebDAVConfig } from '../types';

export interface WebDAVFileInfo {
  href: string;
  path: string;
  size: number;
  modifiedAt: string;
  isDirectory: boolean;
}

export class WebDAVClient {
  private config: WebDAVConfig;
  private baseUrl: string;

  constructor(config: WebDAVConfig) {
    this.config = config;
    // Нормализуем base URL — убираем trailing slash
    this.baseUrl = config.url.replace(/\/+$/, '');
  }

  /**
   * Формирует базовые заголовки с авторизацией.
   */
  private getHeaders(extra: Record<string, string> = {}): Record<string, string> {
    const auth = btoa(`${this.config.username}:${this.config.password}`);
    return {
      'Authorization': `Basic ${auth}`,
      ...extra,
    };
  }

  /**
   * Полный URL для пути на WebDAV.
   */
  private fullUrl(webdavPath: string): string {
    const cleanPath = webdavPath.replace(/^\//, '');
    return `${this.baseUrl}/${cleanPath}`;
  }

  /**
   * Проверяет соединение с WebDAV сервером.
   * Делает OPTIONS запрос к корню.
   */
  async checkConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'OPTIONS',
        headers: this.getHeaders(),
      });
      if (response.ok || response.status === 207) {
        return { success: true };
      }
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Список содержимого директории через PROPFIND.
   */
  async listDir(webdavPath: string): Promise<WebDAVFileInfo[]> {
    const url = this.fullUrl(webdavPath);
    const response = await fetch(url, {
      method: 'PROPFIND',
      headers: this.getHeaders({
        'Depth': '1',
        'Content-Type': 'application/xml',
      }),
      body: '<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/><d:getcontentlength/><d:getlastmodified/><d:displayname/></d:prop></d:propfind>',
    });

    if (!response.ok) {
      if (response.status === 404) return []; // Директория не существует
      throw new Error(`PROPFIND failed: ${response.status} ${response.statusText}`);
    }

    const text = await response.text();
    return this.parsePropfindResponse(text);
  }

  /**
   * Парсит XML-ответ PROPFIND.
   */
  private parsePropfindResponse(xml: string): WebDAVFileInfo[] {
    const files: WebDAVFileInfo[] = [];

    // Простой парсинг через regex (достаточно для базовых случаев)
    const responseRegex = /<d:response>([\s\S]*?)<\/d:response>/gi;
    let match: RegExpExecArray | null;

    while ((match = responseRegex.exec(xml)) !== null) {
      const responseXml = match[1];

      const href = this.extractTag(responseXml, 'd:href') || this.extractTag(responseXml, 'D:href') || '';
      const isCollection = /<d:collection\s*\/>|<D:collection\s*\/>/i.test(responseXml);
      const sizeStr = this.extractTag(responseXml, 'd:getcontentlength') || this.extractTag(responseXml, 'D:getcontentlength') || '0';
      const modifiedAt = this.extractTag(responseXml, 'd:getlastmodified') || this.extractTag(responseXml, 'D:getlastmodified') || '';

      if (!href) continue;

      files.push({
        href,
        path: decodeURIComponent(href.replace(/\/$/, '')),
        size: parseInt(sizeStr, 10) || 0,
        modifiedAt,
        isDirectory: isCollection,
      });
    }

    return files;
  }

  /**
   * Извлекает содержимое тега из XML (простой regex).
   */
  private extractTag(xml: string, tag: string): string | null {
    const regex = new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, 'i');
    const m = regex.exec(xml);
    return m ? m[1].trim() : null;
  }

  /**
   * Читает файл с WebDAV и возвращает как ArrayBuffer.
   */
  async getFile(webdavPath: string): Promise<ArrayBuffer> {
    const url = this.fullUrl(webdavPath);
    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`GET failed: ${response.status} ${response.statusText}`);
    }

    return response.arrayBuffer();
  }

  /**
   * Читает файл как текст (например, manifest.json).
   */
  async getFileAsText(webdavPath: string): Promise<string> {
    const url = this.fullUrl(webdavPath);
    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`GET failed: ${response.status} ${response.statusText}`);
    }

    return response.text();
  }

  /**
   * Создаёт директорию на WebDAV (MKCOL).
   */
  async createDirectory(webdavPath: string): Promise<boolean> {
    const url = this.fullUrl(webdavPath);
    const response = await fetch(url, {
      method: 'MKCOL',
      headers: this.getHeaders(),
    });

    // 201 Created или 405 Method Not Allowed (уже существует) — считаем успехом
    return response.ok || response.status === 405;
  }

  /**
   * Пишет файл на WebDAV.
   */
  async putFile(webdavPath: string, data: Blob | ArrayBuffer | string): Promise<boolean> {
    const url = this.fullUrl(webdavPath);
    const body = typeof data === 'string' ? data : new Blob([data]);

    const response = await fetch(url, {
      method: 'PUT',
      headers: this.getHeaders(),
      body,
    });

    return response.ok;
  }

  /**
   * Удаляет файл с WebDAV.
   */
  async deleteFile(webdavPath: string): Promise<boolean> {
    const url = this.fullUrl(webdavPath);
    const response = await fetch(url, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    return response.ok || response.status === 404; // 404 = уже удалён
  }

  /**
   * Проверяет существование файла (через HEAD).
   */
  async fileExists(webdavPath: string): Promise<boolean> {
    const url = this.fullUrl(webdavPath);
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        headers: this.getHeaders(),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Создаёт все необходимые поддиректории.
   */
  async ensureDirectoryPath(webdavPath: string): Promise<boolean> {
    const parts = webdavPath.split('/').filter(Boolean);
    let currentPath = '';

    for (const part of parts) {
      currentPath += '/' + part;
      try {
        await this.createDirectory(currentPath);
      } catch {
        // Игнорируем ошибки создания существующих директорий
      }
    }

    return true;
  }
}
