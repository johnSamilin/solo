import { test, expect } from '@playwright/test';

test.describe('Fresh Start', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const mockState = {
        structure: [] as any[],
        files: new Map<string, string>(),
        metadata: new Map<string, any>(),
        dataFolder: '/test/data',
        zenMode: false,
        tags: [] as string[],
      };

      (window as any).electronAPI = {
        selectFolder: async () => ({ success: true, path: '/test/folder' }),
        getDataFolder: async () => ({ success: true, path: mockState.dataFolder }),
        selectParentFolder: async () => ({ success: true, path: '/test/parent' }),
        openFile: async (relativePath: string) => {
          const content = mockState.files.get(relativePath);
          if (content !== undefined) {
            return { success: true, content };
          }
          return { success: false, error: 'File not found' };
        },
        updateFile: async (relativePath: string, content: string) => {
          mockState.files.set(relativePath, content);
          return { success: true };
        },
        updateMetadata: async (relativePath: string, metadata: any) => {
          mockState.metadata.set(relativePath, metadata);
          const jsonPath = relativePath.replace('.html', '.json');
          return { success: true, path: jsonPath };
        },
        readStructure: async () => ({ success: true, structure: mockState.structure }),
        scanAllTags: async () => ({ success: true, tags: mockState.tags }),
        toggleZenMode: async (enable: boolean) => {
          mockState.zenMode = enable;
          return { success: true, isZenMode: enable };
        },
        getZenMode: async () => ({ success: true, isZenMode: mockState.zenMode }),
        search: async () => ({ success: true, results: [] }),
        createNotebook: async (parentPath: string, name: string) => {
          const path = parentPath ? `${parentPath}/${name}` : name;
          const newFolder = {
            name,
            path,
            type: 'folder',
            children: [],
          };

          if (parentPath) {
            const addToParent = (nodes: any[]): boolean => {
              for (const node of nodes) {
                if (node.path === parentPath && node.type === 'folder') {
                  if (!node.children) node.children = [];
                  node.children.push(newFolder);
                  return true;
                }
                if (node.children && addToParent(node.children)) {
                  return true;
                }
              }
              return false;
            };
            addToParent(mockState.structure);
          } else {
            mockState.structure.push(newFolder);
          }

          return { success: true, path };
        },
        createNote: async (parentPath: string, name: string) => {
          const htmlPath = parentPath ? `${parentPath}/${name}.html` : `${name}.html`;
          const jsonPath = parentPath ? `${parentPath}/${name}.json` : `${name}.json`;
          const id = htmlPath;

          const metadata = {
            id,
            tags: [],
            createdAt: new Date().toISOString(),
          };

          mockState.files.set(htmlPath, '');
          mockState.metadata.set(htmlPath, metadata);

          const newFile = {
            name: `${name}.html`,
            path: htmlPath,
            type: 'file',
            metadata,
          };

          if (parentPath) {
            const addToParent = (nodes: any[]): boolean => {
              for (const node of nodes) {
                if (node.path === parentPath && node.type === 'folder') {
                  if (!node.children) node.children = [];
                  node.children.push(newFile);
                  return true;
                }
                if (node.children && addToParent(node.children)) {
                  return true;
                }
              }
              return false;
            };
            addToParent(mockState.structure);
          } else {
            mockState.structure.push(newFile);
          }

          return { success: true, htmlPath, jsonPath, id };
        },
        deleteNote: async (relativePath: string) => {
          mockState.files.delete(relativePath);
          mockState.metadata.delete(relativePath);
          return { success: true };
        },
        deleteNotebook: async () => ({ success: true }),
        renameNote: async (relativePath: string, newName: string) => {
          const pathParts = relativePath.split('/');
          pathParts[pathParts.length - 1] = `${newName}.html`;
          const newPath = pathParts.join('/');
          return { success: true, newPath };
        },
        renameNotebook: async (relativePath: string, newName: string) => {
          const pathParts = relativePath.split('/');
          pathParts[pathParts.length - 1] = newName;
          const newPath = pathParts.join('/');
          return { success: true, newPath };
        },
        selectFile: async () => ({ success: true, path: '/test/file.jpg' }),
        getDigikamTags: async () => ({ success: true, tags: [] }),
        getDigikamImagesByTag: async () => ({ success: true, images: [] }),
      };
    });
  });

  test('1. Fresh start - create notebook and note', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('Main notebook')).toBeVisible({ timeout: 10000 });

    const menuButton = page.locator('.sidebar-menu-button').first();
    await expect(menuButton).toBeVisible({ timeout: 10000 });
    await menuButton.click();

    const newNotebookButton = page.getByRole('menuitem', { name: 'New Notebook' });
    await expect(newNotebookButton).toBeVisible();
    await newNotebookButton.click();

    const notebookNameInput = page.locator('input[placeholder="Enter notebook name"]');
    await expect(notebookNameInput).toBeVisible();
    await notebookNameInput.fill('My Test Notebook');

    const createButton = page.locator('button:has-text("Create Notebook")');
    await createButton.click();

    await expect(page.getByText('My Test Notebook')).toBeVisible({ timeout: 5000 });

    const notebookItem = page.locator('.notebook-name').filter({ hasText: 'My Test Notebook' });
    await expect(notebookItem).toBeVisible();
    await notebookItem.click();

    const notebookHeader = page.locator('.notebook-header.focused');
    await expect(notebookHeader).toBeVisible();

    await menuButton.click();

    const newNoteButton = page.getByRole('menuitem', { name: 'New Note' });
    await expect(newNoteButton).toBeVisible();
    await newNoteButton.click();

    await page.waitForTimeout(500);

    const editor = page.locator('.tiptap').first();
    await expect(editor).toBeVisible({ timeout: 10000 });

    const titleInput = page.locator('input[type="text"][placeholder*="title" i]').first();
    const isTitleVisible = await titleInput.isVisible().catch(() => false);

    if (isTitleVisible) {
      await titleInput.fill('1 note');
    } else {
      await editor.click();
      await page.keyboard.type('1 note');
      await page.keyboard.press('Enter');
    }

    await editor.click();
    await page.keyboard.type('Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.');

    await page.waitForTimeout(2000);

    const noteTitle = page.getByText('1 note');
    await expect(noteTitle).toBeVisible();

    const noteInSidebar = page.locator('.note-title').filter({ hasText: '1 note' });
    await expect(noteInSidebar).toBeVisible({ timeout: 5000 });
  });
});
