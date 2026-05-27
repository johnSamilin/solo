// ============================================================
// Утилиты для P2P-синхронизации
// ============================================================

/**
 * Генерирует уникальный Device ID при первом запуске.
 * Хранится в localStorage.
 */
export function getOrCreateDeviceId(): string {
  const key = 'solo-device-id';
  let deviceId = localStorage.getItem(key);
  if (!deviceId) {
    deviceId = `solo-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(key, deviceId);
  }
  return deviceId;
}

/**
 * Генерирует или возвращает имя устройства.
 */
export function getOrCreateDeviceName(): string {
  const key = 'solo-device-name';
  let name = localStorage.getItem(key);
  if (!name) {
    // Пытаемся получить hostname
    try {
      name = window.location.hostname || 'Solo Device';
    } catch {
      name = 'Solo Device';
    }
    localStorage.setItem(key, name);
  }
  return name;
}

/**
 * Сохраняет имя устройства.
 */
export function setDeviceName(name: string): void {
  localStorage.setItem('solo-device-name', name);
}

/**
 * Вычисляет SHA-256 хэш строки (через Web Crypto API).
 */
export async function sha256(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Задержка (ms).
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Генерирует UUID v4.
 */
export function uuid(): string {
  return crypto.randomUUID();
}
