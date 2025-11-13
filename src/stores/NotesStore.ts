import { makeObservable, observable, runInAction } from 'mobx';
import { Note, Tag, Notebook } from '../types';
import { generateUniqueId } from '../utils';
import { loadFromElectron, loadNoteContent } from '../utils/electron';


export class NotesStore {
  notes: Note[] = [];
  notebooks: Notebook[] = [{
    id: 'default',
    name: 'Main notebook',
    parentId: null,
    isExpanded: true
  }];
  selectedNote: Note | null = null;
  focusedNotebookId: string | null = null;
  isEditing = false;
  isLoading = false;
  isLoadingNoteContent = false;
  notebooksByParentId = new Map<string | null, Notebook[]>();
  notesByNotebookId = new Map<string | null, Note[]>();
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
      notebooksByParentId: observable,
      notesByNotebookId: observable,
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
      const result = await loadFromElectron();
      this.notebooks = result.notebooks;
      this.notes = result.notes;

      this.cacheNotebooks();
      this.cacheNotes();
    } catch (error) {
      console.error('Error loading data from Electron:', error);
      this.notebooks = [{
        id: 'default',
        name: 'Main notebook',
        parentId: null,
        isExpanded: true,
      }];
      this.notes = [];
      this.cacheNotebooks();
      this.cacheNotes();
    } finally {
      this.isLoading = false;
    }
  };



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
      notebookId: targetNotebookId
    };
    this.notes.push(newNote);
    this.selectedNote = newNote;
    this.isEditing = true;

    // Ensure the parent notebook is expanded
    const notebook = this.notebooks.find(n => n.id === targetNotebookId);
    if (notebook && !notebook.isExpanded) {
      notebook.isExpanded = true;
    }

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
      this.cacheNotebooks();
    }
  };


  deleteNote = (noteId: string) => {
    this.notes = this.notes.filter(note => note.id !== noteId);
    if (this.selectedNote?.id === noteId) {
      this.selectedNote = null;
      this.isEditing = false;
    }
    this.cacheNotes();
  };

  setSelectedNote = (note: Note | null) => {
    this.selectedNote = note;
    if (note) {
      this.setFocusedNotebook(note.notebookId);
    }
    this.isEditing = !!note;
  };

  setFocusedNotebook = (notebookId: string | null) => {
    this.focusedNotebookId = notebookId;
  };

  addTagToNote = (noteId: string, tag: Tag) => {
    const note = this.notes.find(n => n.id === noteId);
    if (note) {
      note.tags.push(tag);
      this.cacheNotes();
    }
  };

  removeTagFromNote = (noteId: string, tagId: string) => {
    const note = this.notes.find(n => n.id === noteId);
    if (note) {
      note.tags = note.tags.filter(tag => tag.id !== tagId);
      this.cacheNotes();
    }
  };

  createNotebook = async (name: string, parentId: string | null = null) => {
      const result = await window.electronAPI.createNotebook(parentId || '', name);
      if (result.success && result.path) {
        const newNotebook: Notebook = {
          id: result.path,
          name,
          parentId,
          isExpanded: true
        };
        runInAction(() => {
          this.notebooks = this.notebooks.concat(newNotebook);
          this.cacheNotebooks();
          this.cacheNotes();
        });
        return newNotebook;
      } else {
        throw new Error(result.error || 'Failed to create notebook');
      }
  };

  toggleNotebook = (notebookId: string) => {
    const notebook = this.notebooks.find(n => n.id === notebookId);
    if (notebook) {
      notebook.isExpanded = !notebook.isExpanded;
    }
  };

  getNotebookNotes = (notebookId: string) => {
    return this.notesByNotebookId.get(notebookId) ?? [];
  };

  getVisibleNotes = () => {
    return this.notes;
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


  getSiblingNotes(noteId: string): { prev: Note; next: Note } {
    const notesList = this.notebooks.reduce((agr, notebook) => {
      const notes = this.getNotebookNotes(notebook.id);
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


  async loadNoteContent(note: Note): Promise<void> {
    if (!note.filePath) {
      this.isLoadingNoteContent = false;
      return;
    }

    if (note.content) {
      this.isLoadingNoteContent = false;
      return;
    }

    this.isLoadingNoteContent = true;
    try {
      const content = await loadNoteContent(note.filePath);
      this.updateNote(note.id, { content });
    } catch (error) {
      console.error('Failed to load note content:', error);
    } finally {
      this.isLoadingNoteContent = false;
    }
  }


}