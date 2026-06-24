import { ElectronAPI, FileMetadata, FileNode } from '../types';

/**
 * In-memory file store for packaged (web) builds.
 * Keeps file contents and metadata in Maps so that
 * notes can be created, edited, and deleted — all in memory.
 */

// ── File content storage (path → HTML string) ──
const fileContents = new Map<string, string>();

// ── Metadata storage (path → FileMetadata) ──
const metadatas = new Map<string, FileMetadata>();

let idCounter = 0;

function nextId(): string {
  return `mem-${++idCounter}-${Date.now()}`;
}

/** Generate a unique .html path within a parent folder */
function makeHtmlPath(parentPath: string, title: string): string {
  const safeName = title.replace(/[/\\?%*:|"<>]/g, '_').slice(0, 100);
  const fileName = `${safeName} - ${Date.now()}.html`;
  return parentPath ? `${parentPath}/${fileName}` : fileName;
}

// ── Seed demo content ──
function seedDemoFiles() {
  const demoFiles: Array<{ path: string; content: string }> = [
    {
      path: 'inbox/Быстрая заметка.html',
      content: '<p>Это пример быстрой заметки.</p>',
    },
    {
      path: 'inbox/Идея для проекта.html',
      content: '<p>Идеи для проекта:</p><ul><li>Идея 1</li><li>Идея 2</li></ul>',
    },
    {
      path: 'projects/Solo/Архитектура.html',
      content: '<h1>Архитектура Solo</h1><p>Описание архитектуры приложения.</p>',
    },
    {
      path: 'projects/Solo/Заметки по UI.html',
      content: '<h1>UI заметки</h1><p>Размышления о дизайне интерфейса.</p>',
    },
    {
      path: 'projects/Digikam Companion/Требования.html',
      content: '<h1>Требования</h1><p>Список требований к приложению.</p>',
    },
    {
      path: 'diary/2025-06-23 Запись.html',
      content: '<p>Дневниковая запись за 23 июня 2025 года.</p>',
    },
    {
      path: 'references/Полезные ссылки.html',
      content: '<p>Полезные ссылки и ресурсы.</p>',
    },
  ];

  for (const { path, content } of demoFiles) {
    if (!fileContents.has(path)) {
      fileContents.set(path, content);
    }
  }
}

seedDemoFiles();

/** Static tree structure – used only for readStructure() */
function buildStaticStructure(): FileNode[] {
  return [
    {
      name: 'Входящие',
      path: 'inbox',
      type: 'folder',
      children: [
        {
          name: 'Быстрая заметка.html',
          path: 'inbox/Быстрая заметка.html',
          type: 'file',
          metadata: {
            id: 'inbox-01',
            tags: ['входящие'],
            createdAt: '2025-01-15T10:30:00Z',
            theme: '',
            paragraphTags: ['p1', 'p2'],
          },
        },
        {
          name: 'Идея для проекта.html',
          path: 'inbox/Идея для проекта.html',
          type: 'file',
          metadata: {
            id: 'inbox-02',
            tags: ['входящие', 'идеи'],
            createdAt: '2025-02-03T14:15:00Z',
            theme: '',
            paragraphTags: ['p1'],
          },
        },
      ],
    },
    {
      name: 'Проекты',
      path: 'projects',
      type: 'folder',
      children: [
        {
          name: 'Solo',
          path: 'projects/Solo',
          type: 'folder',
          children: [
            {
              name: 'Архитектура.html',
              path: 'projects/Solo/Архитектура.html',
              type: 'file',
              metadata: {
                id: 'proj-solo-01',
                tags: ['solo', 'архитектура'],
                createdAt: '2025-03-01T09:00:00Z',
                theme: '',
                paragraphTags: ['p1', 'p2', 'p3'],
              },
            },
            {
              name: 'Заметки по UI.html',
              path: 'projects/Solo/Заметки по UI.html',
              type: 'file',
              metadata: {
                id: 'proj-solo-02',
                tags: ['solo', 'ui'],
                createdAt: '2025-03-10T11:45:00Z',
                theme: '',
                paragraphTags: ['p1'],
              },
            },
          ],
        },
        {
          name: 'Digikam Companion',
          path: 'projects/Digikam Companion',
          type: 'folder',
          children: [
            {
              name: 'Требования.html',
              path: 'projects/Digikam Companion/Требования.html',
              type: 'file',
              metadata: {
                id: 'proj-digikam-01',
                tags: ['digikam', 'spec'],
                createdAt: '2025-04-20T16:30:00Z',
                theme: '',
                paragraphTags: ['p1', 'p2'],
              },
            },
          ],
        },
      ],
    },
    {
      name: 'Дневник',
      path: 'diary',
      type: 'folder',
      children: [
        {
          name: '2025-06-23 Запись.html',
          path: 'diary/2025-06-23 Запись.html',
          type: 'file',
          metadata: {
            id: 'diary-01',
            tags: ['дневник'],
            createdAt: '2025-06-23T20:00:00Z',
            theme: '',
            paragraphTags: ['p1', 'p2', 'p3', 'p4'],
          },
        },
      ],
    },
    {
      name: 'Справочное',
      path: 'references',
      type: 'folder',
      children: [
        {
          name: 'Полезные ссылки.html',
          path: 'references/Полезные ссылки.html',
          type: 'file',
          metadata: {
            id: 'ref-01',
            tags: ['reference', 'links'],
            createdAt: '2025-05-12T08:00:00Z',
            theme: '',
            paragraphTags: ['p1'],
          },
        },
      ],
    },
  ];
}

/** Create a stub ElectronAPI that works fully in memory for packaged web builds. */
export function createStubAPI(): ElectronAPI {
  const stub: {
    [K in keyof ElectronAPI]: (...args: any[]) => Promise<any>;
  } = {
    // ── Folder / file operations (not available, but return gracefully) ──
    selectFolder: async () => {
      return { success: false, error: 'Not available in packaged build' };
    },
    getDataFolder: async () => {
      return { success: false, error: 'Not available in packaged build' };
    },
    selectParentFolder: async () => {
      return { success: false, error: 'Not available in packaged build' };
    },

    // ── In-memory read / write ──
    openFile: async (relativePath: string) => {
      const content = fileContents.get(relativePath);
      if (content === undefined) {
        return { success: false, error: `File "${relativePath}" not found in memory` };
      }
      return { success: true, content };
    },
    updateFile: async (relativePath: string, content: string) => {
      fileContents.set(relativePath, content);
      return { success: true };
    },
    updateMetadata: async (relativePath: string, metadata: FileMetadata) => {
      metadatas.set(relativePath, metadata);
      return { success: true };
    },
    readStructure: async () => {
      return { success: true, structure: buildStaticStructure() };
    },

    // ── Tag scanning ──
    scanAllTags: async () => {
      return { success: false, error: 'Not available in packaged build' };
    },

    // ── Zen mode ──
    toggleZenMode: async () => {
      return { success: false, error: 'Not available in packaged build' };
    },
    getZenMode: async () => {
      return { success: true, isZenMode: false };
    },

    // ── Search (in-memory) ──
    search: async (searchString?: string, tags?: string[]) => {
      const results: Array<{ path: string; type: string; matches: string[]; metadata?: FileMetadata }> = [];
      const hasSearchString = searchString && searchString.trim().length > 0;
      const hasTags = tags && tags.length > 0;

      if (!hasSearchString && !hasTags) {
        return { success: true, results: [] };
      }

      const searchLower = searchString?.toLowerCase() || '';

      // Collect all paths from both content store and metadata store
      const allPaths = new Set([...fileContents.keys(), ...metadatas.keys()]);

      for (const filePath of allPaths) {
        const matches: string[] = [];
        const meta = metadatas.get(filePath);
        const fileName = filePath.split('/').pop() || filePath;

        // ── Filename match ──
        if (hasSearchString && fileName.toLowerCase().includes(searchLower)) {
          matches.push('filename');
        }

        // ── Content match (HTML notes only) ──
        if (hasSearchString && filePath.endsWith('.html')) {
          const content = fileContents.get(filePath);
          if (content && content.toLowerCase().includes(searchLower)) {
            matches.push('content');
          }
        }

        // ── Metadata / tag matching ──
        if (meta) {
          if (hasTags && meta.tags) {
            const hasMatchingTag = tags!.some(tag =>
              meta.tags!.some(metaTag =>
                metaTag.toLowerCase().includes(tag.toLowerCase())
              )
            );
            if (hasMatchingTag) {
              matches.push('metadata:tags');
            }
          }

          if (hasSearchString) {
            if (meta.id?.toLowerCase().includes(searchLower)) {
              matches.push('metadata:id');
            }
            if (meta.tags?.some(tag => tag.toLowerCase().includes(searchLower))) {
              matches.push('metadata:tags');
            }
          }
        }

        if (matches.length > 0) {
          results.push({
            path: filePath,
            type: matches.includes('content') ? 'content' : 'filename',
            matches: [...new Set(matches)],
            metadata: meta,
          });
        }
      }

      return { success: true, results };
    },

    // ── Notebooks (in-memory) ──
    createNotebook: async (parentPath: string, name: string) => {
      const path = parentPath ? `${parentPath}/${name}` : name;
      return { success: true, path };
    },
    deleteNotebook: async () => {
      return { success: true };
    },
    renameNotebook: async (relativePath: string, newName: string) => {
      const parts = relativePath.split('/');
      parts[parts.length - 1] = newName;
      const newPath = parts.join('/');
      return { success: true, newPath };
    },

    // ── Notes (in-memory) ──
    createNote: async (parentPath: string, name: string) => {
      const id = nextId();
      const htmlPath = makeHtmlPath(parentPath, name);
      const now = new Date().toISOString();
      fileContents.set(htmlPath, '');
      metadatas.set(htmlPath, {
        id,
        tags: [],
        createdAt: now,
        theme: '',
        paragraphTags: [],
      });
      return { success: true, htmlPath, id };
    },
    deleteNote: async (relativePath: string) => {
      fileContents.delete(relativePath);
      metadatas.delete(relativePath);
      return { success: true };
    },
    renameNote: async (relativePath: string, newName: string) => {
      const parts = relativePath.split('/');
      const ext = parts[parts.length - 1].includes('.') ? '.' + parts[parts.length - 1].split('.').pop() : '.html';
      parts[parts.length - 1] = newName.replace(/[^a-zA-Zа-яА-Я0-9 _-]/g, '') + ext;
      const newPath = parts.join('/');
      const content = fileContents.get(relativePath);
      const meta = metadatas.get(relativePath);
      if (content !== undefined) {
        fileContents.set(newPath, content);
        fileContents.delete(relativePath);
      }
      if (meta) {
        metadatas.set(newPath, meta);
        metadatas.delete(relativePath);
      }
      return { success: true, newPath };
    },

    // ── PDF ──
    openPdfFile: async () => {
      return { success: false, error: 'Not available in packaged build' };
    },

    // ── File picker ──
    selectFile: async () => {
      return { success: false, error: 'Not available in packaged build' };
    },

    // ── Digikam ──
    getDigikamTags: async () => {
      return { success: false, error: 'Not available in packaged build' };
    },
    getDigikamImagesByTag: async () => {
      return { success: false, error: 'Not available in packaged build', digikamTag: '' };
    },
  };
  return stub as unknown as ElectronAPI;
}
