import { expect, test, type Page } from '@playwright/test';

const SETTINGS = JSON.stringify({
  settings: {
    editorFontFamily: 'UMTypewriter', editorFontSize: '1rem', editorLineHeight: '2',
    titleFontFamily: 'UMTypewriter', titleFontSize: '1.25rem', sidebarFontFamily: 'UMTypewriter',
    sidebarFontSize: '0.875rem', pageMargins: '2rem', paragraphSpacing: '1em',
    enableDropCaps: false, dropCapSize: '3.5em', dropCapLineHeight: '3.5',
    maxEditorWidth: '90%', sidebarPinned: true, typewriterSound: 'typewriter', autoZenMode: false,
  },
  digikamDbPath: '/photos/digikam4.db', selectedTheme: null,
});

async function openNote(page: Page) {
  await page.goto('/');
  await page.locator('.note-item').first().click();
  await expect(page.locator('.tiptap')).toContainText('A note');
  await page.getByTitle('Toggle toolbar').click();
  await page.getByTitle('Insert Image').click();
}

test('desktop: files under the digiKam root become a linked carousel, others are uploaded', async ({ page }) => {
  test.skip(process.env.PLATFORM === 'android', 'Desktop attach-images flow');
  await page.addInitScript(({ settings }) => {
    const files = new Map([['note.html', '<p>A note</p>']]);
    (window as typeof window & { electronAPI: object }).electronAPI = {
      getPathForFile: (file: File) => `/picked/${file.name}`,
      attachImages: async (_db: string, paths: string[]) => ({
        success: true,
        images: paths.map(path => path.includes('inside')
          ? { linked: true, url: `file://${path}` }
          : { linked: false, url: `image://copy-${path.split('/').pop()}` }),
      }),
      readStructure: async () => ({ success: true, structure: [{
        name: 'note.html', path: 'note.html', type: 'file',
        metadata: { id: 'note.html', tags: [], createdAt: '2026-01-01' },
      }] }),
      openFile: async (path: string) => ({ success: true, content: files.get(path) }),
      updateFile: async (path: string, content: string) => { files.set(path, content); return { success: true }; },
      updateMetadata: async () => ({ success: true }),
      getDataFolder: async () => ({ success: true, path: '/notes' }),
      scanAllTags: async () => ({ success: true, tags: [] }),
    };
    localStorage.setItem('solo-settings', settings);
  }, { settings: SETTINGS });

  await openNote(page);
  await page.locator('input[type=file]').setInputFiles([
    { name: 'inside.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('a') },
    { name: 'outside.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('b') },
  ]);

  await expect(page.locator('.tiptap [data-type="carousel"] img')).toHaveCount(1);
  await expect(page.locator('.tiptap [data-type="carousel"] img')).toHaveAttribute('src', 'file:///picked/inside.jpg');
  await expect(page.locator('.tiptap img[src="image://copy-outside.jpg"]')).toHaveCount(1);
});

test('desktop: multiple non-root files are uploaded as a carousel', async ({ page }) => {
  test.skip(process.env.PLATFORM === 'android', 'Desktop attach-images flow');
  await page.addInitScript(({ settings }) => {
    const files = new Map([['note.html', '<p>A note</p>']]);
    (window as typeof window & { electronAPI: object }).electronAPI = {
      getPathForFile: (file: File) => `/tmp/${file.name}`,
      attachImages: async (_db: string, paths: string[]) => ({
        success: true,
        images: paths.map((path, index) => ({ linked: false, url: `image://copy-${index}.jpg` })),
      }),
      readStructure: async () => ({ success: true, structure: [{
        name: 'note.html', path: 'note.html', type: 'file',
        metadata: { id: 'note.html', tags: [], createdAt: '2026-01-01' },
      }] }),
      openFile: async (path: string) => ({ success: true, content: files.get(path) }),
      updateFile: async (path: string, content: string) => { files.set(path, content); return { success: true }; },
      updateMetadata: async () => ({ success: true }),
      getDataFolder: async () => ({ success: true, path: '/notes' }),
      scanAllTags: async () => ({ success: true, tags: [] }),
    };
    localStorage.setItem('solo-settings', settings);
  }, { settings: SETTINGS });

  await openNote(page);
  await page.locator('input[type=file]').setInputFiles([
    { name: 'one.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('1') },
    { name: 'two.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('2') },
  ]);

  await expect(page.locator('.tiptap [data-type="carousel"] img')).toHaveCount(2);
  await expect(page.locator('.tiptap [data-type="carousel"] img[src="image://copy-0.jpg"]')).toHaveCount(1);
  await expect(page.locator('.tiptap [data-type="carousel"] img[src="image://copy-1.jpg"]')).toHaveCount(1);
});

test('android: native picker links digiKam photos and uploads the rest', async ({ page }) => {
  test.skip(process.env.PLATFORM !== 'android', 'Android native attach flow');
  await page.addInitScript(({ settings }) => {
    const files = new Map([['note.html', '<p>A note</p>']]);
    (window as typeof window & { electronAPI: object }).electronAPI = {
      pickImagesForAttach: async () => ({
        success: true,
        images: [
          { linked: true, url: 'digikam://solo/2026/November/Photo%20one.jpg' },
          { linked: false, url: 'image://copy-outside.jpg' },
        ],
      }),
      readStructure: async () => ({ success: true, structure: [{
        name: 'note.html', path: 'note.html', type: 'file',
        metadata: { id: 'note.html', tags: [], createdAt: '2026-01-01' },
      }] }),
      openFile: async (path: string) => ({ success: true, content: files.get(path) }),
      updateFile: async (path: string, content: string) => { files.set(path, content); return { success: true }; },
      updateMetadata: async () => ({ success: true }),
      getDataFolder: async () => ({ success: true, path: '/notes' }),
      scanAllTags: async () => ({ success: true, tags: [] }),
    };
    localStorage.setItem('solo-settings', settings);
  }, { settings: SETTINGS });

  await openNote(page);
  await page.getByRole('button', { name: 'Choose File' }).click();

  await expect(page.locator('.tiptap [data-type="carousel"] img')).toHaveAttribute('src', 'digikam://solo/2026/November/Photo%20one.jpg');
  await expect(page.locator('.tiptap img[src="image://copy-outside.jpg"]')).toHaveCount(1);
});

test('android: connect a digiKam photo folder and insert a tag carousel without copying', async ({ page }) => {
  test.skip(process.env.PLATFORM !== 'android', 'Android native digiKam only');
  await page.addInitScript(() => {
    const files = new Map([['note.html', '<p>A note</p>']]);
    let uploads = 0;
    (window as typeof window & { attachTest: object }).attachTest = { files, get uploads() { return uploads; } };
    (window as typeof window & { electronAPI: object }).electronAPI = {
      readStructure: async () => ({ success: true, structure: [{
        name: 'note.html', path: 'note.html', type: 'file',
        metadata: { id: 'note.html', tags: [], createdAt: '2026-01-01' },
      }] }),
      openFile: async (path: string) => ({ success: true, content: files.get(path) }),
      updateFile: async (path: string, content: string) => { files.set(path, content); return { success: true }; },
      updateMetadata: async () => ({ success: true }),
      getDataFolder: async () => ({ success: true, path: '/notes' }),
      scanAllTags: async () => ({ success: true, tags: [] }),
      selectDigikamFolder: async () => ({ success: true, path: '/solo/photo root/digikam4.db' }),
      getDigikamTags: async () => ({ success: true, tags: [{ id: 5, parentId: null, name: 'Travel' }] }),
      getDigikamImagesByTag: async () => ({
        success: true, digikamTag: 'Travel', images: [{ id: 10, name: 'Photo one.jpg', relativePath: '/2026/November', specificPath: '' }],
      }),
      uploadImage: async () => { uploads++; return { success: true, url: 'image://copied.jpg' }; },
    };
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('menuitem', { name: 'Settings' }).click();
  await page.locator('.modal-tab').filter({ hasText: 'Data' }).click();
  await page.locator('.data-folder-button').last().click();
  await expect(page.locator('input[value="/solo/photo root/digikam4.db"]')).toBeVisible();
  await page.locator('.modal-header button').click();
  await page.locator('.note-item').first().click();
  await expect(page.locator('.tiptap')).toContainText('A note');
  await page.getByTitle('Toggle toolbar').click();
  await page.getByTitle('Insert Image').click();
  await page.getByRole('button', { name: 'digiKam' }).click();
  await page.getByText('Travel', { exact: true }).click();
  await expect(page.locator('.tiptap [data-type="carousel"] img')).toHaveAttribute('src', 'digikam://solo/2026/November/Photo%20one.jpg');
  expect(await page.evaluate(() => (window as typeof window & { attachTest: { uploads: number } }).attachTest.uploads)).toBe(0);
});
