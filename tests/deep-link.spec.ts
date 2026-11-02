import { test, expect } from '@playwright/test';

/**
 * Unit-тесты для парсера/санитайзера deep-link (src/utils/deepLink.ts).
 *
 * Модуль загружается через Vite dev-сервер (`/src/utils/deepLink.ts`), что даёт
 * реальную транспиляцию TypeScript и нативный URLPattern API в Chromium.
 * Тесты проверяют корректный парсинг и защиту от инъекций.
 */

// Тип публичного API модуля deep-link (для типизации в тестах).
type DeepLinkModule = {
  sanitizeNoteId: (raw: string | null | undefined) => string | null;
  sanitizeQuery: (raw: string | null | undefined) => string;
  sanitizeOperator: (raw: string | null | undefined) => 'AND' | 'OR' | 'NOT';
  sanitizeTags: (raw: string | null | undefined) => string[];
  parseDeepLink: (search?: string) => unknown;
};

// Хелпер: выполняет функцию модуля в контексте страницы.
// Модуль загружается динамически с dev-сервера Vite (транспилируется на лету).
async function evalDeepLink<T>(
  page: import('@playwright/test').Page,
  fn: (mod: DeepLinkModule, arg: string) => T,
  arg: string,
): Promise<T> {
  return page.evaluate(
    async ({ fnStr, arg }) => {
      // Путь скрыт в переменной, чтобы TS не пытался резолвить модуль статически.
      const modPath = '/src/utils/deepLink.ts';
      const mod = await import(/* @vite-ignore */ modPath);
      // eslint-disable-next-line no-new-func
      const runner = new Function('mod', 'arg', `return (${fnStr})(mod, arg);`);
      return runner(mod, arg);
    },
    { fnStr: fn.toString(), arg },
  );
}

