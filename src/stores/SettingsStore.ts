import { makeAutoObservable } from 'mobx';
import { TypographySettings } from '../types';
import { defaultSettings } from '../constants';

export class SettingsStore {
  settings: TypographySettings = defaultSettings;
  isZenMode = false;
  isToolbarExpanded = false;
  isSettingsOpen = false;
  isNewNotebookModalOpen = false;
  isTagModalOpen = false;

  constructor() {
    makeAutoObservable(this);
  }

  updateSettings = (newSettings: Partial<TypographySettings>) => {
    this.settings = { ...this.settings, ...newSettings };
  };

  toggleZenMode = () => {
    this.isZenMode = !this.isZenMode;
  };

  toggleToolbar = () => {
    this.isToolbarExpanded = !this.isToolbarExpanded;
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