import { expect, test } from '@playwright/test';

test('the first edit to a note after launch is saved', async ({ page }) => {
  await page.addInitScript(() => {
    const files = new Map([['First note.html', '<p>Existing content</p>']]);
    (window as typeof window & { testFiles: Map<string, string> }).testFiles = files;
    (window as typeof window & { noteReadCount: number }).noteReadCount = 0;
    (window as typeof window & { electronAPI: unknown }).electronAPI = {
      readStructure: async () => ({ success: true, structure: [{
        name: 'First note.html', path: 'First note.html', type: 'file',
        metadata: { id: 'First note.html', tags: [], createdAt: '2025-01-01' },
      }] }),
      openFile: async (path: string) => {
        (window as typeof window & { noteReadCount: number }).noteReadCount++;
        return { success: true, content: files.get(path) };
      },
      updateFile: async (path: string, content: string) => {
        files.set(path, content);
        return { success: true };
      },
      updateMetadata: async () => ({ success: true }),
      getDataFolder: async () => ({ success: true, path: '/test' }),
      scanAllTags: async () => ({ success: true, tags: [] }),
    };
  });

  await page.goto('/');
  await page.locator('.note-item').filter({ hasText: 'First note' }).click();
  const editor = page.locator('.tiptap').first();
  await expect(editor).toContainText('Existing content');
  await editor.click();
  await page.keyboard.type(' First change');
  await expect(editor).toContainText('First change');
  await expect.poll(() => page.evaluate(() =>
    (window as typeof window & { testFiles: Map<string, string> }).testFiles.get('First note.html'),
  )).toContain('First change');
  // Editing must not mark the note unloaded and fetch its old content again.
  await page.waitForTimeout(700);
  expect(await page.evaluate(() => (window as typeof window & { noteReadCount: number }).noteReadCount)).toBe(1);
});

test('the first edit to a newly created note after launch is saved', async ({ page }) => {
  await page.addInitScript(() => {
    const files = new Map<string, string>();
    (window as typeof window & { testFiles: Map<string, string> }).testFiles = files;
    (window as typeof window & { electronAPI: unknown }).electronAPI = {
      readStructure: async () => ({ success: true, structure: [] }),
      openFile: async (path: string) => ({ success: true, content: files.get(path) }),
      getDataFolder: async () => ({ success: true, path: '/test' }),
      scanAllTags: async () => ({ success: true, tags: [] }),
      createNote: async (_parent: string, name: string) => {
        const path = `${name}.html`;
        files.set(path, '');
        return { success: true, id: path, htmlPath: path };
      },
      updateFile: async (path: string, content: string) => {
        files.set(path, content);
        return { success: true };
      },
      updateMetadata: async () => ({ success: true }),
    };
  });
  await page.goto('/');
  await page.locator('.sidebar-menu-button').first().click();
  await page.getByRole('menuitem', { name: 'New Note', exact: true }).click();
  const editor = page.locator('.tiptap').first();
  await expect(editor).toBeVisible();
  await editor.click();
  await page.keyboard.type('First change');
  await expect(editor).toContainText('First change');
  await expect.poll(() => page.evaluate(() =>
    Array.from((window as typeof window & { testFiles: Map<string, string> }).testFiles.values()).join(''),
  )).toContain('First change');
  await page.keyboard.press('Escape');
  await page.locator('.note-item').first().click();
  await expect(editor).toContainText('First change');
});

test('the first voice memo after launch is inserted and saved', async ({ page }) => {
  test.skip(process.env.PLATFORM !== 'android', 'Native recording requires the Android build');
  await page.addInitScript(() => {
    const files = new Map([['First note.html', '<p>Existing content</p>']]);
    (window as typeof window & { testFiles: Map<string, string> }).testFiles = files;
    (window as typeof window & { electronAPI: unknown }).electronAPI = {
      readStructure: async () => ({ success: true, structure: [{
        name: 'First note.html', path: 'First note.html', type: 'file',
        metadata: { id: 'First note.html', tags: [], createdAt: '2025-01-01' },
      }] }),
      openFile: async (path: string) => ({ success: true, content: files.get(path) }),
      updateFile: async (path: string, content: string) => { files.set(path, content); return { success: true }; },
      updateMetadata: async () => ({ success: true }),
      getDataFolder: async () => ({ success: true, path: '/test' }),
      scanAllTags: async () => ({ success: true, tags: [] }),
      startRecording: async () => ({ success: true }),
      stopRecording: async () => ({ success: true, url: 'voice://first-memo.wav', duration: 1500 }),
    };
  });

  await page.goto('/');
  await page.locator('.note-item').filter({ hasText: 'First note' }).click();
  await expect(page.locator('.tiptap')).toContainText('Existing content');
  await page.getByTitle('Toggle toolbar').click();
  await page.getByTitle('Record Voice Memo').click();
  await page.locator('.audio-recording-overlay').getByRole('button', { name: /stop/i }).click();
  await expect.poll(() => page.evaluate(() =>
    (window as typeof window & { testFiles: Map<string, string> }).testFiles.get('First note.html'),
  )).toContain('first-memo.wav');
});

