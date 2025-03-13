import { NotesStore } from './NotesStore';
import { SettingsStore } from './SettingsStore';
import { TagsStore } from './TagsStore';

export class RootStore {
  notesStore: NotesStore;
  settingsStore: SettingsStore;
  tagsStore: TagsStore;

  constructor() {
    this.notesStore = new NotesStore();
    this.settingsStore = new SettingsStore();
    this.tagsStore = new TagsStore();
  }
}