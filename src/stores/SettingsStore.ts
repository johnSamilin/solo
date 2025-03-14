import { makeAutoObservable } from 'mobx';
import { TypographySettings } from '../types';
import { defaultSettings } from '../constants';

const STORAGE_KEY = 'solo-settings';

export class SettingsStore {
  settings: TypographySettings = defaultSettings;
  isZenMode = false;
  isToolbarExpanded = false;
  isSettingsOpen = false;
  isNewNotebookModalOpen = false;
  isTagModalOpen = false;

  constructor() {
    makeAutoObservable(this);
    this.loadFromStorage();
  }

  private loadFromStorage = () => {
    const storedSettings = localStorage.getItem(STORAGE_KEY);
    if (storedSettings) {
      const data = JSON.parse(storedSettings);
      this.settings = data.settings;
      this.isZenMode = data.isZenMode;
      this.isToolbarExpanded = data.isToolbarExpanded;
    }
  };

  private saveToStorage = () => {
    const data = {
      settings: this.settings,
      isZenMode: this.isZenMode,
      isToolbarExpanded: this.isToolbarExpanded
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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

  setTagModalOpen = (isOpen: boolean) => {
    this.isTagModalOpen = isOpen;
  };
}