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

      // Check for sync reminder after loading settings
      this.checkSyncReminder();
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
    } catch (error) {
      console.error('Error saving settings:', error);
    }
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

  setNoteSettingsOpen = (isOpen: boolean) => {
    this.isNoteSettingsOpen = isOpen;
  };

  setActiveSettingsTab = (tab: 'typography' | 'layout' | 'censorship' | 'data' | 'sync') => {
    this.activeSettingsTab = tab;
    if (this.isSettingsOpen) {
      analytics.settingsOpened(tab);
    }
  };

  checkSyncReminder = async () => {
    if (this.syncMode !== 'server' || !this.server.token) {
      return;
    }

    try {
      const { notesStore } = await import('./StoreProvider');
      const store = notesStore;
      
      // Get server timestamp
      const response = await fetch(`${this.server.url}/api/data`, {
        method: 'HEAD',
        headers: {
          'Authorization': `Bearer ${this.server.token}`,
        },
      });

      if (response.ok) {
        const lastModified = response.headers.get('Last-Modified');
        const serverTimestamp = lastModified ? new Date(lastModified).getTime() : 0;
        
        // Compare with local changes
        if (store.syncMetadata.lastLocalChange > Math.max(serverTimestamp, store.syncMetadata.lastServerSync)) {
          this.showSyncReminder();
        }
      }
    } catch (error) {
      console.error('Error checking sync status:', error);
    }
  };

  private showSyncReminder = () => {
    // Create a persistent toast that doesn't auto-dismiss
    const reminderToast = document.createElement('div');
    reminderToast.className = 'sync-reminder-toast';
    reminderToast.innerHTML = `
      <div class="sync-reminder-content">
        <span>You have local changes that haven't been synced to the server</span>
        <button class="sync-reminder-button" onclick="this.parentElement.parentElement.remove()">
          Sync Now (Ctrl+S)
        </button>
        <button class="sync-reminder-dismiss" onclick="this.parentElement.parentElement.remove()">
          ×
        </button>
      </div>
    `;
    
    document.body.appendChild(reminderToast);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (reminderToast.parentElement) {
        reminderToast.remove();
      }
    }, 10000);
  };
}