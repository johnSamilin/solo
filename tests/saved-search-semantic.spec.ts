import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('solo-saved-filters'));
});

test('saved filter remembers semantic mode and relevance threshold', async ({ page }) => {
  const saved = await page.evaluate(async () => {
    const path = '/src/stores/SavedFiltersStore.ts';
    const { SavedFiltersStore } = await import(/* @vite-ignore */ path);
    const store = new SavedFiltersStore();
    store.saveFilter('Travel', 'уют', [], false, { extendedSearch: true, relevanceThreshold: 0.35 });
    const reloaded = new SavedFiltersStore();
    return reloaded.savedFilters[0];
  });
  expect(saved.extendedSearch).toBe(true);
  expect(saved.relevanceThreshold).toBe(0.35);
});

test('semantic saved filter selects matches and preserves their paragraphs for export', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const searchPath = '/src/utils/search.ts';
    const displayPath = '/src/components/Search/noteDisplayContent.ts';
    const { getNotesForSavedFilter } = await import(/* @vite-ignore */ searchPath);
    const { getNoteDisplayContent } = await import(/* @vite-ignore */ displayPath);
    const notes = [
      { id: 'first', title: 'Holiday', content: '<p>Budget and tickets</p><p>Warm evenings by the sea</p>', tags: ['travel'], paragraphTags: [], createdAt: new Date(), fileType: 'html', isLoaded: true, notebookId: null },
      { id: 'second', title: 'Elsewhere', content: '<p>Another note</p>', tags: ['work'], paragraphTags: [], createdAt: new Date(), fileType: 'html', isLoaded: true, notebookId: null },
    ];
    const filter = { searchQuery: 'relaxing trip', tagFilters: [{ path: 'travel', operator: 'AND' }], showOnlyEmptyNotes: false, extendedSearch: true, relevanceThreshold: 0.25 };
    const matches = await getNotesForSavedFilter(filter, notes, async () => ({
      mode: 'hybrid', count: 2, results: [
        { noteId: 'first', paragraphIndex: 1, filePath: 'first.html', score: 0.5 },
        { noteId: 'second', paragraphIndex: 0, filePath: 'second.html', score: 0.5 },
      ],
    }));
    return { ids: matches.map(note => note.id), excerpt: getNoteDisplayContent(matches[0], filter.searchQuery, filter.tagFilters) };
  });
  expect(result.ids).toEqual(['first']);
  expect(result.excerpt.isPartial).toBe(true);
  expect(result.excerpt.content).toContain('Warm evenings');
  expect(result.excerpt.content).not.toContain('Budget and tickets');
});

test('legacy saved filters continue to use ordinary search', async ({ page }) => {
  const ids = await page.evaluate(async () => {
    const path = '/src/utils/search.ts';
    const { getNotesForSavedFilter } = await import(/* @vite-ignore */ path);
    const note = { id: 'first', title: 'Holiday', content: '<p>Trip</p>', tags: [], paragraphTags: [], createdAt: new Date(), fileType: 'html', isLoaded: true, notebookId: null };
    const results = await getNotesForSavedFilter(
      { searchQuery: 'Holiday', tagFilters: [], showOnlyEmptyNotes: false },
      [note],
      async () => { throw new Error('Semantic search should not run'); },
    );
    return results.map(item => item.id);
  });
  expect(ids).toEqual(['first']);
});

test('saved filter mode can be changed and remains stored', async ({ page }) => {
  const options = await page.evaluate(async () => {
    const path = '/src/stores/SavedFiltersStore.ts';
    const { SavedFiltersStore } = await import(/* @vite-ignore */ path);
    const store = new SavedFiltersStore();
    store.saveFilter('Travel', 'trip', [], false);
    store.updateSearchOptions(store.savedFilters[0].id, { extendedSearch: true, relevanceThreshold: 0.42 });
    return new SavedFiltersStore().savedFilters[0];
  });
  expect(options.extendedSearch).toBe(true);
  expect(options.relevanceThreshold).toBe(0.42);
});

test('semantic backend failure does not silently become an empty export', async ({ page }) => {
  const error = await page.evaluate(async () => {
    const path = '/src/utils/search.ts';
    const { getNotesForSavedFilter } = await import(/* @vite-ignore */ path);
    try {
      await getNotesForSavedFilter(
        { searchQuery: 'trip', tagFilters: [], showOnlyEmptyNotes: false, extendedSearch: true },
        [],
        async () => { throw new Error('Index unavailable'); },
      );
    } catch (cause) { return (cause as Error).message; }
    return 'unexpected success';
  });
  expect(error).toBe('Index unavailable');
});

