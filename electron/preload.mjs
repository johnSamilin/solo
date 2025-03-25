import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('bridge', {
  loadFromStorage: (key) => ipcRenderer.invoke('loadFromStorage', key),
  saveToStorage: (key, data) => ipcRenderer.invoke('saveToStorage', key, data),
  pickExportFolder: () => ipcRenderer.invoke('pick-folder', 'export'),
  pickImportFolder: () => ipcRenderer.invoke('pick-folder', 'import'),
  exportData: (data, exportPath) => ipcRenderer.invoke('export-data', data, exportPath),
  importFromJoplin: () => ipcRenderer.invoke('import-joplin')
});