import { makeAutoObservable } from 'mobx';
import { TypographySettings, CensorshipSettings } from '../types';
import { defaultSettings } from '../constants';
import { isPlugin } from '../config';

const STORAGE_KEY = 'solo-settings';

export class SettingsStore {
  settings: TypographySettings = defaultSettings;
  censorship: CensorshipSettings = {
    pin: null,
    enabled: true
  };
  fakeCensorshipDisabled = false;
  isZenMode = false;
  isToolbarExpanded = false;
  isSettingsOpen = false;
  isNewNotebookModalOpen = false;
  isTagModalOpen = false;
  isNoteSettingsOpen = false;
  exportPath = '';

  constructor() {
    makeAutoObservable(this);
    this.loadFromStorage();
    this.setupKeyboardShortcuts();
  }

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
      let storedSettings = null;
      
      if (isPlugin && window.bridge) {
        storedSettings = JSON.parse(await window.bridge.loadFromStorage(STORAGE_KEY) ?? '{ "settings": {} }');
      } else {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          storedSettings = JSON.parse(stored);
        }
      }

      if (storedSettings) {
        const data = storedSettings;
        this.settings = data.settings;
        this.censorship = data.censorship ? { ...data.censorship, enabled: true } : { pin: null, enabled: true };
        this.isZenMode = data.isZenMode;
        this.isToolbarExpanded = data.isToolbarExpanded;
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  private saveToStorage = async () => {
    try {
      const data = {
        settings: this.settings,
        censorship: this.censorship,
        isZenMode: this.isZenMode,
        isToolbarExpanded: this.isToolbarExpanded
      };

      if (isPlugin && window.bridge) {
        await window.bridge.saveToStorage(STORAGE_KEY, JSON.stringify(data));
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      }
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  updateSettings = (newSettings: Partial<TypographySettings>) => {
    this.settings = { ...this.settings, ...newSettings };
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