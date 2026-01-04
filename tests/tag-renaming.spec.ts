import { test, expect } from '@playwright/test';

test.describe('Tag Renaming', () => {
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

      const updateTagsInState = () => {
        const allTags = new Set<string>();

        mockState.metadata.forEach((meta) => {
          if (meta.tags) {
            meta.tags.forEach((tag: any) => allTags.add(tag.path));
          }
        });

        mockState.files.forEach((content) => {
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = content;
          const taggedElements = tempDiv.querySelectorAll('[data-tags]');
          taggedElements.forEach(element => {
            const tags = element.getAttribute('data-tags');
            if (tags) {
              tags.split(',').forEach(tag => allTags.add(tag.trim()));
            }
          });
        });

        mockState.tags = Array.from(allTags);
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
          updateTagsInState();
          return { success: true };
        },

        updateMetadata: async (relativePath: string, metadata: any) => {
          mockState.metadata.set(relativePath, metadata);
          const jsonPath = relativePath.replace('.html', '.json');
          updateTagsInState();
          return { success: true, path: jsonPath };
        },

        readStructure: async () => ({ success: true, structure: mockState.structure }),

        scanAllTags: async () => {
          updateTagsInState();
          return { success: true, tags: mockState.tags };
        },

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

          updateTagsInState();
          return { success: true, htmlPath, jsonPath, id };
        },

        deleteNote: async (relativePath: string) => {
          mockState.files.delete(relativePath);
          mockState.metadata.delete(relativePath);
          updateTagsInState();
          return { success: true };
        },

        deleteNotebook: async () => {
          updateTagsInState();
          return { success: true };
        },

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

  test('Renaming tags - paragraph and note tags', async ({ page }) => {
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
    await notebookNameInput.fill('Renaming tags');

    const createButton = page.locator('button:has-text("Create Notebook")');
    await createButton.click();

    await expect(page.getByText('Renaming tags')).toBeVisible({ timeout: 5000 });

    const notebookItem = page.locator('.notebook-name').filter({ hasText: 'Renaming tags' });
    await expect(notebookItem).toBeVisible();
    await notebookItem.click();

    await page.waitForTimeout(500);

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
      await titleInput.fill('Paragraph tag');
    } else {
      await editor.click();
      await page.keyboard.type('Paragraph tag');
      await page.keyboard.press('Enter');
    }

    await editor.click();
    const firstParagraph = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';
    await page.keyboard.type(firstParagraph);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');

    const secondParagraph = 'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.';
    await page.keyboard.type(secondParagraph);

    await page.waitForTimeout(1000);

    const paragraphs = page.locator('.tiptap p');
    await expect(paragraphs.first()).toBeVisible();

    await paragraphs.first().click();
    await page.keyboard.press('Control+Shift+T');

    await page.waitForTimeout(500);

    const tagInput = page.locator('input[placeholder="Add tags (separated by commas)"]');
    if (await tagInput.isVisible()) {
      await tagInput.fill('Rename tag 1');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
    }

    await page.waitForTimeout(2000);

    const noteInSidebar1 = page.locator('.note-title').filter({ hasText: 'Paragraph tag' });
    await expect(noteInSidebar1).toBeVisible({ timeout: 5000 });

    await menuButton.click();
    await page.waitForTimeout(300);
    await newNoteButton.click();
    await page.waitForTimeout(500);

    const editor2 = page.locator('.tiptap').first();
    await expect(editor2).toBeVisible({ timeout: 10000 });

    const titleInput2 = page.locator('input[type="text"][placeholder*="title" i]').first();
    const isTitleVisible2 = await titleInput2.isVisible().catch(() => false);

    if (isTitleVisible2) {
      await titleInput2.fill('Note tag');
    } else {
      await editor2.click();
      await page.keyboard.type('Note tag');
      await page.keyboard.press('Enter');
    }

    await editor2.click();
    const noteContent = 'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.';
    await page.keyboard.type(noteContent);

    await page.waitForTimeout(1000);

    await page.keyboard.press('Control+Shift+T');
    await page.waitForTimeout(500);

    const tagInput2 = page.locator('input[placeholder="Add tags (separated by commas)"]');
    if (await tagInput2.isVisible()) {
      await tagInput2.fill('Rename tag 2');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
    }

    await page.waitForTimeout(2000);

    const noteInSidebar2 = page.locator('.note-title').filter({ hasText: 'Note tag' });
    await expect(noteInSidebar2).toBeVisible({ timeout: 5000 });

    await menuButton.click();
    await page.waitForTimeout(300);
    const settingsButton = page.getByRole('menuitem', { name: 'Settings' });
    await expect(settingsButton).toBeVisible();
    await settingsButton.click();

    await page.waitForTimeout(500);

    const tagsTab = page.getByRole('tab', { name: 'Tags' });
    await expect(tagsTab).toBeVisible();
    await tagsTab.click();

    await page.waitForTimeout(500);

    const renameTag1Button = page.locator('.tag-item:has-text("Rename tag 1") button[title="Rename tag"]').first();
    await expect(renameTag1Button).toBeVisible({ timeout: 5000 });
    await renameTag1Button.click();

    await page.waitForTimeout(300);

    const editInput1 = page.locator('input.tag-edit-input').first();
    await expect(editInput1).toBeVisible();
    await editInput1.clear();
    await editInput1.fill('RENAMED tag 1');
    await editInput1.press('Enter');

    await page.waitForTimeout(1000);

    await expect(page.getByText('RENAMED tag 1')).toBeVisible({ timeout: 5000 });

    const renameTag2Button = page.locator('.tag-item:has-text("Rename tag 2") button[title="Rename tag"]').first();
    await expect(renameTag2Button).toBeVisible({ timeout: 5000 });
    await renameTag2Button.click();

    await page.waitForTimeout(300);

    const editInput2 = page.locator('input.tag-edit-input').first();
    await expect(editInput2).toBeVisible();
    await editInput2.clear();
    await editInput2.fill('RENAMED tag 2');
    await editInput2.press('Enter');

    await page.waitForTimeout(1000);

    await expect(page.getByText('RENAMED tag 2')).toBeVisible({ timeout: 5000 });

    const closeButton = page.locator('button:has-text("Close")');
    if (await closeButton.isVisible()) {
      await closeButton.click();
    } else {
      await page.keyboard.press('Escape');
    }

    await page.waitForTimeout(500);

    await noteInSidebar1.click();
    await page.waitForTimeout(1000);

    const paragraphsAfterRename = page.locator('.tiptap p');
    await expect(paragraphsAfterRename).toHaveCount(2);

    const firstParContent = await paragraphsAfterRename.first().textContent();
    expect(firstParContent).toContain('Lorem ipsum dolor sit amet');

    const secondParContent = await paragraphsAfterRename.nth(1).textContent();
    expect(secondParContent).toContain('Ut enim ad minim veniam');

    const firstParWithTag = paragraphsAfterRename.first();
    const dataTagsAttr = await firstParWithTag.getAttribute('data-tags');
    if (dataTagsAttr) {
      expect(dataTagsAttr).toContain('RENAMED tag 1');
      expect(dataTagsAttr).not.toContain('Rename tag 1');
    }

    await noteInSidebar2.click();
    await page.waitForTimeout(1000);

    const noteContent2 = page.locator('.tiptap');
    const content2Text = await noteContent2.textContent();
    expect(content2Text).toContain('Duis aute irure dolor');

    const tagsDisplay = page.locator('.tags-display');
    if (await tagsDisplay.isVisible()) {
      const tagText = await tagsDisplay.textContent();
      expect(tagText).toContain('RENAMED tag 2');
      expect(tagText).not.toContain('Rename tag 2');
    }
  });
});
