interface FileMetadata {
  id: string;
  tags: string[];
  date: string;
}

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
}

interface SearchResult {
  path: string;
  type: 'filename' | 'content' | 'metadata';
  matches: string[];
  metadata?: FileMetadata;
}

interface ElectronAPI {
  selectFolder: () => Promise<{ success: boolean; path?: string; error?: string }>;
  getDataFolder: () => Promise<{ success: boolean; path?: string | null }>;
  selectParentFolder: () => Promise<{ success: boolean; path?: string; error?: string }>;
  openFile: (relativePath: string) => Promise<{ success: boolean; content?: string; error?: string }>;
  updateFile: (relativePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
  updateMetadata: (relativePath: string, metadata: FileMetadata) => Promise<{ success: boolean; path?: string; error?: string }>;
  readStructure: () => Promise<{ success: boolean; structure?: FileNode[]; error?: string }>;
  scanAllTags: () => Promise<{ success: boolean; tags?: string[]; error?: string }>;
  toggleZenMode: (enable: boolean) => Promise<{ success: boolean; isZenMode?: boolean; error?: string }>;
  getZenMode: () => Promise<{ success: boolean; isZenMode?: boolean; error?: string }>;
  search: (searchString?: string, tags?: string[]) => Promise<{ success: boolean; results?: SearchResult[]; error?: string }>;
  createNotebook: (parentPath: string, name: string) => Promise<{ success: boolean; path?: string; error?: string }>;
  createNote: (parentPath: string, name: string) => Promise<{ success: boolean; htmlPath?: string; jsonPath?: string; error?: string }>;
}

interface Window {
  electronAPI: ElectronAPI;
}
