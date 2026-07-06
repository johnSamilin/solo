import { makeAutoObservable, runInAction } from 'mobx';
import { SavedFilter } from '../types';
import { generateUniqueId } from '../utils';
import { isPlugin } from '../config';
import { getNativeAPI, isNative } from '../utils/nativeBridge';

const STORAGE_KEY = 'solo-saved-filters';

export class SavedFiltersStore {
  savedFilters: SavedFilter[] = [];

  constructor() {
    makeAutoObservable(this);
    this.loadFromStorage();
  }

  saveFilter(
    label: string,
    searchQuery: string,
    tagFilters: { path: string; operator: 'AND' | 'OR' | 'NOT' }[],
    showOnlyEmptyNotes: boolean,
  ) {
    const filter: SavedFilter = {
      id: generateUniqueId(),
      label,
      searchQuery,
      tagFilters: tagFilters.map(f => ({ path: f.path, operator: f.operator })),
      showOnlyEmptyNotes,
    };
    this.savedFilters.push(filter);
    this.saveToStorage();
  }

  updateLabel(id: string, newLabel: string) {
    const filter = this.savedFilters.find(f => f.id === id);
    if (filter) {
      filter.label = newLabel;
      this.saveToStorage();
    }
  }

  deleteFilter(id: string) {
    this.savedFilters = this.savedFilters.filter(f => f.id !== id);
    this.saveToStorage();
  }

  private loadFromStorage = async () => {
    try {
      let storedData = { savedFilters: [] as SavedFilter[] };

      if (isPlugin) {
        if (window.bridge?.loadFromStorage) {
          storedData = (await window.bridge.loadFromStorage(STORAGE_KEY)) ?? { savedFilters: [] };
          if (typeof storedData === 'string') {
            storedData = JSON.parse(storedData);
          }
        }
      } else if (isNative) {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          storedData = JSON.parse(stored);
        }
      } else {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          storedData = JSON.parse(stored);
        }
      }

      if (storedData?.savedFilters) {
        runInAction(() => {
          this.savedFilters = storedData.savedFilters;
        });
      }
    } catch (error) {
      console.error('Error loading saved filters:', error);
    }
  };

  private saveToStorage = async () => {
    try {
      const data = {
        savedFilters: this.savedFilters,
      };

      if (isPlugin) {
        if (window.bridge?.saveToStorage) {
          try {
            await window.bridge.saveToStorage(STORAGE_KEY, data);
          } catch (_er) {
            await window.bridge.saveToStorage(STORAGE_KEY, JSON.stringify(data));
          }
        }
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      }
    } catch (error) {
      console.error('Error saving saved filters:', error);
    }
  };
}
