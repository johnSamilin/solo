import { makeAutoObservable, runInAction } from 'mobx';
import { SavedFilter } from '../types';
import { generateUniqueId } from '../utils';

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

      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        storedData = JSON.parse(stored);
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

      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving saved filters:', error);
    }
  };
}
