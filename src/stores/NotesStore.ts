import { makeObservable, observable } from 'mobx';
import { Note, Tag, Notebook, ImportMode } from '../types';
import { generateUniqueId } from '../utils';
import { analytics } from '../utils/analytics';
import { isPlugin } from '../config';

const STORAGE_KEY = 'solo-notes-data';

export class NotesStore {
  notes: Note[] = [];
  notebooks: Notebook[] = [{
    id: 'default',
    name: 'Main notebook',
    parentId: null,
    isExpanded: true,
    isCensored: false
  }];
  selectedNote: Note | null = null;
  focusedNotebookId: string | null = null;
  isEditing = false;
  isLoading = false;
  isLoadingNoteContent = false;
  private notebooksByParentId = new Map<string | null, Notebook[]>();
  private notesByNotebookId = new Map<string | null, Note[]>();

  constructor() {
    makeObservable(this, {
      notes: observable,
      notebooks: observable,
      selectedNote: observable,
      focusedNotebookId: observable,
      isEditing: observable,
      isLoading: observable,
      isLoadingNoteContent: observable,
    });
    this.loadFromStorage();
  }

  private cacheNotebooks = () => {
    this.notebooksByParentId = this.notebooks.reduce((agr, notebook) => {
      if (!agr.has(notebook.parentId || null)) {
        agr.set(notebook.parentId || null, []);
      }
      agr.get(notebook.parentId || null)!.push(notebook);
      return agr;
    }, new Map());
  }

  private cacheNotes = () => {
    this.notesByNotebookId = this.notes.reduce((agr, note) => {
      if (note.notebookId) {
        if (!agr.has(note.notebookId)) {
          agr.set(note.notebookId, []);
        }
        agr.get(note.notebookId)!.push(note);
      }
      return agr;
    }, new Map());
  }

