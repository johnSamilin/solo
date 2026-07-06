import { NotesStore } from './NotesStore';
import { SettingsStore } from './SettingsStore';
import { TagsStore } from './TagsStore';
import { SavedFiltersStore } from './SavedFiltersStore';

export class RootStore {
  notesStore: NotesStore;
  settingsStore: SettingsStore;
  tagsStore: TagsStore;
  savedFiltersStore: SavedFiltersStore;

  constructor() {
    this.notesStore = new NotesStore();
    this.settingsStore = new SettingsStore(this.notesStore);
    this.tagsStore = new TagsStore();
    this.savedFiltersStore = new SavedFiltersStore();

    // Provide NotesStore with reference to RootStore for accessing other stores
    this.notesStore.setRootStore(this);
  }
}