test('manual semantic export respects the current tag input and threshold', async ({ page }) => {
  const ids = await page.evaluate(async () => {
    const path = '/src/utils/search.ts';
    const { getNotesForSavedFilter } = await import(/* @vite-ignore */ path);
    const notes = ['travel', 'work'].map((tag, index) => ({
      id: String(index), title: tag, content: '<p>Note</p>', tags: [tag], paragraphTags: [],
      createdAt: new Date(), fileType: 'html', isLoaded: true, notebookId: null,
    }));
    const response = { mode: 'hybrid', count: 2, results: notes.map(note => ({
      noteId: note.id, filePath: `${note.id}.html`, paragraphIndex: 0, score: 0.4,
    })) };
    const filter = { searchQuery: 'trip', tagFilters: [], tagInputValue: 'travel', showOnlyEmptyNotes: false, extendedSearch: true, relevanceThreshold: 0.3 };
    const selected = await getNotesForSavedFilter(filter, notes, async () => response);
    const tooStrict = await getNotesForSavedFilter({ ...filter, relevanceThreshold: 0.5 }, notes, async () => response);
    return { selected: selected.map(note => note.id), tooStrict: tooStrict.map(note => note.id) };
  });
  expect(ids.selected).toEqual(['0']);
  expect(ids.tooStrict).toEqual([]);
});

test('PDF export contains the semantic paragraph rather than a lexical-only excerpt', async ({ page }) => {
  const content = await page.evaluate(async () => {
    const searchPath = '/src/utils/search.ts';
    const exportPath = '/src/components/Search/export/exportNotes.ts';
    const { getNotesForSavedFilter } = await import(/* @vite-ignore */ searchPath);
    const { createExportFileRequest } = await import(/* @vite-ignore */ exportPath);
    const note = { id: 'first', title: 'Holiday', content: '<p>Budget and tickets</p><p>Warm evenings by the sea</p>', tags: [], paragraphTags: [], createdAt: new Date(), fileType: 'html', isLoaded: true, notebookId: null };
    const filter = { id: 'saved', label: 'Travel', searchQuery: 'relaxing trip', tagFilters: [], showOnlyEmptyNotes: false, extendedSearch: true, relevanceThreshold: 0.2 };
    const notes = await getNotesForSavedFilter(filter, [note], async () => ({
      mode: 'hybrid', count: 1, results: [{ noteId: 'first', filePath: 'first.html', paragraphIndex: 1, score: 0.5 }],
    }));
    const profile = { format: 'pdf', title: 'Travel', author: '', includeTableOfContents: false, autoExport: false, cover: { enabled: false, title: '', author: '' }, headerFooter: { enabled: false, header: '', footer: '', pageNumberPosition: 'bottom-center' }, pageSize: 'A4' };
    const request = await createExportFileRequest(profile, filter, notes);
    return { selected: request.html?.includes('Warm evenings by the sea'), excluded: request.html?.includes('Budget and tickets') };
  });
  expect(content.selected).toBe(true);
  expect(content.excluded).toBe(false);
});

test('search toggle persists when the search page is reopened', async ({ page }) => {
  await page.locator('.sidebar-menu-button').click();
  await page.getByRole('menuitem', { name: /search|поиск/i }).click();
  const toggle = page.getByRole('switch');
  await expect(toggle).not.toBeChecked();
  await page.locator('.extended-search-toggle').click();
  await page.locator('.search-back-button').click();
  await page.locator('.sidebar-menu-button').click();
  await page.getByRole('menuitem', { name: /search|поиск/i }).click();
  await expect(page.getByRole('switch')).toBeChecked();
  await page.reload();
  await page.locator('.sidebar-menu-button').click();
  await page.getByRole('menuitem', { name: /search|поиск/i }).click();
  await expect(page.getByRole('switch')).toBeChecked();
});

test('saved filter restores its semantic toggle and threshold after reload', async ({ page }) => {
  await page.addInitScript(() => {
    (window as Window & { electronAPI: unknown }).electronAPI = {
      getDataFolder: async () => ({ success: true, path: '/test/data' }),
      readStructure: async () => ({ success: true, structure: [] }),
      scanAllTags: async () => ({ success: true, tags: [] }),
    };
  });
  await page.evaluate(() => localStorage.setItem('solo-saved-filters', JSON.stringify({ savedFilters: [{
    id: 'saved-travel', label: 'Travel filter', searchQuery: 'trip', tagFilters: [],
    showOnlyEmptyNotes: false, extendedSearch: true, relevanceThreshold: 0.35,
  }] })));
  await page.reload();
  await page.getByText('Travel filter').click();
  await expect(page.getByRole('switch')).toBeChecked();
  await expect(page.locator('.relevance-threshold-slider')).toHaveValue('0.35');
  await page.locator('.extended-search-toggle').click();
  await page.locator('.search-back-button').click();
  await page.reload();
  await page.getByText('Travel filter').click();
  await expect(page.getByRole('switch')).not.toBeChecked();
});
