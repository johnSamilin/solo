interface FileMetadata {
  id: string;
  tags: string[];
  createdAt: string;
}

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
}

interface SyncPeerDevice {
  id: string;
  name: string;
  deviceType: 'android' | 'linux' | 'mac' | 'electron';
  macAddress?: string;
  lastSeenAt: number;
  firstSeenAt: number;
  trustStatus: 'pending' | 'trusted' | 'blocked';
  isPaired: boolean;
  protocolVersion: number;
}

interface SyncConflict {
  conflictId: number;
  fileId: string;
  filePath: string | null;
  localVersion: number;
  remoteVersion: number;
  localChecksum: string | null;
  remoteChecksum: string | null;
  localModifiedAt: number;
  remoteModifiedAt: number;
  resolution: 'pending' | 'auto_resolved' | 'manual';
  resolvedAt: number | null;
  resolvedBy: 'lww' | 'local_wins' | 'remote_wins' | 'manual_merge' | null;
  createdAt: number;
}

interface SyncStatus {
  state: 'idle' | 'discovering' | 'connecting' | 'handshake' | 'syncing' | 'resolving_conflicts' | 'complete' | 'error';
  lastSyncAt: number | null;
  connectedPeers: SyncPeerDevice[];
  progress: { totalFiles: number; transferredFiles: number; currentFile?: string; phase: string } | null;
  error: string | null;
}

interface SyncEvent {
  type: string;
  timestamp: number;
  data?: any;
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
  checkForUpdates: () => Promise<{ success: boolean; error?: string }>;
  downloadUpdate: () => Promise<{ success: boolean; error?: string }>;
  installUpdate: () => Promise<{ success: boolean; error?: string }>;
  onUpdateStatus: (callback: (event: any, data: any) => void) => () => void;

  // Sync API
  syncStart: () => Promise<{ success: boolean }>;
  syncStop: () => Promise<{ success: boolean }>;
  syncGetStatus: () => Promise<{ success: boolean; status?: SyncStatus }>;
  syncDiscoverPeers: () => Promise<{ success: boolean; peers?: SyncPeerDevice[]; error?: string }>;
  syncPairDevice: (deviceId: string) => Promise<{ success: boolean; error?: string }>;
  syncUnpairDevice: (deviceId: string) => Promise<{ success: boolean; error?: string }>;
  syncGetPeers: () => Promise<{ success: boolean; peers?: SyncPeerDevice[]; error?: string }>;
  syncGetConflicts: () => Promise<{ success: boolean; conflicts?: SyncConflict[]; error?: string }>;
  syncResolveConflict: (conflictId: number, strategy: 'local_wins' | 'remote_wins') => Promise<{ success: boolean; error?: string }>;
  onSyncEvent: (callback: (event: SyncEvent) => void) => () => void;
}

interface AndroidBridgeRaw {
  selectFolder(): void;
  getDataFolder(): string;
  openFile(relativePath: string): string;
  updateFile(relativePath: string, content: string): string;
  readStructure(): string;
  updateMetadata(relativePath: string, metadataJson: string): string;
  scanAllTags(): string;
  createNote(parentPath: string, name: string): string;
  createNotebook(parentPath: string, name: string): string;
  deleteNote(relativePath: string): string;
  deleteNotebook(relativePath: string): string;
  renameNote(relativePath: string, newName: string): string;
  renameNotebook(relativePath: string, newName: string): string;
  uploadImage(base64Data: string, fileName: string): string;
  search(query: string, tagsJson: string): string;
  playTypewriterSound(): void;
  toggleZenMode(enable: boolean): string;
  openPdfFile(relativePath: string): string;

  // Sync methods (optional — могут быть не реализованы)
  syncStart?(): string;
  syncStop?(): string;
  syncGetStatus?(): string;
  syncDiscoverPeers?(): string;
  syncPairDevice?(deviceId: string): string;
  syncUnpairDevice?(deviceId: string): string;
  syncGetPeers?(): string;
  syncGetConflicts?(): string;
  syncResolveConflict?(conflictId: number, strategy: string): string;
  syncSetEventCallback?(callbackName: string): void;
}

interface Window {
  electronAPI: ElectronAPI;
  SoloBridge?: AndroidBridgeRaw;
  __soloSelectFolderCallback?: (resultJson: string) => void;
  __soloSyncEventHandler?: (eventJson: string) => void;
}
