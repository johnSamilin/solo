import { expect, test, type Page } from '@playwright/test';

async function openNote(page: Page, content = '<p>Pastel marker sample</p>') {
  await page.addInitScript(({ html }) => {
    const files = new Map([['Marker note.html', html]]);
    (window as typeof window & { highlightFiles: Map<string, string> }).highlightFiles = files;
    (window as typeof window & { electronAPI: object }).electronAPI = {
      readStructure: async () => ({ success: true, structure: [{
        name: 'Marker note.html', path: 'Marker note.html', type: 'file',
        metadata: { id: 'Marker note.html', tags: [], createdAt: '2025-01-01' },
      }] }),
      openFile: async (path: string) => ({ success: true, content: files.get(path) }),
      updateFile: async (path: string, updated: string) => {
        files.set(path, updated);
        return { success: true };
      },
      updateMetadata: async () => ({ success: true }),
      getDataFolder: async () => ({ success: true, path: '/test' }),
      scanAllTags: async () => ({ success: true, tags: [] }),
    };
  }, { html: content });
  await page.goto('/');
  await page.locator('.note-item').filter({ hasText: 'Marker note' }).click();
  const editor = page.locator('.tiptap').first();
  await expect(editor).toContainText('Pastel marker sample');
  return editor;
}

async function selectParagraph(page: Page) {
  await page.locator('.tiptap p').first().click();
  await page.keyboard.press('Home');
  await page.keyboard.down('Shift');
  await page.keyboard.press('End');
  await page.keyboard.up('Shift');
}

test('highlight a selection with one of six pastel colors and persist it after reopening', async ({ page }) => {
  const editor = await openNote(page);
  await selectParagraph(page);
  await page.getByTitle('Toggle toolbar').click();
  await page.getByTitle('Highlight text').click();
  await expect(page.locator('.highlight-swatch')).toHaveCount(6);
  await page.getByTitle('Highlight pink').click();

  const mark = editor.locator('mark[data-highlight-color="pink"]');
  await expect(mark).toHaveText('Pastel marker sample');
  await expect(mark).toHaveCSS('background-color', 'rgb(255, 217, 230)');
  await expect.poll(() => page.evaluate(() => (window as typeof window & {
    highlightFiles: Map<string, string>;
  }).highlightFiles.get('Marker note.html'))).toContain('data-highlight-color="pink"');

  await page.keyboard.press('Escape');
  await page.locator('.note-item').filter({ hasText: 'Marker note' }).click();
  await expect(editor.locator('mark[data-highlight-color="pink"]')).toHaveText('Pastel marker sample');
});

test('change and remove a highlight without altering the text', async ({ page }) => {
  const editor = await openNote(page);
  await selectParagraph(page);
  await page.getByTitle('Toggle toolbar').click();
  await page.getByTitle('Highlight text').click();
  await page.getByTitle('Highlight yellow').click();
  await expect(editor.locator('mark[data-highlight-color="yellow"]')).toBeVisible();

  await selectParagraph(page);
  await page.getByTitle('Toggle toolbar').click();
  await page.getByTitle('Highlight text').click();
  await page.getByTitle('Highlight mint').click();
  await expect(editor.locator('mark[data-highlight-color="mint"]')).toHaveText('Pastel marker sample');
  await expect(editor.locator('mark[data-highlight-color="yellow"]')).toHaveCount(0);

  await selectParagraph(page);
  await page.getByTitle('Toggle toolbar').click();
  await page.getByTitle('Highlight text').click();
  await page.getByTitle('Remove highlight').click();
  await expect(editor.locator('mark')).toHaveCount(0);
  await expect(editor).toContainText('Pastel marker sample');
});

test('highlight only the selected words, not the rest of the paragraph', async ({ page }) => {
  const editor = await openNote(page);
  await editor.locator('p').click();
  await page.keyboard.press('Home');
  await page.keyboard.down('Shift');
  for (let i = 0; i < 'Pastel'.length; i++) {
    await page.keyboard.press('ArrowRight');
  }
  await page.keyboard.up('Shift');

  await page.getByTitle('Toggle toolbar').click();
  await page.getByTitle('Highlight text').click();
  await page.getByTitle('Highlight lavender').click();
  await expect(editor.locator('mark[data-highlight-color="lavender"]')).toHaveText('Pastel');
  await expect(editor.locator('mark')).toHaveCount(1);
  await expect(editor).toContainText('Pastel marker sample');
});

test('an unknown highlight color in stored HTML falls back to a safe preset', async ({ page }) => {
  const editor = await openNote(
    page,
    '<p><mark data-highlight-color="unsafe" style="background-image: url(http://127.0.0.1:9/test)">Pastel</mark> marker sample</p>',
  );
  const mark = editor.locator('mark');
  await expect(mark).toHaveAttribute('data-highlight-color', 'yellow');
  await expect(mark).toHaveCSS('background-color', 'rgb(255, 243, 166)');
  await expect(mark).not.toHaveAttribute('style', /background-image/);
});

test.describe('phone-sized editor', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('the highlight palette is reachable without leaving the screen', async ({ page }) => {
    const editor = await openNote(page);
    // The existing pinned sidebar leaves too little editor space on narrow screens.
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Settings' }).click();
    await page.locator('.modal-tab').filter({ hasText: 'Layout' }).click();
    await page.locator('.setting-item').filter({ hasText: 'Pin Sidebar' }).locator('input').uncheck();
    await page.locator('.modal-header button').click();
    await selectParagraph(page);
    await page.getByTitle('Toggle toolbar').click();
    await page.getByTitle('Highlight text').click();
    const palette = page.locator('.highlight-palette');
    const bounds = await palette.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    await page.getByTitle('Highlight sky').click();
    await expect(editor.locator('mark[data-highlight-color="sky"]')).toContainText('sample');
  });
});