  loadFromStorage = async () => {
    this.isLoading = true;
    try {
      let storedData = {
        notes: [],
        notebooks: [{
          id: 'default',
          name: 'Main notebook',
          parentId: null,
          isExpanded: true,
          isCensored: false
        }],
        selectedNoteId: null,
        focusedNotebookId: null
      };

      if (isPlugin) {
        if (window.bridge?.loadFromStorage) {
          const data = await window.bridge.loadFromStorage(STORAGE_KEY);
          if (data) {
            if (typeof data === 'string') {
              storedData = JSON.parse(data);
            } else {
              storedData = data;
            }
          }
        }
      } else {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          storedData = JSON.parse(stored);
        }
      }

      // Load notebooks
      this.notebooks = storedData.notebooks.map(notebook => ({
        ...notebook,
        isExpanded: notebook.isExpanded !== false
      }));

      // Ensure default notebook exists
      if (this.notebooks.length === 0) {
        this.notebooks = [{
          id: 'default',
          name: 'Main notebook',
          parentId: null,
          isExpanded: true,
          isCensored: false
        }];
      }

      // Load notes with date conversion
      this.notes = storedData.notes.map(note => ({
        ...note,
        createdAt: new Date(note.createdAt),
        tags: note.tags || []
      }));

      this.cacheNotebooks();
      this.cacheNotes();

      // Set selected note and focused notebook
      if (storedData.selectedNoteId) {
        const note = this.notes.find(n => n.id === storedData.selectedNoteId);
        if (note) {
          this.selectedNote = note;
        }
      }

      if (storedData.focusedNotebookId) {
        this.focusedNotebookId = storedData.focusedNotebookId;
      }
    } catch (error) {
      console.error('Error loading data:', error);
      this.notebooks = [{
        id: 'default',
        name: 'Main notebook',
        parentId: null,
        isExpanded: true,
        isCensored: false
      }];
      this.notes = [];
    } finally {
      this.isLoading = false;
    }
  };

  freshStart = () => {
    this.notes = [];
    this.notebooks = [{
      id: 'default',
      name: 'Main notebook',
      parentId: null,
      isExpanded: true,
      isCensored: false
    }];
    this.cacheNotebooks();
    this.cacheNotes();
    this.selectedNote = null;
    this.focusedNotebookId = null;
    this.isEditing = false;
    this.saveToStorage();
  };

  importData = (data: { notes: Note[], notebooks: Notebook[] }, mode: ImportMode) => {
    if (mode === 'replace') {
      this.notes = data.notes.map(note => ({
        ...note,
        createdAt: new Date(note.createdAt)
      }));
      this.notebooks = data.notebooks;
      this.selectedNote = null;
      this.focusedNotebookId = null;
    } else {
      // Create a map of existing notebooks by name for deduplication
      const existingNotebooks = new Map(this.notebooks.map(n => [n.id, n]));
      
      // Import notebooks, reusing existing IDs where possible
      data.notebooks.forEach(notebook => {
        const existing = existingNotebooks.get(notebook.id);
        if (!existing) {
          this.notebooks.push(notebook);
        }
      });

      // Create a map for notebook name to ID mapping
      const notebookMap = new Map(this.notebooks.map(n => [n.name, n.id]));

      // Import notes with new IDs and updated notebook references
      const importedNotes = data.notes.map(note => {
        const notebookName = data.notebooks.find(n => n.id === note.notebookId)?.name;
        return {
          ...note,
          id: generateUniqueId(),
          createdAt: new Date(note.createdAt),
          notebookId: notebookName ? notebookMap.get(notebookName) || 'default' : 'default',
          tags: note.tags.map(tag => ({
            ...tag,
            id: generateUniqueId()
          }))
        };
      });

      this.notes = [...this.notes, ...importedNotes];
    }
    this.cacheNotebooks();
    this.cacheNotes();
    this.saveToStorage();
    analytics.dataImported(mode);
  };

  createNote = (notebookId?: string) => {
    const targetNotebookId = notebookId || this.focusedNotebookId || 'default';
    const newNote: Note = {
      id: generateUniqueId(),
      title: 'Untitled Note',
      content: '',
      createdAt: new Date(),
      tags: [],
      notebookId: targetNotebookId,
      isCensored: false
    };
    this.notes.push(newNote);
    this.selectedNote = newNote;
    this.isEditing = true;

    // Ensure the parent notebook is expanded
    const notebook = this.notebooks.find(n => n.id === targetNotebookId);
    if (notebook && !notebook.isExpanded) {
      notebook.isExpanded = true;
    }

    this.saveToStorage();
    this.cacheNotes();
    analytics.noteCreated();
    return newNote;
  };

  updateNote = (noteId: string, updates: Partial<Note>) => {
    const noteIndex = this.notes.findIndex(note => note.id === noteId);
    if (noteIndex !== -1) {
      this.notes[noteIndex] = { ...this.notes[noteIndex], ...updates };
      if (this.selectedNote?.id === noteId) {
        this.selectedNote = this.notes[noteIndex];
      }
      this.saveToStorage();
      this.cacheNotes();
      
      // Track theme changes
      if (updates.theme !== undefined) {
        analytics.themeChanged(updates.theme || 'default');
      }
    }
  };

  updateNotebook = (notebookId: string, updates: Partial<Notebook>) => {
    const notebookIndex = this.notebooks.findIndex(notebook => notebook.id === notebookId);
    if (notebookIndex !== -1) {
      this.notebooks[notebookIndex] = { ...this.notebooks[notebookIndex], ...updates };
      this.saveToStorage();
      this.cacheNotebooks();
    }
  };

  toggleNoteCensorship = (noteId: string) => {
    const note = this.notes.find(n => n.id === noteId);
    if (note) {
      note.isCensored = !note.isCensored;
      if (this.selectedNote?.id === noteId) {
        this.selectedNote = note;
      }
      this.saveToStorage();
      this.cacheNotes();
      analytics.censorshipToggled(note.isCensored);
    }
  };

  toggleNotebookCensorship = (notebookId: string) => {
    const notebook = this.notebooks.find(n => n.id === notebookId);
    if (notebook) {
      notebook.isCensored = !notebook.isCensored;
      this.saveToStorage();
      this.cacheNotebooks();
      analytics.censorshipToggled(notebook.isCensored);
    }
  };

  deleteNote = (noteId: string) => {
    this.notes = this.notes.filter(note => note.id !== noteId);
    if (this.selectedNote?.id === noteId) {
      this.selectedNote = null;
      this.isEditing = false;
    }
    this.saveToStorage();
    this.cacheNotes();
    analytics.noteDeleted();
  };

  setSelectedNote = (note: Note | null) => {
    this.selectedNote = note;
    if (note) {
      this.setFocusedNotebook(note.notebookId);
    }
    this.isEditing = !!note;
    this.saveToStorage();
  };

  setFocusedNotebook = (notebookId: string | null) => {
    this.focusedNotebookId = notebookId;
    this.saveToStorage();
  };

  addTagToNote = (noteId: string, tag: Tag) => {
    const note = this.notes.find(n => n.id === noteId);
    if (note) {
      note.tags.push(tag);
      this.saveToStorage();
      this.cacheNotes();
    }
  };

  removeTagFromNote = (noteId: string, tagId: string) => {
    const note = this.notes.find(n => n.id === noteId);
    if (note) {
      note.tags = note.tags.filter(tag => tag.id !== tagId);
      this.saveToStorage();
      this.cacheNotes();
    }
  };

  createNotebook = (name: string, parentId: string | null = null) => {
    const newNotebook: Notebook = {
      id: generateUniqueId(),
      name,
      parentId,
      isExpanded: true,
      isCensored: false
    };
    this.notebooks.push(newNotebook);
    this.saveToStorage();
    this.cacheNotebooks();
    this.cacheNotes();
    analytics.notebookCreated();
    return newNotebook;
  };

  toggleNotebook = (notebookId: string) => {
    const notebook = this.notebooks.find(n => n.id === notebookId);
    if (notebook) {
      notebook.isExpanded = !notebook.isExpanded;
      this.saveToStorage();
    }
  };

  getNotebookNotes = (notebookId: string) => {
    return this.notesByNotebookId.get(notebookId) ?? [];
  };

  filterCensoredNotes = (notes: Note[], isCensorshipEnabled: boolean) => {
    return notes.filter(note => {
      if (!isCensorshipEnabled) {
        return true;
      }
      if (!this.isNotebookCensored(note.notebookId)) {
        return !note.isCensored;
      } else {
        return false;
      }

      return true;
    });
  }

  getVisibleNotes = (isCensorshipEnabled: boolean) => {
    return this.filterCensoredNotes(this.notes, isCensorshipEnabled);
  };

  getChildNotebooks = (parentId: string | null) => {
    return this.notebooksByParentId.get(parentId) ?? [];
  };

  private getNotebookParentChain = (notebookId: string | null): string[] => {
    if (!notebookId) return [];
    
    const notebook = this.notebooks.find(n => n.id === notebookId);
    if (!notebook) return [];

    return [...this.getNotebookParentChain(notebook.parentId), notebookId];
  };

  isNotebookCensored = (notebookId: string): boolean => {
    // Get the chain of parent notebooks
    const parentChain = this.getNotebookParentChain(notebookId);
    
    // Check if any notebook in the chain is censored
    return parentChain.some(id => {
      const notebook = this.notebooks.find(n => n.id === id);
      return notebook?.isCensored || false;
    });
  };

  getSiblingNotes(noteId: string, isCensorshipEnabled: boolean): { prev: Note; next: Note } {
    const notesList = this.notebooks.reduce((agr, notebook) => {
      const notes = this.filterCensoredNotes(this.getNotebookNotes(notebook.id), isCensorshipEnabled);
      //@ts-expect-error because fuck you
      return agr.concat(notes);
    }, []);

    //@ts-expect-error because fuck you
    const noteIndex = notesList.findIndex((note) => note.id === noteId);
    return {
      next: notesList[noteIndex + 1],
      prev: notesList[noteIndex - 1]
    };
  }

  private async saveToStorage() {
    try {
      const data = {
        notes: this.notes,
        notebooks: this.notebooks,
        selectedNoteId: this.selectedNote?.id || null,
        focusedNotebookId: this.focusedNotebookId
      };

      if (isPlugin) {
        if (window.bridge?.saveToStorage) {
          try {
            await window.bridge.saveToStorage(STORAGE_KEY, data);
          } catch (er) {
            await window.bridge.saveToStorage(STORAGE_KEY, JSON.stringify(data));
          }
        }
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      }
    } catch (error) {
      console.error('Error saving to storage:', error);
    }
  }

  async loadNoteContent(note: Note): Promise<void> {
    // In the simplified version, content is always loaded with the note
    // This method is kept for compatibility but doesn't need to do anything
    return Promise.resolve();
  }

  // Sync operations - export data as JSON for sync
  async exportForSync(): Promise<{ notes: any[], notebooks: any[] }> {
    return {
      notes: this.notes,
      notebooks: this.notebooks
    };
  }

  async importFromSync(data: { notes: any[], notebooks: any[] }): Promise<void> {
    this.importData(data, 'replace');
  }
}
    