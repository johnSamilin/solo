import { makeAutoObservable } from 'mobx';
import { TypographySettings, Toast } from '../types';
import { NotesStore } from './NotesStore';
import { defaultSettings, themes } from '../constants';

import { getNativeAPI } from '../utils/nativeBridge';
import { flags } from '../utils/featureFlags';

const STORAGE_KEY = 'solo-settings';
const SECURE_STORAGE_KEY = 'solo-secure-settings';

export class SettingsStore {
  private notesStore: NotesStore;
  settings: TypographySettings = flags.defaultTheme ? themes[flags.defaultTheme]?.settings : defaultSettings;
  selectedTheme: string | null = null;
  isZenMode = false;
  isToolbarExpanded = false;
  isSettingsOpen = false;
  isNewNotebookModalOpen = false;
  isNoteSettingsOpen = false;
  toast: Toast | null = null;
  activeSettingsTab: 'typography' | 'layout' | 'data' | 'tags' | 'statistics' = 'typography';
  dataFolder: string | null = null;
  digikamDbPath: string | null = null;


  constructor(notesStore: NotesStore) {
    console.log(this.settings, themes[flags.defaultTheme]?.settings)
    this.notesStore = notesStore;
    makeAutoObservable(this);
    this.loadFromStorage();
    this.setupKeyboardShortcuts();
    this.checkDataFolder();
  }

  checkDataFolder = async () => {
    const api = getNativeAPI();
    if (api) {
      const result = await api.getDataFolder();
      if (result.success && result.path) {
        this.dataFolder = result.path;
      }
    }
  };

  setDataFolder = (path: string | null) => {
    this.dataFolder = path;
  };

  setToast = (message: string, type: 'success' | 'error') => {
    this.toast = { message, type };
  };

  clearToast = () => {
    this.toast = null;
  };


  private setupKeyboardShortcuts = () => {
  };

  private loadFromStorage = async () => {
    try {
      
      const stored = localStorage.getItem(STORAGE_KEY);

      if (stored) {
        const data = JSON.parse(stored);
        this.settings = data.settings;
        this.isZenMode = data.isZenMode;
        this.isToolbarExpanded = data.isToolbarExpanded;
        this.digikamDbPath = data.digikamDbPath || null;
        this.selectedTheme = data.selectedTheme;
      } else {
        this.selectedTheme = flags.defaultTheme;
      }

    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  private saveToStorage = async () => {
    try {
      const data = {
        settings: this.settings,
        isZenMode: this.isZenMode,
        isToolbarExpanded: this.isToolbarExpanded,
        digikamDbPath: this.digikamDbPath,
        selectedTheme: this.selectedTheme,
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  setSelectedTheme = (theme: string | null) => {
    this.selectedTheme = theme;
    if (theme && themes[theme]) {
      this.updateSettings(themes[theme].settings);
    }
    this.saveToStorage();
  };

  updateSettings = (newSettings: Partial<TypographySettings>) => {
    this.settings = { ...this.settings, ...newSettings };
    this.saveToStorage();
  };



  toggleZenMode = () => {
    this.isZenMode = !this.isZenMode;
    getNativeAPI()?.toggleZenMode(this.isZenMode);
    this.saveToStorage();
  };

  turnZenModeOff = () => {
    this.isZenMode = false;
    getNativeAPI()?.toggleZenMode(false);
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

  setNoteSettingsOpen = (isOpen: boolean) => {
    this.isNoteSettingsOpen = isOpen;
  };

  setActiveSettingsTab = (tab: 'typography' | 'layout' | 'data' | 'tags' | 'statistics') => {
    this.activeSettingsTab = tab;
  };

  setDigikamDbPath = (path: string | null) => {
    this.digikamDbPath = path;
    this.saveToStorage();
  };
}