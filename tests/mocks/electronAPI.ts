import { ElectronAPI, FileNode, FileMetadata } from '../../src/types';

export interface MockState {
  structure: FileNode[];
  files: Map<string, string>;
  metadata: Map<string, FileMetadata>;
  dataFolder: string | null;
  zenMode: boolean;
  tags: string[];
}

export function createMockElectronAPI(initialState?: Partial<MockState>): ElectronAPI {
  const state: MockState = {
    structure: [],
    files: new Map(),
    metadata: new Map(),
    dataFolder: null,
    zenMode: false,
    tags: [],
    ...initialState,
  };

  return {
    selectFolder: async () => {
      return { success: true, path: '/test/folder' };
    },

    getDataFolder: async () => {
      return { success: true, path: state.dataFolder };
    },

    selectParentFolder: async () => {
      return { success: true, path: '/test/parent' };
    },

    openFile: async (relativePath: string) => {
      const content = state.files.get(relativePath);
      if (content !== undefined) {
        return { success: true, content };
      }
      return { success: false, error: 'File not found' };
    },

    updateFile: async (relativePath: string, content: string) => {
      state.files.set(relativePath, content);
      return { success: true };
    },

    updateMetadata: async (relativePath: string, metadata: FileMetadata) => {
      state.metadata.set(relativePath, metadata);
      const jsonPath = relativePath.replace('.html', '.json');
      return { success: true, path: jsonPath };
    },

    readStructure: async () => {
      return { success: true, structure: state.structure };
    },

    scanAllTags: async () => {
      return { success: true, tags: state.tags };
    },

    toggleZenMode: async (enable: boolean) => {
      state.zenMode = enable;
      return { success: true, isZenMode: enable };
    },

    getZenMode: async () => {
      return { success: true, isZenMode: state.zenMode };
    },

    search: async (searchString?: string, tags?: string[]) => {
      return { success: true, results: [] };
    },

    createNotebook: async (parentPath: string, name: string) => {
      const path = parentPath ? `${parentPath}/${name}` : name;
      const newFolder: FileNode = {
        name,
        path,
        type: 'folder',
        children: [],
      };

      if (parentPath) {
        const addToParent = (nodes: FileNode[]): boolean => {
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
        addToParent(state.structure);
      } else {
        state.structure.push(newFolder);
      }

      return { success: true, path };
    },

    createNote: async (parentPath: string, name: string) => {
      const htmlPath = parentPath ? `${parentPath}/${name}.html` : `${name}.html`;
      const jsonPath = parentPath ? `${parentPath}/${name}.json` : `${name}.json`;
      const id = htmlPath;

      const metadata: FileMetadata = {
        id,
        tags: [],
        createdAt: new Date().toISOString(),
      };

      state.files.set(htmlPath, '');
      state.metadata.set(htmlPath, metadata);

      const newFile: FileNode = {
        name: `${name}.html`,
        path: htmlPath,
        type: 'file',
        metadata,
      };

      if (parentPath) {
        const addToParent = (nodes: FileNode[]): boolean => {
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
        addToParent(state.structure);
      } else {
        state.structure.push(newFile);
      }

      return { success: true, htmlPath, jsonPath, id };
    },

    deleteNote: async (relativePath: string) => {
      state.files.delete(relativePath);
      state.metadata.delete(relativePath);

      const removeFromStructure = (nodes: FileNode[]): FileNode[] => {
        return nodes.filter(node => {
          if (node.path === relativePath) {
            return false;
          }
          if (node.children) {
            node.children = removeFromStructure(node.children);
          }
          return true;
        });
      };

      state.structure = removeFromStructure(state.structure);
      return { success: true };
    },

    deleteNotebook: async (relativePath: string) => {
      const removeFromStructure = (nodes: FileNode[]): FileNode[] => {
        return nodes.filter(node => {
          if (node.path === relativePath) {
            return false;
          }
          if (node.children) {
            node.children = removeFromStructure(node.children);
          }
          return true;
        });
      };

      state.structure = removeFromStructure(state.structure);
      return { success: true };
    },

    renameNote: async (relativePath: string, newName: string) => {
      const content = state.files.get(relativePath);
      const metadata = state.metadata.get(relativePath);

      const pathParts = relativePath.split('/');
      pathParts[pathParts.length - 1] = `${newName}.html`;
      const newPath = pathParts.join('/');

      if (content !== undefined) {
        state.files.delete(relativePath);
        state.files.set(newPath, content);
      }

      if (metadata) {
        state.metadata.delete(relativePath);
        state.metadata.set(newPath, metadata);
      }

      return { success: true, newPath };
    },

    renameNotebook: async (relativePath: string, newName: string) => {
      const pathParts = relativePath.split('/');
      pathParts[pathParts.length - 1] = newName;
      const newPath = pathParts.join('/');

      return { success: true, newPath };
    },

    selectFile: async (filters) => {
      return { success: true, path: '/test/file.jpg' };
    },

    getDigikamTags: async (dbPath: string) => {
      return { success: true, tags: [] };
    },

    getDigikamImagesByTag: async (dbPath: string, tagId: number, limit?: number) => {
      return { success: true, images: [] };
    },
  };
}

export function getMockState(api: ElectronAPI): MockState {
  return (api as any).state || { structure: [], files: new Map(), metadata: new Map(), dataFolder: null, zenMode: false, tags: [] };
}