test('the first video memo after launch is inserted and saved', async ({ page }) => {
  test.skip(process.env.PLATFORM !== 'android', 'Native recording requires the Android build');
  await page.addInitScript(() => {
    const files = new Map([['First note.html', '<p>Existing content</p>']]);
    (window as typeof window & { testFiles: Map<string, string> }).testFiles = files;
    (window as typeof window & { electronAPI: unknown }).electronAPI = {
      readStructure: async () => ({ success: true, structure: [{
        name: 'First note.html', path: 'First note.html', type: 'file',
        metadata: { id: 'First note.html', tags: [], createdAt: '2025-01-01' },
      }] }),
      openFile: async (path: string) => ({ success: true, content: files.get(path) }),
      updateFile: async (path: string, content: string) => { files.set(path, content); return { success: true }; },
      updateMetadata: async () => ({ success: true }),
      getDataFolder: async () => ({ success: true, path: '/test' }),
      scanAllTags: async () => ({ success: true, tags: [] }),
      startVideoRecording: async () => ({ success: true }),
      stopVideoRecording: async () => {
        window.__soloVideoRecordingResult?.(JSON.stringify({
          success: true, url: 'video://first-memo.mp4', duration: 1500,
        }));
        return { success: true };
      },
    };
  });

  await page.goto('/');
  await page.locator('.note-item').filter({ hasText: 'First note' }).click();
  await expect(page.locator('.tiptap')).toContainText('Existing content');
  await page.getByTitle('Toggle toolbar').click();
  await page.getByTitle('Record Video Memo').click();
  await page.getByTitle(/Recording… .*s/).evaluate((button: HTMLButtonElement) => button.click());
  await expect.poll(() => page.evaluate(() =>
    (window as typeof window & { testFiles: Map<string, string> }).testFiles.get('First note.html'),
  )).toContain('first-memo.mp4');
});

test('the editor cannot accept an edit until the first note finishes loading', async ({ page }) => {
  await page.addInitScript(() => {
    const files = new Map([['First note.html', '<p>Existing content</p>']]);
    (window as typeof window & { testFiles: Map<string, string> }).testFiles = files;
    (window as typeof window & { releaseNoteLoad: () => void }).releaseNoteLoad = () => {};
    (window as typeof window & { electronAPI: unknown }).electronAPI = {
      readStructure: async () => ({ success: true, structure: [{
        name: 'First note.html', path: 'First note.html', type: 'file',
        metadata: { id: 'First note.html', tags: [], createdAt: '2025-01-01' },
      }] }),
      openFile: (path: string) => new Promise(resolve => {
        (window as typeof window & { releaseNoteLoad: () => void }).releaseNoteLoad =
          () => resolve({ success: true, content: files.get(path) });
      }),
      updateFile: async (path: string, content: string) => { files.set(path, content); return { success: true }; },
      updateMetadata: async () => ({ success: true }),
      getDataFolder: async () => ({ success: true, path: '/test' }),
      scanAllTags: async () => ({ success: true, tags: [] }),
    };
  });
  await page.goto('/');
  await page.locator('.note-item').filter({ hasText: 'First note' }).click();
  const editor = page.locator('.tiptap').first();
  await expect(editor).not.toBeVisible();
  await page.evaluate(() => (window as typeof window & { releaseNoteLoad: () => void }).releaseNoteLoad());
  await expect(editor).toContainText('Existing content');
  await editor.click();
  await page.keyboard.type('First change');
  await expect(editor).toContainText('First change');
  await expect.poll(() => page.evaluate(() =>
    (window as typeof window & { testFiles: Map<string, string> }).testFiles.get('First note.html'),
  )).toContain('First change');
});
