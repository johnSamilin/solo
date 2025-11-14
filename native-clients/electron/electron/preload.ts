import { contextBridge, ipcRenderer } from 'electron';

interface FileMetadata {
  id: string;
  tags: string[];
  date: string;
}

interface ApiResponse<T = unknown> {
  success: boolean;
  error?: string;
  data?: T;
}

const api = {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  getDataFolder: () => ipcRenderer.invoke('get-data-folder'),
  selectParentFolder: () => ipcRenderer.invoke('select-parent-folder'),
  selectFile: (filters?: { name: string; extensions: string[] }[]) => ipcRenderer.invoke('select-file', filters),
  openFile: (relativePath: string) => ipcRenderer.invoke('open-file', relativePath),
  updateFile: (relativePath: string, content: string) =>
    ipcRenderer.invoke('update-file', relativePath, content),
  updateMetadata: (relativePath: string, metadata: FileMetadata) =>
    ipcRenderer.invoke('update-metadata', relativePath, metadata),
  readStructure: () => ipcRenderer.invoke('read-structure'),
  scanAllTags: () => ipcRenderer.invoke('scan-all-tags'),
  toggleZenMode: (enable: boolean) => ipcRenderer.invoke('toggle-zen-mode', enable),
  getZenMode: () => ipcRenderer.invoke('get-zen-mode'),
  search: (searchString?: string, tags?: string[]) => ipcRenderer.invoke('search', searchString, tags),
  createNotebook: (parentPath: string, name: string) => ipcRenderer.invoke('create-notebook', parentPath, name),
  createNote: (parentPath: string, name: string) => ipcRenderer.invoke('create-note', parentPath, name),
  uploadImage: (imageData: string, fileName: string) => ipcRenderer.invoke('upload-image', imageData, fileName),
};

contextBridge.exposeInMainWorld('electronAPI', api);

export type ElectronAPI = typeof api;
