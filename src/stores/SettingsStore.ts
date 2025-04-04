import { makeAutoObservable } from 'mobx';
import { TypographySettings, CensorshipSettings, WebDAVSettings, Toast } from '../types';
import { defaultSettings } from '../constants';
import { isPlugin } from '../config';

const STORAGE_KEY = 'solo-settings';

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

  private loadFromStorage = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        this.settings = data.settings;
        this.censorship = data.censorship ? { ...data.censorship, enabled: true } : { pin: null, enabled: true };
        this.webDAV = data.webDAV || this.webDAV;
        this.isZenMode = data.isZenMode;
        this.isToolbarExpanded = data.isToolbarExpanded;
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  private saveToStorage = () => {
    try {
      const data = {
        settings: this.settings,
        censorship: this.censorship,
        webDAV: this.webDAV,
        isZenMode: this.isZenMode,
        isToolbarExpanded: this.isToolbarExpanded
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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