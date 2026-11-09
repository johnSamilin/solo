import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

async function mockShareTarget(page: Page, startupShare = '') {
  await page.addInitScript(({ initialShare }) => {
    let pendingShare = initialShare;
    const files = new Map<string, string>();
    const metadata = new Map<string, { tags: string[]; sourceUrl?: string }>();
    const fetches: string[] = [];
    const structure = [{
      name: 'Reading', path: 'Reading', type: 'folder', children: [{
        name: 'Tech', path: 'Reading/Tech', type: 'folder', children: [] as Array<{
          name: string; path: string; type: string; metadata?: object;
        }>,
      }],
    }];

    (window as typeof window & { shareTest: object }).shareTest = {
      files, metadata, fetches,
      deliver(text: string) {
        pendingShare = text;
        (window as typeof window & { __soloReceiveShare?: () => void }).__soloReceiveShare?.();
      },
    };
    (window as typeof window & { SoloBridge: object }).SoloBridge = {
      consumePendingShare: () => {
        const text = pendingShare;
        pendingShare = '';
        return text;
      },
    };
    (window as typeof window & { electronAPI: object }).electronAPI = {
      readStructure: async () => ({ success: true, structure }),
      getDataFolder: async () => ({ success: true, path: '/test' }),
      scanAllTags: async () => ({ success: true, tags: [] }),
      fetchUrl: async (url: string) => {
        fetches.push(url);
        return { success: true, content: '<html><head><title>Test article</title></head><body><article><p>A readable article with enough text to be saved for later reading, including its original source link.</p></article></body></html>' };
      },
      createNote: async (parent: string, title: string) => {
        const htmlPath = `${parent ? `${parent}/` : ''}${title}.html`;
        files.set(htmlPath, '');
        structure[0].children[0].children.push({ name: `${title}.html`, path: htmlPath, type: 'file' });
        return { success: true, id: htmlPath, htmlPath };
      },
      updateFile: async (path: string, content: string) => {
        files.set(path, content);
        return { success: true };
      },
      renameNote: async (path: string, title: string) => {
        const newPath = path.replace(/[^/]+\.html$/, `${title}.html`);
        files.set(newPath, files.get(path) || '');
        files.delete(path);
        const node = structure[0].children[0].children.find(item => item.path === path);
        if (node) {
          node.name = `${title}.html`;
          node.path = newPath;
        }
        return { success: true, newPath };
      },
      updateMetadata: async (path: string, data: { tags: string[]; sourceUrl?: string }) => {
        metadata.set(path, data);
        return { success: true };
      },
      openFile: async (path: string) => ({ success: true, content: files.get(path) || '' }),
    };
  }, { initialShare: startupShare });
}

test('Android registers as a share target for links', () => {
  const manifest = readFileSync(resolve(process.cwd(), 'native-clients/android/app/src/main/AndroidManifest.xml'), 'utf8');
  expect(manifest).toContain('android.intent.action.SEND');
  expect(manifest).toContain('android.intent.category.DEFAULT');
  expect(manifest).toContain('android:mimeType="text/plain"');
});

test('a shared link on cold start can be saved to a nested notebook', async ({ page }) => {
  test.skip(process.env.PLATFORM !== 'android', 'Requires the Android WebView build');
  await mockShareTarget(page, 'Test article\nhttps://example.com/story');
  await page.goto('/');

  const modal = page.locator('.modal').filter({ hasText: 'Read Later' });
  await expect(modal.locator('input[type=url]')).toHaveValue('https://example.com/story');
  await expect(modal.locator('select')).toContainText('Reading/Tech');
  await modal.locator('select').selectOption('Reading/Tech');
  expect(await page.evaluate(() => Array.from((window as typeof window & {
    shareTest: { files: Map<string, string> };
  }).shareTest.files.keys()))).toEqual([]);
  await modal.locator('button[type=submit]').click();

  await expect.poll(() => page.evaluate(() => {
    const state = (window as typeof window & {
      shareTest: { files: Map<string, string>; metadata: Map<string, { tags: string[]; sourceUrl?: string }>; fetches: string[] };
    }).shareTest;
    const path = Array.from(state.files.keys())[0];
    return { path, content: state.files.get(path), metadata: state.metadata.get(path), fetches: state.fetches };
  })).toMatchObject({
    path: 'Reading/Tech/Test article.html',
    content: expect.stringContaining('A readable article'),
    metadata: { tags: ['Unread'], sourceUrl: 'https://example.com/story' },
    fetches: ['https://example.com/story'],
  });
});

test('a link shared while Solo is open replaces clipboard-prefilled text', async ({ page }) => {
  test.skip(process.env.PLATFORM !== 'android', 'Requires the Android WebView build');
  await mockShareTarget(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { readText: async () => 'https://example.com/clipboard' },
  }));
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('menuitem', { name: /Read later/i }).click();
  await expect(page.locator('.modal input[type=url]')).toHaveValue('https://example.com/clipboard');

  await page.evaluate(() => (window as typeof window & {
    shareTest: { deliver: (text: string) => void };
  }).shareTest.deliver('https://example.com/second'));

  await expect(page.locator('.modal input[type=url]')).toHaveValue('https://example.com/second');
  await expect(page.locator('.modal select')).toHaveValue('');
});

test('sharing plain text without a URL cannot save a page', async ({ page }) => {
  test.skip(process.env.PLATFORM !== 'android', 'Requires the Android WebView build');
  await mockShareTarget(page, 'A message without a link');
  await page.goto('/');

  await expect(page.locator('.modal')).toContainText('Enter a valid http(s) URL');
  await page.locator('.modal button[type=submit]').click();
  expect(await page.evaluate(() => (window as typeof window & {
    shareTest: { fetches: string[]; files: Map<string, string> };
  }).shareTest.fetches)).toEqual([]);
});

test('choosing root overrides the focused notebook', async ({ page }) => {
  test.skip(process.env.PLATFORM !== 'android', 'Requires the Android WebView build');
  await mockShareTarget(page);
  await page.goto('/');
  await page.locator('.notebook-name').filter({ hasText: 'Tech' }).click();
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('menuitem', { name: /Read later/i }).click();

  const modal = page.locator('.modal');
  await expect(modal.locator('select')).toHaveValue('Reading/Tech');
  await modal.locator('select').selectOption('');
  await modal.locator('input[type=url]').fill('https://example.com/story');
  await modal.locator('button[type=submit]').click();

  await expect.poll(() => page.evaluate(() => Array.from((window as typeof window & {
    shareTest: { files: Map<string, string> };
  }).shareTest.files.keys()))).toContain('Test article.html');
});
