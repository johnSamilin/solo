import { ElectronAPI, FileMetadata } from '../types';
import { createStubAPI } from './createStubAPI';

export const isAndroid = !!window.SoloBridge;
export const isElectron = !!window.electronAPI;
export const isNative = isAndroid || isElectron;

function wrapAndroidBridge(): ElectronAPI | null {
  const bridge = window.SoloBridge;
  if (!bridge) return null;

  const parseJson = (json: string) => {
    try {
      return JSON.parse(json);
    } catch {
      return { success: false, error: 'Failed to parse bridge response' };
    }
  };

  return {
    selectFolder: () => {
      return new Promise((resolve) => {
        window.__soloSelectFolderCallback = (resultJson: string) => {
          resolve(parseJson(resultJson));
          delete window.__soloSelectFolderCallback;
        };
        bridge.selectFolder();
      });
    },
    getDataFolder: () => Promise.resolve(parseJson(bridge.getDataFolder())),
    selectParentFolder: () => Promise.resolve({ success: false, error: 'Not supported on Android' }),
    openFile: (relativePath: string) => Promise.resolve(parseJson(bridge.openFile(relativePath))),
    updateFile: (relativePath: string, content: string) =>
      Promise.resolve(parseJson(bridge.updateFile(relativePath, content))),
    updateMetadata: (relativePath: string, metadata: FileMetadata) =>
      Promise.resolve(parseJson(bridge.updateMetadata(relativePath, JSON.stringify(metadata)))),
    readStructure: () => Promise.resolve(parseJson(bridge.readStructure())),
    scanAllTags: () => Promise.resolve(parseJson(bridge.scanAllTags())),
    toggleZenMode: (enable: boolean) => Promise.resolve(parseJson(bridge.toggleZenMode(enable))),
    getZenMode: () => Promise.resolve({ success: true, isZenMode: false }),
    search: (searchString?: string, tags?: string[]) =>
      Promise.resolve(parseJson(bridge.search(searchString || '', JSON.stringify(tags || [])))),
    createNotebook: (parentPath: string, name: string) =>
      Promise.resolve(parseJson(bridge.createNotebook(parentPath, name))),
    createNote: (parentPath: string, name: string) =>
      Promise.resolve(parseJson(bridge.createNote(parentPath, name))),
    deleteNote: (relativePath: string) =>
      Promise.resolve(parseJson(bridge.deleteNote(relativePath))),
    deleteNotebook: (relativePath: string) =>
      Promise.resolve(parseJson(bridge.deleteNotebook(relativePath))),
    renameNote: (relativePath: string, newName: string) =>
      Promise.resolve(parseJson(bridge.renameNote(relativePath, newName))),
    renameNotebook: (relativePath: string, newName: string) =>
      Promise.resolve(parseJson(bridge.renameNotebook(relativePath, newName))),
    selectFile: () => Promise.resolve({ success: false, error: 'Not supported on Android' }),
    getDigikamTags: () => Promise.resolve({ success: false, error: 'Not supported on Android' }),
    getDigikamImagesByTag: () => Promise.resolve({ success: false, error: 'Not supported on Android', digikamTag: '' }),
    uploadImage: (imageData: string, fileName: string) =>
      Promise.resolve(parseJson(bridge.uploadImage(imageData, fileName))),
    openPdfFile: (relativePath: string) =>
      Promise.resolve(parseJson(bridge.openPdfFile(relativePath))),
    
    // Sync methods
    syncStart: () => Promise.resolve(parseJson(bridge.syncStart ? bridge.syncStart() : '{"success": false, "error": "Method not implemented"}')),
    syncStop: () => Promise.resolve(parseJson(bridge.syncStop ? bridge.syncStop() : '{"success": false, "error": "Method not implemented"}')),
    syncGetStatus: () => Promise.resolve(parseJson(bridge.syncGetStatus ? bridge.syncGetStatus() : '{"state": "error", "error": "Method not implemented"}')),
    syncDiscoverPeers: () => Promise.resolve(parseJson(bridge.syncDiscoverPeers ? bridge.syncDiscoverPeers() : '[]')),
    syncPairDevice: (deviceId: string) => Promise.resolve(parseJson(bridge.syncPairDevice ? bridge.syncPairDevice(deviceId) : '{"success": false, "error": "Method not implemented"}')),
    syncUnpairDevice: (deviceId: string) => Promise.resolve(parseJson(bridge.syncUnpairDevice ? bridge.syncUnpairDevice(deviceId) : '{"success": false, "error": "Method not implemented"}')),
    syncGetPeers: () => Promise.resolve(parseJson(bridge.syncGetPeers ? bridge.syncGetPeers() : '[]')),
    syncGetConflicts: () => Promise.resolve(parseJson(bridge.syncGetConflicts ? bridge.syncGetConflicts() : '[]')),
    syncResolveConflict: (conflictId: number, strategy: 'local_wins' | 'remote_wins') => Promise.resolve(parseJson(bridge.syncResolveConflict ? bridge.syncResolveConflict(conflictId, strategy) : '{"success": false, "error": "Method not implemented"}')),
    
     // Sync events: подписываемся через callback-name pattern
     // native вызывает window.__soloSyncEventHandler(json) через evaluateJavascript
     onSyncEvent: (callback: (event: any) => void) => {
       // Проверяем, доступен ли метод syncSetEventCallback
       if (!bridge.syncSetEventCallback) {
         console.warn('[nativeBridge] syncSetEventCallback not available in native API');
         // Возвращаем функцию отписки без регистрации обработчика
         return () => {};
       }
       
       // Регистрируем глобальный обработчик
       const handlerName = '__soloSyncEventHandler';
       (window as any)[handlerName] = (eventJson: string) => {
         try {
           const event = JSON.parse(eventJson);
           callback(event);
         } catch (e) {
           console.error('[nativeBridge] Failed to parse sync event:', e);
         }
       };
       // Сообщаем native, куда слать события
       bridge.syncSetEventCallback(handlerName);
       // Возвращаем функцию отписки
       return () => {
         delete (window as any)[handlerName];
         if (bridge.syncSetEventCallback) {
           bridge.syncSetEventCallback('');
         }
       };
     },
  } as ElectronAPI;
}

let cachedAPI: ElectronAPI | null | undefined;

export function getNativeAPI(): ElectronAPI | null {
  if (cachedAPI !== undefined) return cachedAPI;

  if (__IS_PACKAGED__) {
    cachedAPI = createStubAPI();
  } else if (window.electronAPI) {
    cachedAPI = window.electronAPI;
  } else if (window.SoloBridge) {
    cachedAPI = wrapAndroidBridge();
  } else {
    cachedAPI = null;
  }
  return cachedAPI;
}
