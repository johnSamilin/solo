import { makeAutoObservable } from 'mobx';
import { TypographySettings, Toast } from '../types';
import { NotesStore } from './NotesStore';
import { defaultSettings } from '../constants';
import { isPlugin } from '../config';

const STORAGE_KEY = 'solo-settings';
const SECURE_STORAGE_KEY = 'solo-secure-settings';

export class SettingsStore {
  private notesStore: NotesStore;
  settings: TypographySettings = defaultSettings;
  isZenMode = false;
  isToolbarExpanded = false;
  isSettingsOpen = false;
  isNewNotebookModalOpen = false;
  isNoteSettingsOpen = false;
  toast: Toast | null = null;
  activeSettingsTab: 'typography' | 'layout' = 'typography';

  constructor(notesStore: NotesStore) {
    this.notesStore = notesStore;
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


  private setupKeyboardShortcuts = () => {
  };

  private loadFromStorage = async () => {
    try {
      if (isPlugin) {
        let data = await window.bridge.loadFromStorage(STORAGE_KEY);
        if (typeof data === 'string') {
          data = JSON.parse(data);
        }
        if (data) {
          this.settings = data.settings;
          this.isZenMode = data.isZenMode;
          this.isToolbarExpanded = data.isToolbarExpanded;
        }
      } else {
        const stored = localStorage.getItem(STORAGE_KEY);

        if (stored) {
          const data = JSON.parse(stored);
          this.settings = data.settings;
          this.isZenMode = data.isZenMode;
          this.isToolbarExpanded = data.isToolbarExpanded;
        }
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
        isToolbarExpanded: this.isToolbarExpanded
      };

      if (isPlugin) {
        try {
          await window.bridge.saveToStorage(STORAGE_KEY, data);
        } catch (er) {
          await window.bridge?.saveToStorage(STORAGE_KEY, JSON.stringify(data));
        }
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

  setNoteSettingsOpen = (isOpen: boolean) => {
    this.isNoteSettingsOpen = isOpen;
  };

  setActiveSettingsTab = (tab: 'typography' | 'layout') => {
    this.activeSettingsTab = tab;
  };
}