import { NotesStore } from './NotesStore';
import { SettingsStore } from './SettingsStore';
import { TagsStore } from './TagsStore';

export class RootStore {
  notesStore: NotesStore;
  settingsStore: SettingsStore;
  tagsStore: TagsStore;

  constructor() {
    this.notesStore = new NotesStore();
    this.settingsStore = new SettingsStore(this.notesStore);
    this.tagsStore = new TagsStore();
    
    // Initialize tags from notes when notes are loaded
    this.initializeTags();
  }

  private initializeTags = () => {
    // Wait for notes to load, then initialize tags
    const checkNotesLoaded = () => {
      if (!this.notesStore.isLoading && this.notesStore.notes.length > 0) {
        this.tagsStore.initializeFromNotes(this.notesStore.notes);
      } else if (!this.notesStore.isLoading) {
        // Notes loaded but empty, still initialize
        this.tagsStore.initializeFromNotes([]);
      } else {
        // Still loading, check again
        setTimeout(checkNotesLoaded, 100);
      }
    };
    
    checkNotesLoaded();
  }
}