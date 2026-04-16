import { ElectronAPI, FileMetadata } from '../types';

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
  } as ElectronAPI;
}

let cachedAPI: ElectronAPI | null | undefined;

export function getNativeAPI(): ElectronAPI | null {
  if (cachedAPI !== undefined) return cachedAPI;

  if (window.electronAPI) {
    cachedAPI = window.electronAPI;
  } else if (window.SoloBridge) {
    cachedAPI = wrapAndroidBridge();
  } else {
    cachedAPI = null;
  }
  return cachedAPI;
}
