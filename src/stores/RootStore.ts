import { NotesStore } from './NotesStore';
import { SettingsStore } from './SettingsStore';
import { TagsStore } from './TagsStore';
import { SavedFiltersStore } from './SavedFiltersStore';
import { SeenStore } from './SeenStore';

export class RootStore {
  notesStore: NotesStore;
  settingsStore: SettingsStore;
  tagsStore: TagsStore;
  savedFiltersStore: SavedFiltersStore;
  seenStore: SeenStore;

  constructor() {
    this.notesStore = new NotesStore();
    this.settingsStore = new SettingsStore(this.notesStore);
    this.tagsStore = new TagsStore();
    this.savedFiltersStore = new SavedFiltersStore();
    this.seenStore = new SeenStore();

    // Provide NotesStore with reference to RootStore for accessing other stores
    this.notesStore.setRootStore(this);
  }
}