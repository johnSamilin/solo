import { expect, test } from '@playwright/test';

test('Zen mode does not resume after restarting the app', async ({ page }) => {
  await page.addInitScript(() => {
    (window as typeof window & { electronAPI: unknown }).electronAPI = {
      readStructure: async () => ({ success: true, structure: [{
        name: 'A note.html', path: 'A note.html', type: 'file',
        metadata: { id: 'A note.html', tags: [], createdAt: '2025-01-01' },
      }] }),
      getDataFolder: async () => ({ success: true, path: '/test' }),
      scanAllTags: async () => ({ success: true, tags: [] }),
      openFile: async () => ({ success: true, content: '<p>Some text</p>' }),
      updateMetadata: async () => ({ success: true }),
      toggleZenMode: async (enable: boolean) => ({ success: true, isZenMode: enable }),
    };
  });

  await page.goto('/');
  await page.locator('.note-item').first().click();
  await expect(page.locator('.tiptap')).toContainText('Some text');
  await page.getByTitle('Toggle toolbar').click();
  await page.getByTitle('Enter Zen Mode').click();
  await expect(page.locator('.app')).toHaveClass(/zen-mode/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('solo-settings')!).isZenMode)).toBeUndefined();

  // Simulate settings saved by an older version, where Zen mode was persisted.
  await page.evaluate(() => {
    const settings = JSON.parse(localStorage.getItem('solo-settings')!);
    settings.isZenMode = true;
    localStorage.setItem('solo-settings', JSON.stringify(settings));
  });
  await page.reload();

  await expect(page.locator('.app')).not.toHaveClass(/zen-mode/);
  await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();
});

test('Auto Zen Mode still activates when enabled', async ({ page }) => {
  await page.addInitScript(() => {
    (window as typeof window & { electronAPI: unknown }).electronAPI = {
      readStructure: async () => ({ success: true, structure: [{
        name: 'A note.html', path: 'A note.html', type: 'file',
        metadata: { id: 'A note.html', tags: [], createdAt: '2025-01-01' },
      }] }),
      getDataFolder: async () => ({ success: true, path: '/test' }),
      scanAllTags: async () => ({ success: true, tags: [] }),
      openFile: async () => ({ success: true, content: '<p>Some text</p>' }),
      updateFile: async () => ({ success: true }),
      updateMetadata: async () => ({ success: true }),
      toggleZenMode: async (enable: boolean) => ({ success: true, isZenMode: enable }),
    };
  });

  await page.goto('/');
  await page.locator('.note-item').first().click();
  const editor = page.locator('.tiptap').first();
  await expect(editor).toContainText('Some text');
  await editor.click();
  await page.keyboard.type(' one two three four five six seven eight');
  await expect(page.locator('.app')).toHaveClass(/zen-mode/);
  await page.getByTitle('Toggle toolbar').click();
  await page.getByTitle('Exit Zen Mode').click();
  await expect(page.locator('.app')).not.toHaveClass(/zen-mode/);
  await editor.click();
  await page.keyboard.type(' nine');
  await page.waitForTimeout(100);
  await page.keyboard.type(' ten');
  await page.waitForTimeout(100);
  await page.keyboard.type(' eleven');
  await expect(page.locator('.app')).not.toHaveClass(/zen-mode/);
});

