import { makeAutoObservable } from 'mobx';
import { TypographySettings, CensorshipSettings, WebDAVSettings, ServerSettings, Toast, SyncMode } from '../types';
import { defaultSettings } from '../constants';
import { isPlugin } from '../config';
import { analytics } from '../utils/analytics';

const STORAGE_KEY = 'solo-settings';
const SECURE_STORAGE_KEY = 'solo-secure-settings';

export class SettingsStore {
  settings: TypographySettings = defaultSettings;
  censorship: CensorshipSettings = {
    pin: null,
    enabled: true
  };
  webDAV: WebDAVSettings = {
    url: '',
    username: '',
    password: '',
    enabled: false
  };
  server: ServerSettings = {
    url: '',
    username: '',
    password: '',
    enabled: false,
    token: undefined
  };
  syncMode: SyncMode = 'none';
  fakeCensorshipDisabled = false;
  isZenMode = false;
  isToolbarExpanded = false;
  isSettingsOpen = false;
  isNewNotebookModalOpen = false;
  isTagModalOpen = false;
  isNoteSettingsOpen = false;
  exportPath = '';
  importStatus: 'idle' | 'success' | 'error' = 'idle';
  toast: Toast | null = null;
  activeSettingsTab: 'typography' | 'layout' | 'censorship' | 'data' | 'sync' = 'typography';

  constructor() {
    makeAutoObservable(this);
    this.loadFromStorage();
    this.setupKeyboardShortcuts();
  }

  setToast = (message: string, type: 'success' | 'error') => {
    this.toast = { message, type };
  };

  clearToast = () => {
    this.toast = null;
  };

  setImportStatus = (status: 'idle' | 'success' | 'error') => {
    this.importStatus = status;
    if (status !== 'idle') {
      setTimeout(() => {
        this.importStatus = 'idle';
      }, 3000);
    }
  };

  private setupKeyboardShortcuts = () => {
    document.addEventListener('keydown', (e) => {
      // Ctrl+. to turn censorship on or open settings
      if (e.ctrlKey && e.key === '.') {
        if (this.censorship.enabled) {
          this.activeSettingsTab = 'censorship';
          this.isSettingsOpen = true;
        } else {
          this.enableCensorship();
        }
      }
    });
  };

