import { NotesStore } from './NotesStore';
import { SettingsStore } from './SettingsStore';
import { TagsStore } from './TagsStore';
import { SavedFiltersStore } from './SavedFiltersStore';
import { SeenStore } from './SeenStore';
import { createExportFileRequest } from '../components/Search/export/exportNotes';
import { Note, SavedFilter } from '../types';
import { flags } from '../utils/featureFlags';
import { getNativeAPI } from '../utils/nativeBridge';

export class RootStore {
  notesStore: NotesStore;
  settingsStore: SettingsStore;
  tagsStore: TagsStore;
  savedFiltersStore: SavedFiltersStore;
  seenStore: SeenStore;
  private autoExportQueue: Promise<void> = Promise.resolve();

  constructor() {
    this.notesStore = new NotesStore();
    this.settingsStore = new SettingsStore(this.notesStore);
    this.tagsStore = new TagsStore();
    this.savedFiltersStore = new SavedFiltersStore();
    this.seenStore = new SeenStore();

    // Provide NotesStore with reference to RootStore for accessing other stores
    this.notesStore.setRootStore(this);
  }

  onCurrentNoteSaved = () => {
    this.autoExportQueue = this.autoExportQueue
      .then(() => this.autoExportSavedSearches())
      .catch(error => console.error('Failed to auto-export saved searches:', error));
  };

  private autoExportSavedSearches = async () => {
    if (!__IS_DESKTOP__ || !flags.exportNotes) return;

    const api = getNativeAPI();
    if (!api) return;

    const filters = this.savedFiltersStore.savedFilters.filter(filter =>
      filter.exportProfile?.autoExport && filter.exportProfile.outputPath,
    );

    for (const filter of filters) {
      const profile = filter.exportProfile!;
      const request = await createExportFileRequest(
        profile,
        filter,
        this.getFilteredNotes(filter),
        profile.outputPath,
      );
      const result = await api.exportFile(request);
      if (!result.success) {
        console.error(`Failed to auto-export saved search "${filter.label}":`, result.error);
      }
    }
  };

  private getFilteredNotes = (filter: SavedFilter): Note[] => {
    const query = filter.searchQuery.trim();
    const fuzzyMatch = (text: string) => {
      if (!query) return true;
      const normalizedText = text.toLowerCase();
      const normalizedQuery = query.toLowerCase();
      let queryIndex = 0;
      for (let index = 0; index < normalizedText.length && queryIndex < normalizedQuery.length; index++) {
        if (normalizedText[index] === normalizedQuery[queryIndex]) queryIndex++;
      }
      return queryIndex === normalizedQuery.length;
    };
    const getMatchingParagraphs = (content: string) => {
      if (filter.tagFilters.length === 0) return [];
      const documentElement = document.createElement('div');
      documentElement.innerHTML = content;
      return Array.from(documentElement.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li')).filter(element => {
        const paragraphTags = (element.getAttribute('data-tags') || '').split(',').map(tag => tag.trim()).filter(Boolean);
        return filter.tagFilters.some(tagFilter => paragraphTags.some(tag => tag.includes(tagFilter.path)));
      });
    };

    let notes = this.notesStore.getVisibleNotes();
    if (filter.showOnlyEmptyNotes) notes = notes.filter(note => this.notesStore.isNoteEmpty(note));
    if (query) {
      notes = notes.filter(note => fuzzyMatch(note.title) || getMatchingParagraphsForText(note.content, fuzzyMatch));
    }
    if (filter.tagFilters.length > 0) {
      notes = notes.filter(note => {
        if (getMatchingParagraphs(note.content).length > 0) return true;
        const allTags = [...note.tags, ...(note.paragraphTags || [])];
        const matches = (operator: 'AND' | 'OR' | 'NOT') => filter.tagFilters.filter(tagFilter => tagFilter.operator === operator);
        const andFilters = matches('AND');
        const orFilters = matches('OR');
        const notFilters = matches('NOT');
        return (andFilters.length === 0 || andFilters.every(tagFilter => allTags.some(tag => tag.includes(tagFilter.path))))
          && (orFilters.length === 0 || orFilters.some(tagFilter => allTags.some(tag => tag.includes(tagFilter.path))))
          && notFilters.every(tagFilter => !allTags.some(tag => tag.includes(tagFilter.path)));
      });
    }
    return notes.slice().sort((first, second) => {
      if (query) {
        const firstTitle = first.title.toLowerCase().includes(query.toLowerCase());
        const secondTitle = second.title.toLowerCase().includes(query.toLowerCase());
        if (firstTitle && !secondTitle) return -1;
        if (!firstTitle && secondTitle) return 1;
      }
      return second.createdAt.getTime() - first.createdAt.getTime();
    });
  };
}

const getMatchingParagraphsForText = (content: string, matches: (text: string) => boolean): boolean => {
  const documentElement = document.createElement('div');
  documentElement.innerHTML = content;
  return Array.from(documentElement.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li'))
    .some(element => matches(element.textContent || ''));
};
