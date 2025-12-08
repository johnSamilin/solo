import { makeObservable, observable, runInAction } from 'mobx';
import { Note, Tag, Notebook } from '../types';
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
  private saveDebounceTimer: NodeJS.Timeout | null = null;
  private pendingSave: { noteId: string; content: string } | null = null;

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

      this.loadNotebookStates();

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

  private loadNotebookStates = () => {
    try {
      const savedStates = localStorage.getItem('notebook-states');
      if (savedStates) {
        const states: Record<string, boolean> = JSON.parse(savedStates);
        this.notebooks.forEach(notebook => {
          if (states.hasOwnProperty(notebook.id)) {
            notebook.isExpanded = states[notebook.id];
          }
        });
      }
    } catch (error) {
      console.error('Error loading notebook states from localStorage:', error);
    }
  };

  private saveNotebookStates = () => {
    try {
      const states: Record<string, boolean> = {};
      this.notebooks.forEach(notebook => {
        states[notebook.id] = notebook.isExpanded;
      });
      localStorage.setItem('notebook-states', JSON.stringify(states));
    } catch (error) {
      console.error('Error saving notebook states to localStorage:', error);
    }
  };



  createNote = async (notebookId?: string) => {
    let targetNotebookId = notebookId || this.focusedNotebookId || 'default';

    // Generate localized title with day and month
    const now = new Date();
    const title = now.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'long'
    });

    if (this.notebooks.length === 0) {
      const mainNotebookResult = await window.electronAPI.createNotebook('', 'Main notebook');
      if (mainNotebookResult.success && mainNotebookResult.path) {
        const mainNotebook: Notebook = {
          id: mainNotebookResult.path,
          name: 'Main notebook',
          parentId: null,
          isExpanded: true
        };
        this.notebooks.push(mainNotebook);
        targetNotebookId = mainNotebook.id;
      }
    }

    const path = this.notebooks.find((notebook) => notebook.id === notebookId)?.path;
    console.log("create note", { path, notebookId })
    if (!path) {
      throw "no such notebook";
    }
    const result = await window.electronAPI.createNote(path, title);
    if (result.success && result.htmlPath) {
      const newNote: Note = {
        id: result.id,
        title: title,
        content: '',
        createdAt: new Date(),
        tags: [],
        notebookId: targetNotebookId,
        isLoaded: true,
        path: result.htmlPath,
      };
      this.notes.push(newNote);
      this.selectedNote = newNote;
      this.isEditing = true;

      // Ensure the parent notebook is expanded
      const notebook = this.notebooks.find(n => n.id === targetNotebookId);
      if (notebook && !notebook.isExpanded) {
        notebook.isExpanded = true;
        this.saveNotebookStates();
      }

      return newNote;
    } else {
      throw new Error(result.error || 'Failed to create note');
    }
  };

  updateNote = async (noteId: string, updates: Partial<Note>) => {
    const noteIndex = this.notes.findIndex(note => note.id === noteId);
    if (noteIndex === -1) return;

    const note = this.notes[noteIndex];

    if (window.electronAPI?.renameNote && note?.path && updates.title && updates.title !== note.title) {
      const result = await window.electronAPI.renameNote(note.path, updates.title);
      if (!result.success) {
        console.error('Failed to rename note file:', result.error);
        return;
      }

      if (result.newPath) {
        this.notes[noteIndex] = {
          ...note,
          ...updates,
          id: result.newPath,
          path: result.newPath,
          filePath: result.newPath
        };

        if (this.selectedNote?.id === noteId) {
          this.selectedNote = this.notes[noteIndex];
        }
      }
    } else {
      this.notes[noteIndex] = { ...note, ...updates };
      if (this.selectedNote?.id === noteId) {
        this.selectedNote = this.notes[noteIndex];
      }
    }

    this.cacheNotes();

    if (updates.content !== undefined) {
      this.debouncedSave(this.notes[noteIndex].id, updates.content);
    }

    this.updateNoteMetadata(this.notes[noteIndex]);

    if (updates.theme !== undefined) {
    }
  };

  private updateNoteMetadata = async (note: Note) => {
    if (!window.electronAPI?.updateMetadata || !note.path) return;

    const metadata = {
      id: note.id,
      tags: note.tags.map(tag => tag.path),
      createdAt: new Date(note.createdAt).toISOString().split('T')[0],
      theme: note.theme,
    };

    try {
      const result = await window.electronAPI.updateMetadata(note.path, metadata);
      if (!result.success) {
        console.error('Failed to update note metadata:', result.error);
      }
    } catch (error) {
      console.error('Error updating note metadata:', error);
    }
  };

  private debouncedSave = (noteId: string, content: string) => {
    if (!window.electronAPI) return;

    this.pendingSave = { noteId, content };

    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
    }

    this.saveDebounceTimer = setTimeout(() => {
      if (this.pendingSave) {
        this.saveNoteContent(this.pendingSave.noteId, this.pendingSave.content);
        this.pendingSave = null;
      }
    }, 500);
  };

  private saveNoteContent = async (noteId: string, content: string) => {
    try {
      const path = this.notes.find(note => note.id === noteId)?.path;
      if (!path) {
        console.log({ noteId, path, notes: [...this.notes] })
        throw 'No such path';
      }
      const result = await window.electronAPI.updateFile(path, content);
      if (!result.success) {
        console.error('Failed to save note:', result.error);
      }
    } catch (error) {
      console.error('Error saving note:', error);
    }
  };

  saveCurrentNote = async () => {
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
      this.saveDebounceTimer = null;
    }

    if (this.pendingSave) {
      await this.saveNoteContent(this.pendingSave.noteId, this.pendingSave.content);
      this.pendingSave = null;
    }
  };

  updateNotebook = async (notebookId: string, updates: Partial<Notebook>) => {
    const notebookIndex = this.notebooks.findIndex(notebook => notebook.id === notebookId);
    if (notebookIndex === -1) return;

    const notebook = this.notebooks[notebookIndex];

    if (window.electronAPI?.renameNotebook && notebook?.path && updates.name && updates.name !== notebook.name) {
      const result = await window.electronAPI.renameNotebook(notebook.path, updates.name);
      if (!result.success) {
        console.error('Failed to rename notebook folder:', result.error);
        return;
      }

      if (result.newPath) {
        const oldPath = notebook.path;
        const newPath = result.newPath;

        this.notebooks[notebookIndex] = {
          ...notebook,
          ...updates,
          id: newPath,
          path: newPath
        };

        this.notebooks.forEach((nb, idx) => {
          if (nb.parentId === oldPath) {
            this.notebooks[idx] = { ...nb, parentId: newPath };
          }
        });

        this.notes.forEach((note, idx) => {
          if (note.notebookId === oldPath) {
            const notePathParts = note.path?.split('/') || [];
            if (notePathParts.length > 0) {
              notePathParts[0] = updates.name || notebook.name;
              const newNotePath = notePathParts.join('/');
              this.notes[idx] = { ...note, notebookId: newPath, path: newNotePath, filePath: newNotePath };
            }
          }
        });

        if (this.focusedNotebookId === oldPath) {
          this.focusedNotebookId = newPath;
        }
      }
    } else {
      this.notebooks[notebookIndex] = { ...notebook, ...updates };
    }

    this.cacheNotebooks();
    this.cacheNotes();
    this.saveNotebookStates();
  };

  deleteNotebook = async (notebookId: string) => {
    const notebook = this.notebooks.find(n => n.id === notebookId);

    if (window.electronAPI && notebook?.path) {
      const result = await window.electronAPI.deleteNotebook(notebook.path);
      if (!result.success) {
        console.error('Failed to delete notebook folder:', result.error);
        return;
      }
    }

    const notesToDelete = this.notes.filter(note => note.notebookId === notebookId);
    for (const note of notesToDelete) {
      await this.deleteNote(note.id);
    }

    const childNotebooks = this.notebooks.filter(nb => nb.parentId === notebookId);
    for (const child of childNotebooks) {
      await this.deleteNotebook(child.id);
    }

    this.notebooks = this.notebooks.filter(notebook => notebook.id !== notebookId);
    this.cacheNotebooks();
    this.saveNotebookStates();
  };


  deleteNote = async (noteId: string) => {
    if (this.selectedNote?.id === noteId) {
      await this.saveCurrentNote();
    }

    const note = this.notes.find(n => n.id === noteId);

    if (window.electronAPI && note?.path) {
      const result = await window.electronAPI.deleteNote(note.path);
      if (!result.success) {
        console.error('Failed to delete note file:', result.error);
      }
    }

    this.notes = this.notes.filter(note => note.id !== noteId);
    if (this.selectedNote?.id === noteId) {
      this.selectedNote = null;
      this.isEditing = false;
    }
    this.cacheNotes();
  };

  setSelectedNote = async (note: Note | null) => {
    await this.saveCurrentNote();
    if (note) {
      this.selectedNote = {
        ...note,
        isLoaded: false,
      };
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
          this.saveNotebookStates();
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
      this.saveNotebookStates();
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

    this.isLoadingNoteContent = true;
    try {
      const content = await loadNoteContent(note.filePath);
      this.updateNote(note.id, { content });
      if (this.selectedNote) {
        this.selectedNote.isLoaded = true;
      }
    } catch (error) {
      console.error('Failed to load note content:', error);
    } finally {
      this.isLoadingNoteContent = false;
    }
  }


}