  private loadFromStorage = async () => {
    try {
      // Load regular settings
      if (isPlugin) {
        let data = await window.bridge.loadFromStorage(STORAGE_KEY);
        if (typeof data === 'string') {
          data = JSON.parse(data);
        }
        if (data) {
          this.settings = data.settings;
          this.isZenMode = data.isZenMode;
          this.isToolbarExpanded = data.isToolbarExpanded;
          this.syncMode = data.syncMode || 'none';
        }

        // Load secure settings
        let secureData = await window.bridge.loadFromStorage(SECURE_STORAGE_KEY);
        if (typeof secureData === 'string') {
          secureData = JSON.parse(secureData);
        }
        if (secureData) {
          this.censorship = secureData.censorship ? 
            { ...secureData.censorship, enabled: true } : 
            { pin: null, enabled: true };
          this.webDAV = secureData.webDAV || this.webDAV;
          this.server = secureData.server || this.server;
        }
      } else {
        const stored = localStorage.getItem(STORAGE_KEY);
        const secureStored = localStorage.getItem(SECURE_STORAGE_KEY);
        
        if (stored) {
          const data = JSON.parse(stored);
          this.settings = data.settings;
          this.isZenMode = data.isZenMode;
          this.isToolbarExpanded = data.isToolbarExpanded;
          this.syncMode = data.syncMode || 'none';
        }

        if (secureStored) {
          const secureData = JSON.parse(secureStored);
          this.censorship = secureData.censorship ? 
            { ...secureData.censorship, enabled: true } : 
            { pin: null, enabled: true };
          this.webDAV = secureData.webDAV || this.webDAV;
          this.server = secureData.server || this.server;
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  private saveToStorage = async () => {
    try {
      // Save regular settings
      const data = {
        settings: this.settings,
        isZenMode: this.isZenMode,
        isToolbarExpanded: this.isToolbarExpanded,
        syncMode: this.syncMode
      };

      // Save secure settings separately
      const secureData = {
        censorship: this.censorship,
        webDAV: this.webDAV,
        server: this.server
      };

      if (isPlugin) {
        try {
          await window.bridge.saveToStorage(STORAGE_KEY, data);
          await window.bridge.saveToStorage(SECURE_STORAGE_KEY, secureData);
        } catch (er) {
          await window.bridge?.saveToStorage(STORAGE_KEY, JSON.stringify(data));
          await window.bridge?.saveToStorage(SECURE_STORAGE_KEY, JSON.stringify(secureData));
        }
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        localStorage.setItem(SECURE_STORAGE_KEY, JSON.stringify(secureData));
      }

      // Start or stop background sync based on local storage settings
      this.manageBackgroundSync();
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  private backgroundSyncInterval: NodeJS.Timeout | null = null;

  private manageBackgroundSync = () => {
    // Register or unregister background sync based on settings
    if (this.settings.storeImagesLocally && 
        this.settings.localImageStoragePath && 
        this.syncMode === 'server' && 
        this.server.url) {
      this.registerBackgroundSync();
    } else {
      this.unregisterBackgroundSync();
    }
  };

  private registerBackgroundSync = async () => {
    try {
      // Check if service worker and periodic background sync are supported
      if ('serviceWorker' in navigator && 'periodicSync' in window.ServiceWorkerRegistration.prototype) {
        const registration = await navigator.serviceWorker.ready;
        
        // Store directory handle in IndexedDB for service worker access
        await this.storeDirectoryHandle();
        
        // Register periodic background sync
        await registration.periodicSync.register('image-storage-sync', {
          minInterval: 5 * 60 * 1000, // 5 minutes minimum interval
        });
        
        console.log('Periodic background sync registered for local image storage');
      } else {
        console.warn('Periodic Background Sync not supported, falling back to visibility-based sync');
        this.setupVisibilityBasedSync();
      }
    } catch (error) {
      console.error('Failed to register periodic background sync:', error);
      // Fallback to visibility-based sync
      this.setupVisibilityBasedSync();
    }
  };

  private storeDirectoryHandle = async () => {
    try {
      // Note: In a real implementation, you'd store the actual directory handle
      // For now, we'll just store a placeholder since we can't serialize handles
      const db = await this.openSettingsDB();
      const transaction = db.transaction(['settings'], 'readwrite');
      const store = transaction.objectStore('settings');
      await store.put({ 
        key: 'storage-directory-handle', 
        value: { path: this.settings.localImageStoragePath } 
      });
    } catch (error) {
      console.error('Failed to store directory handle:', error);
    }
  };

  private openSettingsDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('solo-settings', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };
    });
  };

  private unregisterBackgroundSync = async () => {
    try {
      if ('serviceWorker' in navigator && 'periodicSync' in window.ServiceWorkerRegistration.prototype) {
        const registration = await navigator.serviceWorker.ready;
        const tags = await registration.periodicSync.getTags();
        
        if (tags.includes('image-storage-sync')) {
          await registration.periodicSync.unregister('image-storage-sync');
          console.log('Periodic background sync unregistered');
        }
      }
      
      // Clean up visibility-based sync
      this.cleanupVisibilityBasedSync();
    } catch (error) {
      console.error('Failed to unregister periodic background sync:', error);
    }
  };

  private visibilityChangeHandler: (() => void) | null = null;

  private setupVisibilityBasedSync = () => {
    // Fallback: sync when page becomes visible
    this.visibilityChangeHandler = () => {
      if (!document.hidden) {
        this.performBackgroundSync();
      }
    };
    
    document.addEventListener('visibilitychange', this.visibilityChangeHandler);
    console.log('Visibility-based sync setup as fallback');
  };

  private cleanupVisibilityBasedSync = () => {
    if (this.visibilityChangeHandler) {
      document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
      this.visibilityChangeHandler = null;
    }
  };

  private performBackgroundSync = async () => {
    try {
      const response = await fetch(`${this.server.url}/api/ping`, {
        method: 'GET',
        headers: {
          'Authorization': this.server.token ? `Bearer ${this.server.token}` : '',
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Background sync ping successful:', data.timestamp);
      } else {
        console.warn('Background sync ping failed:', response.status);
      }
    } catch (error) {
      console.error('Background sync ping error:', error);
    }
  };

  // Clean up interval when store is destroyed
  destroy = () => {
    this.unregisterBackgroundSync();
    this.cleanupVisibilityBasedSync();
  };
  updateSettings = (newSettings: Partial<TypographySettings>) => {
    this.settings = { ...this.settings, ...newSettings };
    this.saveToStorage();
  };

  updateWebDAV = (newSettings: Partial<WebDAVSettings>) => {
    this.webDAV = { ...this.webDAV, ...newSettings };
    this.saveToStorage();
  };

  updateServer = (newSettings: Partial<ServerSettings>) => {
    this.server = { ...this.server, ...newSettings };
    this.saveToStorage();
  };

  setSyncMode = (mode: SyncMode) => {
    this.syncMode = mode;
    if (mode === 'webdav') {
      this.webDAV.enabled = true;
      this.server.enabled = false;
    } else if (mode === 'server') {
      this.server.enabled = true;
      this.webDAV.enabled = false;
    } else {
      this.webDAV.enabled = false;
      this.server.enabled = false;
    }
    this.saveToStorage();
  };

  setServerToken = (token: string) => {
    this.server.token = token;
    this.saveToStorage();
  };

  setCensorshipPin = (pin: string) => {
    this.censorship.pin = pin;
    this.saveToStorage();
  };

  enableCensorship = () => {
    this.censorship.enabled = true;
    this.fakeCensorshipDisabled = false;
    this.saveToStorage();
    analytics.censorshipToggled(true);
  };

  disableCensorship = (currentPin: string) => {
    if (this.censorship.pin === currentPin) {
      this.censorship.enabled = false;
      this.fakeCensorshipDisabled = false;
      this.saveToStorage();
      analytics.censorshipToggled(false);
      return true;
    }
    
    // When PIN is incorrect, set fake disabled state but keep censorship enabled
    this.fakeCensorshipDisabled = true;
    this.censorship.enabled = true;
    this.saveToStorage();
    return true;
  };

  isCensorshipEnabled = () => {
    // Always return true if censorship is enabled, regardless of fake disabled state
    return this.censorship.enabled;
  };

  toggleZenMode = () => {
    this.isZenMode = !this.isZenMode;
    this.saveToStorage();
    analytics.zenModeToggled(this.isZenMode);
  };

  turnZenModeOff = () => {
    this.isZenMode = false;
    this.saveToStorage();    
    analytics.zenModeToggled(false);
  };

  toggleToolbar = () => {
    this.isToolbarExpanded = !this.isToolbarExpanded;
    this.saveToStorage();
  };

  setSettingsOpen = (isOpen: boolean) => {
    this.isSettingsOpen = isOpen;
    if (isOpen) {
      analytics.settingsOpened(this.activeSettingsTab);
    }
  };

  setNewNotebookModalOpen = (isOpen: boolean) => {
    this.isNewNotebookModalOpen = isOpen;
  };

  setTagModalOpen = (isOpen: boolean) => {
    this.isTagModalOpen = isOpen;
  };

  setNoteSettingsOpen = (isOpen: boolean) => {
    this.isNoteSettingsOpen = isOpen;
  };

  setActiveSettingsTab = (tab: 'typography' | 'layout' | 'censorship' | 'data' | 'sync') => {
    this.activeSettingsTab = tab;
    if (this.isSettingsOpen) {
      analytics.settingsOpened(tab);
    }
  };
}