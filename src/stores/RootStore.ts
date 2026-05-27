import { NotesStore } from './NotesStore';
import { SettingsStore } from './SettingsStore';
import { TagsStore } from './TagsStore';
import { SyncStore } from './SyncStore';

export class RootStore {
  notesStore: NotesStore;
  settingsStore: SettingsStore;
  tagsStore: TagsStore;
  syncStore: SyncStore;

  constructor() {
    this.notesStore = new NotesStore();
    this.settingsStore = new SettingsStore(this.notesStore);
    this.tagsStore = new TagsStore();
    this.syncStore = new SyncStore();

    // Provide NotesStore with reference to RootStore for accessing other stores
    this.notesStore.setRootStore(this);
  }
}