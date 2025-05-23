import { contextBridge, ipcRenderer, shell } from 'electron';

contextBridge.exposeInMainWorld('bridge', {
  loadFromStorage: (key) => ipcRenderer.invoke('loadFromStorage', key),
  saveToStorage: (key, data) => ipcRenderer.invoke('saveToStorage', key, data),
  pickExportFolder: () => ipcRenderer.invoke('pick-folder', 'export'),
  pickImportFolder: () => ipcRenderer.invoke('pick-folder', 'import'),
  exportData: (data, exportPath) => ipcRenderer.invoke('export-data', data, exportPath),
  importFromJoplin: (settings) => ipcRenderer.invoke('import-joplin', settings),
  openExternal: (url) => shell.openExternal(url),
  testWebDAV: (settings) => ipcRenderer.invoke('testWebDAV', settings),
  syncWebDAV: (settings) => ipcRenderer.invoke('syncWebDAV', settings),
  restoreWebDAV: (settings) => ipcRenderer.invoke('restoreWebDAV', settings),
});