import { Editor } from "@tiptap/react";

export interface Tag {
  id: string;
  path: string;
}

export interface TagNode {
  id: string;
  name: string;
  children: TagNode[];
  isChecked: boolean;
  isExpanded: boolean;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  tags: Tag[];
  notebookId: string;
  theme?: string;
  filePath?: string;
  path?: string;
  isLoaded: boolean;
}

export interface Notebook {
  id: string;
  name: string;
  parentId: string | null;
  isExpanded: boolean;
  path?: string;
}

export interface TypographySettings {
  editorFontFamily: string;
  editorFontSize: string;
  editorLineHeight: string;
  titleFontFamily: string;
  titleFontSize: string;
  sidebarFontFamily: string;
  sidebarFontSize: string;
  pageMargins: string;
  paragraphSpacing: string;
  enableDropCaps: boolean;
  dropCapSize: string;
  dropCapLineHeight: string;
  maxEditorWidth: string;
  sidebarPinned: boolean;
  typewriterSound: string;
  autoZenMode: boolean;
}


export interface Toast {
  message: string;
  type: 'success' | 'error';
}


export interface Bridge {
  loadFromStorage: (key: string) => Promise<any>;
  saveToStorage: (key: string, data: any) => Promise<boolean>;
  openExternal: (url: string) => Promise<void>;
}

export interface FileMetadata {
  id: string;
  tags: string[];
  createdAt: string;
  theme?: string;
}

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  metadata?: FileMetadata;
}

export interface ElectronAPI {
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
  search: (searchString?: string, tags?: string[]) => Promise<{ success: boolean; results?: any[]; error?: string }>;
  createNotebook: (parentPath: string, name: string) => Promise<{ success: boolean; path?: string; error?: string }>;
  createNote: (parentPath: string, name: string) => Promise<{ success: boolean; htmlPath?: string; jsonPath?: string; error?: string }>;
  deleteNote: (relativePath: string) => Promise<{ success: boolean; error?: string }>;
  deleteNotebook: (relativePath: string) => Promise<{ success: boolean; error?: string }>;
  renameNote: (relativePath: string, newName: string) => Promise<{ success: boolean; newPath?: string; error?: string }>;
  renameNotebook: (relativePath: string, newName: string) => Promise<{ success: boolean; newPath?: string; error?: string }>;
  selectFile: (filters?: { name: string; extensions: string[] }[]) => Promise<{ success: boolean; path?: string; error?: string }>;
}

declare global {
  interface Window {
    bridge?: Bridge;
    electronAPI: ElectronAPI;
  }
}