test.describe('deepLink sanitizers', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('URLPattern доступен в окружении', async ({ page }) => {
    const hasURLPattern = await page.evaluate(() => typeof URLPattern !== 'undefined');
    expect(hasURLPattern).toBe(true);
  });

  test.describe('sanitizeNoteId', () => {
    test('принимает нормальный id', async ({ page }) => {
      const result = await evalDeepLink(page, (mod, arg) => mod.sanitizeNoteId(arg), 'Notebook/my-note.html');
      expect(result).toBe('Notebook/my-note.html');
    });

    test('отклоняет path traversal (..)', async ({ page }) => {
      const result = await evalDeepLink(page, (mod, arg) => mod.sanitizeNoteId(arg), '../../etc/passwd');
      expect(result).toBeNull();
    });

    test('отклоняет закодированный path traversal', async ({ page }) => {
      const result = await evalDeepLink(page, (mod, arg) => mod.sanitizeNoteId(arg), '%2e%2e%2f%2e%2e%2fetc');
      expect(result).toBeNull();
    });

    test('отклоняет обратные слэши', async ({ page }) => {
      const result = await evalDeepLink(page, (mod, arg) => mod.sanitizeNoteId(arg), 'foo\\bar');
      expect(result).toBeNull();
    });

    test('отклоняет абсолютный путь', async ({ page }) => {
      const result = await evalDeepLink(page, (mod, arg) => mod.sanitizeNoteId(arg), '/etc/passwd');
      expect(result).toBeNull();
    });

    test('отклоняет __proto__', async ({ page }) => {
      const result = await evalDeepLink(page, (mod, arg) => mod.sanitizeNoteId(arg), '__proto__');
      expect(result).toBeNull();
    });

    test('отклоняет null-byte', async ({ page }) => {
      const result = await evalDeepLink(page, (mod, arg) => mod.sanitizeNoteId(arg), 'note%00.html');
      expect(result).toBeNull();
    });

    test('отклоняет чрезмерно длинную строку', async ({ page }) => {
      const result = await evalDeepLink(page, (mod, arg) => mod.sanitizeNoteId(arg), 'a'.repeat(5000));
      expect(result).toBeNull();
    });

    test('отклоняет битый %-encoding', async ({ page }) => {
      const result = await evalDeepLink(page, (mod, arg) => mod.sanitizeNoteId(arg), '%E0%A4%A');
      expect(result).toBeNull();
    });

    test('не исполняет XSS, возвращает как строку', async ({ page }) => {
      const result = await evalDeepLink(
        page,
        (mod, arg) => mod.sanitizeNoteId(arg),
        '<script>alert(1)</script>',
      );
      // Строка без .. / \ и не является ключом-ловушкой — возвращается как есть,
      // но при этом никогда не интерпретируется как HTML (валидация по наличию
      // в notesStore не даст открыть несуществующую заметку).
      expect(result).toBe('<script>alert(1)</script>');
    });
  });

  test.describe('sanitizeOperator', () => {
    test('принимает AND/OR/NOT', async ({ page }) => {
      expect(await evalDeepLink(page, (mod, arg) => mod.sanitizeOperator(arg), 'AND')).toBe('AND');
      expect(await evalDeepLink(page, (mod, arg) => mod.sanitizeOperator(arg), 'OR')).toBe('OR');
      expect(await evalDeepLink(page, (mod, arg) => mod.sanitizeOperator(arg), 'NOT')).toBe('NOT');
    });

    test('неизвестное значение -> AND', async ({ page }) => {
      expect(await evalDeepLink(page, (mod, arg) => mod.sanitizeOperator(arg), 'XOR')).toBe('AND');
      expect(await evalDeepLink(page, (mod, arg) => mod.sanitizeOperator(arg), 'and')).toBe('AND');
      expect(await evalDeepLink(page, (mod, arg) => mod.sanitizeOperator(arg), '')).toBe('AND');
    });
  });

  test.describe('sanitizeTags', () => {
    test('разбирает список тегов', async ({ page }) => {
      const result = await evalDeepLink(page, (mod, arg) => mod.sanitizeTags(arg), 'work,home/todo, urgent');
      expect(result).toEqual(['work', 'home/todo', 'urgent']);
    });

    test('убирает дубликаты и пустые', async ({ page }) => {
      const result = await evalDeepLink(page, (mod, arg) => mod.sanitizeTags(arg), 'a,,a,b,');
      expect(result).toEqual(['a', 'b']);
    });

    test('отбрасывает теги с path traversal и __proto__', async ({ page }) => {
      const result = await evalDeepLink(page, (mod, arg) => mod.sanitizeTags(arg), 'ok,../evil,__proto__,fine');
      expect(result).toEqual(['ok', 'fine']);
    });

    test('ограничивает количество тегов', async ({ page }) => {
      const many = Array.from({ length: 100 }, (_, i) => `t${i}`).join(',');
      const result = await evalDeepLink(page, (mod, arg) => mod.sanitizeTags(arg), many);
      expect(result.length).toBeLessThanOrEqual(32);
    });
  });

  test.describe('parseDeepLink', () => {
    test('распознаёт note', async ({ page }) => {
      const result = await evalDeepLink(page, (mod, arg) => mod.parseDeepLink(arg), '?note=My%2Fnote.html');
      expect(result).toEqual({ kind: 'note', noteId: 'My/note.html' });
    });

    test('распознаёт search с параметрами', async ({ page }) => {
      const result = await evalDeepLink(
        page,
        (mod, arg) => mod.parseDeepLink(arg),
        '?view=search&q=hello&tags=a,b&op=OR&empty=1',
      );
      expect(result).toEqual({
        kind: 'search',
        filter: {
          id: 'deep-link',
          label: 'Deep link',
          searchQuery: 'hello',
          tagFilters: [
            { path: 'a', operator: 'OR' },
            { path: 'b', operator: 'OR' },
          ],
          showOnlyEmptyNotes: true,
        },
      });
    });

    test('пустой search -> null', async ({ page }) => {
      expect(await evalDeepLink(page, (mod, arg) => mod.parseDeepLink(arg), '')).toBeNull();
      expect(await evalDeepLink(page, (mod, arg) => mod.parseDeepLink(arg), '?')).toBeNull();
    });

    test('search без критериев -> null', async ({ page }) => {
      const result = await evalDeepLink(page, (mod, arg) => mod.parseDeepLink(arg), '?view=search');
      expect(result).toBeNull();
    });

    test('посторонние параметры игнорируются', async ({ page }) => {
      const result = await evalDeepLink(page, (mod, arg) => mod.parseDeepLink(arg), '?foo=bar&baz=qux');
      expect(result).toBeNull();
    });

    test('note с path traversal -> null', async ({ page }) => {
      const result = await evalDeepLink(page, (mod, arg) => mod.parseDeepLink(arg), '?note=../../secret');
      expect(result).toBeNull();
    });
  });
});
