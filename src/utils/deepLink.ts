/**
 * Deep-linking через URLPattern API.
 *
 * Позволяет открыть приложение по прямой ссылке:
 *   - `index.html?note=<id>`                       — открыть заметку по id;
 *   - `index.html?view=search&q=<query>&tags=<t1,t2>&op=<AND|OR|NOT>&empty=1`
 *                                                   — открыть страницу поиска
 *                                                     с предзаполненными фильтрами.
 *
 * Работает только в packaged-сборке (см. `flags.deepLinking`). Все значения,
 * приходящие из URL, считаются недоверенными и проходят строгую санитизацию
 * для защиты от инъекций (XSS через content, path traversal в id,
 * prototype pollution в ключах query, переполнение длинными строками).
 */

import { SavedFilter } from '../types';

/** Максимальная длина текстовой строки, принимаемой из URL. */
const MAX_STRING_LENGTH = 256;
/** Максимальная длина id заметки. */
const MAX_ID_LENGTH = 512;
/** Максимальное число тегов в фильтре поиска. */
const MAX_TAGS = 32;
/** Максимальная длина одного тега. */
const MAX_TAG_LENGTH = 128;

type TagOperator = 'AND' | 'OR' | 'NOT';
const VALID_OPERATORS: readonly TagOperator[] = ['AND', 'OR', 'NOT'] as const;

/** Ключи, использование которых грозит prototype pollution. */
const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

export type DeepLinkTarget =
  | { kind: 'note'; noteId: string }
  | { kind: 'search'; filter: SavedFilter }
  | null;

/**
 * Безопасно декодирует значение из URL.
 * Возвращает null, если строка отсутствует, слишком длинная, содержит
 * управляющие символы / null-byte, либо не может быть декодирована.
 */
function safeDecode(raw: string | null | undefined, maxLength: number): string | null {
  if (raw == null) return null;
  // Ограничиваем ещё до decode, чтобы не тратить ресурсы на «бомбы».
  if (raw.length > maxLength * 4) return null;

  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    // Битый %-encoding.
    return null;
  }

  if (decoded.length === 0 || decoded.length > maxLength) return null;

  // Отсекаем null-byte и управляющие символы (кроме обычного пробела).
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(decoded)) return null;

  return decoded;
}

/**
 * Санитизирует id заметки. Помимо базовой проверки строки запрещает
 * последовательности path traversal и обратные слэши.
 */
export function sanitizeNoteId(raw: string | null | undefined): string | null {
  const value = safeDecode(raw, MAX_ID_LENGTH);
  if (value === null) return null;

  // Защита от path traversal и абсолютных путей.
  if (value.includes('..')) return null;
  if (value.includes('\\')) return null;
  if (value.startsWith('/')) return null;

  // Никогда не должен совпадать с «ядовитыми» ключами.
  if (DANGEROUS_KEYS.has(value)) return null;

  return value;
}

/** Санитизирует поисковый запрос (свободный текст). */
export function sanitizeQuery(raw: string | null | undefined): string {
  const value = safeDecode(raw, MAX_STRING_LENGTH);
  return value ?? '';
}

/** Приводит оператор к whitelist-значению, по умолчанию AND. */
export function sanitizeOperator(raw: string | null | undefined): TagOperator {
  const value = safeDecode(raw, 8);
  if (value && (VALID_OPERATORS as readonly string[]).includes(value)) {
    return value as TagOperator;
  }
  return 'AND';
}

/**
 * Санитизирует список тегов из строки вида `t1,t2,t3`.
 * Отбрасывает пустые, слишком длинные, «ядовитые» и содержащие path traversal
 * теги; ограничивает общее число тегов.
 */
export function sanitizeTags(raw: string | null | undefined): string[] {
  const value = safeDecode(raw, MAX_STRING_LENGTH * MAX_TAGS);
  if (value === null) return [];

  const result: string[] = [];
  const seen = new Set<string>();

  for (const part of value.split(',')) {
    const tag = part.trim();
    if (!tag) continue;
    if (tag.length > MAX_TAG_LENGTH) continue;
    if (tag.includes('..')) continue;
    if (DANGEROUS_KEYS.has(tag)) continue;
    if (seen.has(tag)) continue;

    seen.add(tag);
    result.push(tag);

    if (result.length >= MAX_TAGS) break;
  }

  return result;
}

/**
 * Разбирает `search`-компонент текущего URL и определяет цель deep-link.
 * Использует URLPattern API для сопоставления. Никогда не бросает исключений —
 * при любой ошибке или отсутствии совпадения возвращает null.
 */
export function parseDeepLink(search: string = window.location.search): DeepLinkTarget {
  // URLPattern может отсутствовать (старые браузеры) — тогда deep-link выключен.
  if (typeof URLPattern === 'undefined') return null;
  if (!search || search === '?') return null;

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search);
  } catch {
    return null;
  }

  try {
    // Шаблон заметки: ?note=<id> (view отсутствует или не search).
    const notePattern = new URLPattern({ search: 'note=:noteId*' });
    const searchPattern = new URLPattern({ search: 'view=search*' });

    const isSearchView = searchPattern.test({ search });
    const hasNote = notePattern.test({ search });

    if (isSearchView) {
      return buildSearchTarget(params);
    }

    if (hasNote) {
      const noteId = sanitizeNoteId(params.get('note'));
      if (noteId) {
        return { kind: 'note', noteId };
      }
    }
  } catch {
    // Любая ошибка URLPattern трактуется как «нет совпадения».
    return null;
  }

  return null;
}

/** Собирает цель поиска из query-параметров. */
function buildSearchTarget(params: URLSearchParams): DeepLinkTarget {
  const searchQuery = sanitizeQuery(params.get('q'));
  const operator = sanitizeOperator(params.get('op'));
  const tags = sanitizeTags(params.get('tags'));
  const showOnlyEmptyNotes = params.get('empty') === '1';

  const filter: SavedFilter = {
    id: 'deep-link',
    label: 'Deep link',
    searchQuery,
    tagFilters: tags.map(path => ({ path, operator })),
    showOnlyEmptyNotes,
  };

  // Если нет ни одного значимого критерия — не открываем поиск.
  if (!searchQuery && tags.length === 0 && !showOnlyEmptyNotes) {
    return null;
  }

  return { kind: 'search', filter };
}

/**
 * Формирует URL для заметки (используется при history.pushState).
 * Возвращает относительный URL с корректно закодированным id.
 */
export function buildNoteUrl(noteId: string, pathname: string = window.location.pathname): string {
  const params = new URLSearchParams();
  params.set('note', noteId);
  return `${pathname}?${params.toString()}`;
}

/** Формирует «чистый» URL без deep-link параметров (при закрытии заметки). */
export function buildBaseUrl(pathname: string = window.location.pathname): string {
  return pathname;
}
