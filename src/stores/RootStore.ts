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

    // Provide stores with reference to RootStore for cross-store access
    this.notesStore.setRootStore(this);
    this.syncStore.setRootStore(this);
  }
}