test('a global theme change resets Auto Zen Mode, then the setting can be turned off', async ({ page }) => {
  await page.addInitScript(() => {
    (window as typeof window & { electronAPI: unknown }).electronAPI = {
      readStructure: async () => ({ success: true, structure: [{
        name: 'A note.html', path: 'A note.html', type: 'file',
        metadata: { id: 'A note.html', tags: [], theme: 'air', createdAt: '2025-01-01' },
      }] }),
      getDataFolder: async () => ({ success: true, path: '/test' }),
      scanAllTags: async () => ({ success: true, tags: [] }),
      openFile: async () => ({ success: true, content: '<p>Some text</p>' }),
      updateFile: async () => ({ success: true }),
      updateMetadata: async () => ({ success: true }),
      toggleZenMode: async (enable: boolean) => ({ success: true, isZenMode: enable }),
    };
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('menuitem', { name: 'Settings' }).click();
  await page.locator('.modal-tab').filter({ hasText: 'Layout' }).click();
  const autoZen = page.locator('.setting-item').filter({ hasText: 'Auto Zen Mode' }).locator('input');
  await autoZen.uncheck();
  await page.locator('.modal-tab').filter({ hasText: 'Typography' }).click();
  await page.locator('.theme-select').selectOption('air');
  await page.locator('.modal-tab').filter({ hasText: 'Layout' }).click();
  await expect(autoZen).toBeChecked();
  await autoZen.uncheck();
  await expect(autoZen).not.toBeChecked();
  await page.locator('.modal-header button').click();

  await page.locator('.note-item').first().click();
  const editor = page.locator('.tiptap').first();
  await expect(editor).toContainText('Some text');
  await editor.click();
  await page.keyboard.type(' one two three four five six seven eight');

  await expect(page.locator('.app')).not.toHaveClass(/zen-mode/);
  await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();
  await page.getByTitle('Toggle toolbar').click();
  await page.getByTitle('Enter Zen Mode').click();
  await expect(page.locator('.app')).toHaveClass(/zen-mode/);
});

test('changing a note theme resets Auto Zen Mode to the theme default', async ({ page }) => {
  await page.addInitScript(() => {
    (window as typeof window & { electronAPI: unknown }).electronAPI = {
      readStructure: async () => ({ success: true, structure: [{
        name: 'A note.html', path: 'A note.html', type: 'file',
        metadata: { id: 'A note.html', tags: [], createdAt: '2025-01-01' },
      }] }),
      getDataFolder: async () => ({ success: true, path: '/test' }),
      scanAllTags: async () => ({ success: true, tags: [] }),
      openFile: async () => ({ success: true, content: '<p>Some text</p>' }),
      updateFile: async () => ({ success: true }),
      updateMetadata: async () => ({ success: true }),
      toggleZenMode: async (enable: boolean) => ({ success: true, isZenMode: enable }),
    };
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('menuitem', { name: 'Settings' }).click();
  await page.locator('.theme-select').selectOption('air');
  await page.locator('.modal-tab').filter({ hasText: 'Layout' }).click();
  await page.locator('.setting-item').filter({ hasText: 'Auto Zen Mode' }).locator('input').uncheck();
  await page.locator('.modal-header button').click();

  await page.locator('.note-item').first().click();
  const editor = page.locator('.tiptap').first();
  await expect(editor).toContainText('Some text');
  await page.getByTitle('Toggle toolbar').click();
  await page.getByTitle('Note Settings').click();
  await page.locator('.modal .theme-select').selectOption('air');
  await page.locator('.modal-header button').click();
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('menuitem', { name: 'Settings' }).click();
  await page.locator('.modal-tab').filter({ hasText: 'Layout' }).click();
  await expect(page.locator('.setting-item').filter({ hasText: 'Auto Zen Mode' }).locator('input')).toBeChecked();
  await page.locator('.modal-header button').click();

  await editor.click();
  await page.keyboard.type(' one two three four five six seven eight');
  await expect(page.locator('.app')).toHaveClass(/zen-mode/);
  await page.getByTitle('Toggle toolbar').click();
  await page.getByTitle('Exit Zen Mode').click();
  await page.getByTitle('Toggle toolbar').click();
  await page.getByTitle('Note Settings').click();
  await page.locator('.modal .theme-select').selectOption('terminal');
  await page.locator('.modal-header button').click();
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('menuitem', { name: 'Settings' }).click();
  await page.locator('.modal-tab').filter({ hasText: 'Layout' }).click();
  await expect(page.locator('.setting-item').filter({ hasText: 'Auto Zen Mode' }).locator('input')).not.toBeChecked();
  await page.locator('.modal-header button').click();
  await page.getByTitle('Toggle toolbar').click();
  await page.getByTitle('Note Settings').click();
  await page.locator('.modal .theme-select').selectOption('');
  await page.locator('.modal-header button').click();
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('menuitem', { name: 'Settings' }).click();
  await page.locator('.modal-tab').filter({ hasText: 'Layout' }).click();
  await expect(page.locator('.setting-item').filter({ hasText: 'Auto Zen Mode' }).locator('input')).toBeChecked();
});
