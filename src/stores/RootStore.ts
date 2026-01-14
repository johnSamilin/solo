import { NotesStore } from './NotesStore';
import { SettingsStore } from './SettingsStore';
import { TagsStore } from './TagsStore';
import { migrationManager } from '../utils/migration';

export class RootStore {
  notesStore: NotesStore;
  settingsStore: SettingsStore;
  tagsStore: TagsStore;

  constructor() {
    this.notesStore = new NotesStore();
    this.settingsStore = new SettingsStore(this.notesStore);
    this.tagsStore = new TagsStore();

    // Provide NotesStore with reference to RootStore for accessing other stores
    this.notesStore.setRootStore(this);

    // Run tag migration to convert old Tag[] format to string[]
    this.runMigrations();
  }

  private async runMigrations() {
    try {
      await migrationManager.migrateTagsToStrings();
    } catch (error) {
      console.error('Migration error:', error);
    }
  }
}