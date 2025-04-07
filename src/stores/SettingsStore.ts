import { makeAutoObservable } from 'mobx';
import { TypographySettings, CensorshipSettings, WebDAVSettings, Toast } from '../types';
import { defaultSettings } from '../constants';
import { isPlugin } from '../config';

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
      // Ctrl+. to turn censorship on
      if (e.ctrlKey && e.key === '.') {
        this.enableCensorship();
      }
    });
  };

  private loadFromStorage = async () => {
    try {
      // Load regular settings
      if (isPlugin) {
        const data = await window.bridge.loadFromStorage(STORAGE_KEY);
        if (data) {
          this.settings = data.settings;
          this.isZenMode = data.isZenMode;
          this.isToolbarExpanded = data.isToolbarExpanded;
        }

        // Load secure settings
        const secureData = await window.bridge.loadFromStorage(SECURE_STORAGE_KEY);
        if (secureData) {
          this.censorship = secureData.censorship ? 
            { ...secureData.censorship, enabled: true } : 
            { pin: null, enabled: true };
          this.webDAV = secureData.webDAV || this.webDAV;
        }
      } else {
        const stored = localStorage.getItem(STORAGE_KEY);
        const secureStored = localStorage.getItem(SECURE_STORAGE_KEY);
        
        if (stored) {
          const data = JSON.parse(stored);
          this.settings = data.settings;
          this.isZenMode = data.isZenMode;
          this.isToolbarExpanded = data.isToolbarExpanded;
        }

        if (secureStored) {
          const secureData = JSON.parse(secureStored);
          this.censorship = secureData.censorship ? 
            { ...secureData.censorship, enabled: true } : 
            { pin: null, enabled: true };
          this.webDAV = secureData.webDAV || this.webDAV;
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
        isToolbarExpanded: this.isToolbarExpanded
      };

      // Save secure settings separately
      const secureData = {
        censorship: this.censorship,
        webDAV: this.webDAV
      };

      if (isPlugin) {
        await window.bridge.saveToStorage(STORAGE_KEY, data);
        await window.bridge.saveToStorage(SECURE_STORAGE_KEY, secureData);
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

  setCensorshipPin = (pin: string) => {
    this.censorship.pin = pin;
    this.saveToStorage();
  };

  enableCensorship = () => {
    this.censorship.enabled = true;
    this.fakeCensorshipDisabled = false;
    this.saveToStorage();
  };

  disableCensorship = (currentPin: string) => {
    if (this.censorship.pin === currentPin) {
      this.censorship.enabled = false;
      this.fakeCensorshipDisabled = false;
      this.saveToStorage();
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
  };

  turnZenModeOff = () => {
    this.isZenMode = false;
    this.saveToStorage();    
  };

  toggleToolbar = () => {
    this.isToolbarExpanded = !this.isToolbarExpanded;
    this.saveToStorage();
  };

  setSettingsOpen = (isOpen: boolean) => {
    this.isSettingsOpen = isOpen;
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
}