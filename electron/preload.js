import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('brigde', {
  loadFromStorage: (key) => ipcRenderer.invoke('loadFromStorage', key),
  saveToStorage: (key, data) => ipcRenderer.invoke('saveToStorage', key, data)
});