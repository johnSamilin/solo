import { makeObservable, observable } from 'mobx';
import { Note, Tag, Notebook } from '../types';
import { generateUniqueId } from '../utils';
import { db } from '../utils/database';
import { migrationManager } from '../utils/migration';


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
  private _rootStore: any = null;

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

  setRootStore = (rootStore: any) => {
    this._rootStore = rootStore;
  };

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
      // Check and perform migration if needed
      await migrationManager.checkAndMigrate();
      
      // Initialize database
      await db.initialize();
      
      // Load data from IndexedDB
      await this.loadFromDatabase();
    } catch (error) {
      console.error('Error loading data:', error);
      // Fallback to default data
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

  private async loadFromDatabase() {
    // Load notebooks
    const dbNotebooks = await db.getAllNotebooks();
    this.notebooks = dbNotebooks.map(notebook => ({
      id: notebook.id,
      name: notebook.name,
      parentId: notebook.parentId,
      isExpanded: notebook.isExpanded,
      isCensored: notebook.isCensored
    }));

    // Ensure default notebook exists
    if (this.notebooks.length === 0) {
      const defaultNotebook = {
        id: 'default',
        name: 'Main notebook',
        parentId: null,
        isExpanded: true,
        isCensored: false
      };
      this.notebooks = [defaultNotebook];
      await db.saveNotebook(defaultNotebook);
    }

    // Load note metadata (without content for performance)
    const dbNotes = await db.getAllNotes();
    this.notes = dbNotes.map(note => ({
      id: note.id,
      title: note.title,
      content: '', // Content will be loaded on demand
      createdAt: new Date(note.createdAt),
      notebookId: note.notebookId,
      isCensored: note.isCensored,
      theme: note.theme,
      tags: JSON.parse(note.tags || '[]')
    }));

    this.cacheNotebooks();
    this.cacheNotes();

    // Load selected note and focused notebook from settings
    try {
      // Load sync metadata

      const selectedNoteId = await db.getSetting('selectedNoteId');
      if (selectedNoteId) {
        const note = this.notes.find(n => n.id === selectedNoteId);
        if (note) {
          await this.loadNoteContent(note);
          this.selectedNote = note;
        }
      }

      const focusedNotebookId = await db.getSetting('focusedNotebookId');
      if (focusedNotebookId) {
        this.focusedNotebookId = focusedNotebookId;
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }



  createNote = (notebookId?: string) => {
    const targetNotebookId = notebookId || this.focusedNotebookId || 'default';
    
    // Generate localized title with day and month
    const now = new Date();
    const title = now.toLocaleDateString(undefined, { 
      day: 'numeric', 
      month: 'long' 
    });
    
    const newNote: Note = {
      id: generateUniqueId(),
      title: title,
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

    this.saveNote(newNote);
    this.cacheNotes();
    return newNote;
  };

  updateNote = (noteId: string, updates: Partial<Note>) => {
    const noteIndex = this.notes.findIndex(note => note.id === noteId);
    if (noteIndex !== -1) {
      this.notes[noteIndex] = { ...this.notes[noteIndex], ...updates };
      if (this.selectedNote?.id === noteId) {
        this.selectedNote = this.notes[noteIndex];
      }
        this.saveNote(this.notes[noteIndex]);
      this.cacheNotes();
      
      // Track theme changes
      if (updates.theme !== undefined) {
      }
    }
  };

  updateNotebook = (notebookId: string, updates: Partial<Notebook>) => {
    const notebookIndex = this.notebooks.findIndex(notebook => notebook.id === notebookId);
    if (notebookIndex !== -1) {
      this.notebooks[notebookIndex] = { ...this.notebooks[notebookIndex], ...updates };
        this.saveNotebook(this.notebooks[notebookIndex]);
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
        this.saveNote(note);
      this.cacheNotes();
    }
  };

  toggleNotebookCensorship = (notebookId: string) => {
    const notebook = this.notebooks.find(n => n.id === notebookId);
    if (notebook) {
      notebook.isCensored = !notebook.isCensored;
        this.saveNotebook(notebook);
      this.cacheNotebooks();
    }
  };

  deleteNote = (noteId: string) => {
    this.notes = this.notes.filter(note => note.id !== noteId);
    if (this.selectedNote?.id === noteId) {
      this.selectedNote = null;
      this.isEditing = false;
    }
    this.deleteNoteFromDatabase(noteId);
    this.saveToDatabase();
    this.cacheNotes();
  };

  setSelectedNote = (note: Note | null) => {
    this.selectedNote = note;
    if (note) {
      this.setFocusedNotebook(note.notebookId);
    }
    this.isEditing = !!note;
    this.saveToDatabase();
  };

  setFocusedNotebook = (notebookId: string | null) => {
    this.focusedNotebookId = notebookId;
    this.saveToDatabase();
  };

  addTagToNote = (noteId: string, tag: Tag) => {
    const note = this.notes.find(n => n.id === noteId);
    if (note) {
      note.tags.push(tag);
        this.saveNote(note);
      this.cacheNotes();
    }
  };

  removeTagFromNote = (noteId: string, tagId: string) => {
    const note = this.notes.find(n => n.id === noteId);
    if (note) {
      note.tags = note.tags.filter(tag => tag.id !== tagId);
        this.saveNote(note);
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
    this.saveNotebook(newNotebook);
    this.cacheNotebooks();
    this.cacheNotes();
    return newNotebook;
  };

  toggleNotebook = (notebookId: string) => {
    const notebook = this.notebooks.find(n => n.id === notebookId);
    if (notebook) {
      notebook.isExpanded = !notebook.isExpanded;
        this.saveNotebook(notebook);
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

  // Database operations
  private async saveToDatabase() {
    try {
      // Save current state to database
      await db.saveSetting('selectedNoteId', this.selectedNote?.id || null);
      await db.saveSetting('focusedNotebookId', this.focusedNotebookId);
    } catch (error) {
      console.error('Error saving to database:', error);
    }
  }

  async loadNoteContent(note: Note): Promise<void> {
    if (note.content) return; // Already loaded
    
    this.isLoadingNoteContent = true;
    
    try {
      const dbNote = await db.getNote(note.id);
      if (dbNote) {
        note.content = dbNote.content;
      }
    } catch (error) {
      console.error('Error loading note content:', error);
    } finally {
      this.isLoadingNoteContent = false;
    }
  }

  async saveNote(note: Note): Promise<void> {
    try {
      const dbNote = {
        id: note.id,
        title: note.title,
        content: note.content,
        createdAt: note.createdAt.toISOString(),
        notebookId: note.notebookId,
        isCensored: note.isCensored,
        theme: note.theme,
        tags: JSON.stringify(note.tags)
      };
      await db.saveNote(dbNote);
    } catch (error) {
      console.error('Error saving note:', error);
    }
  }

  async saveNotebook(notebook: Notebook): Promise<void> {
    try {
      await db.saveNotebook({
        id: notebook.id,
        name: notebook.name,
        parentId: notebook.parentId,
        isExpanded: notebook.isExpanded,
        isCensored: notebook.isCensored
      });
    } catch (error) {
      console.error('Error saving notebook:', error);
    }
  }

  async deleteNoteFromDatabase(noteId: string): Promise<void> {
    try {
      await db.deleteNote(noteId);
    } catch (error) {
      console.error('Error deleting note from database:', error);
    }
  }

  async deleteNotebookFromDatabase(notebookId: string): Promise<void> {
    try {
      await db.deleteNotebook(notebookId);
    } catch (error) {
      console.error('Error deleting notebook from database:', error);
    }
  }

}