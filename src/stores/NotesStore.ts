import { makeObservable, observable, runInAction } from 'mobx';
import { Note, Notebook, FileMetadata } from '../types';
import { loadFromElectron, loadNoteContent } from '../utils/electron';
import { extractParagraphTags } from '../utils';


export class NotesStore {
  notes: Note[] = [];
  notebooks: Notebook[] = [];
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
      const key = note.notebookId || null;
      if (!agr.has(key)) {
        agr.set(key, []);
      }
      agr.get(key)!.push(note);
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
      this.notebooks = [];
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
    const targetNotebookId = notebookId !== undefined ? notebookId : this.focusedNotebookId;
    
    const now = new Date();
    const title = now.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'long'
    });

    const path = targetNotebookId
      ? this.notebooks.find((notebook) => notebook.id === targetNotebookId)?.path
      : '';

    const result = await window.electronAPI.createNote(path || '', title);
    if (result.success && result.htmlPath) {
      const newNote: Note = {
        id: result.id,
        title: title,
        content: '',
        createdAt: new Date(),
        tags: [],
        notebookId: targetNotebookId || null,
        isLoaded: true,
        path: result.htmlPath,
        paragraphTags: [],
      };
      this.notes.push(newNote);
      this.selectedNote = newNote;
      this.isEditing = true;

      if (targetNotebookId) {
        const notebook = this.notebooks.find(n => n.id === targetNotebookId);
        if (notebook && !notebook.isExpanded) {
          notebook.isExpanded = true;
          this.saveNotebookStates();
        }
      }

      this.cacheNotes();

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

    const paragraphTags = extractParagraphTags(note.content);

    const metadata = {
      id: note.id,
      tags: note.tags,
      createdAt: new Date(note.createdAt).toISOString().split('T')[0],
      theme: note.theme,
      paragraphTags: paragraphTags.length > 0 ? paragraphTags : [],
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

  addTagToNote = (noteId: string, tag: string) => {
    const note = this.notes.find(n => n.id === noteId);
    if (note && !note.tags.includes(tag)) {
      note.tags.push(tag);
      this.updateNoteMetadata(note);
      this.cacheNotes();
    }
  };

  removeTagFromNote = (noteId: string, tagPath: string) => {
    const note = this.notes.find(n => n.id === noteId);
    if (note) {
      note.tags = note.tags.filter(tag => tag !== tagPath);
      this.updateNoteMetadata(note);
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

  getRootNotes = () => {
    return this.notesByNotebookId.get(null) ?? [];
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

  renameTag = async (oldPath: string, newPath: string) => {
    if (!window.electronAPI?.updateFile || !window.electronAPI?.updateMetadata) {
      throw new Error('Electron API not available');
    }

    for (const note of this.notes) {
      const hasTag = note.tags?.findIndex(tag => tag === oldPath) > -1;
      const hasParagraphTag = note.paragraphTags?.findIndex(tag => tag === oldPath) > -1;
      const metadata: FileMetadata = {
        id: note.id,
        tags: note.tags,
        createdAt: new Date(note.createdAt).toISOString().split('T')[0],
        theme: note.theme,
        paragraphTags: note.paragraphTags,
      };
      let needsUpdate = false;
      if (hasTag) {
        console.log(`Renaming tag ${oldPath} in note ${note.filePath}`);
        needsUpdate = true;
        metadata.tags = note.tags.map((tag) => {
          if (tag === oldPath) {
            return newPath;
          }
          return tag;
        });
      }
      if (hasParagraphTag) {
        console.log(`Renaming paragraph tag ${oldPath} in note ${note.filePath}`);
        needsUpdate = true;
        metadata.paragraphTags = note.paragraphTags.map((tag) => {
          if (tag === oldPath) {
            return newPath;
          }

          return tag;
        });
        const parser = new DOMParser();
        const doc = parser.parseFromString(note.content, 'text/html');
        const paragraphs = doc.querySelectorAll('p[data-tags]');

        paragraphs.forEach(paragraph => {
          const tagsAttr = paragraph.getAttribute('data-tags');
          if (tagsAttr) {
            const tags = tagsAttr.split(',').map(tag => tag.trim());
            const updatedParagraphTags = tags.map(tag => tag === oldPath ? newPath : tag);
            paragraph.setAttribute('data-tags', updatedParagraphTags.join(','));
          }
        });

        const updatedContent = doc.body.innerHTML.toString();
        await window.electronAPI.updateFile(note.path, updatedContent);
      }
      if (needsUpdate) {
        await window.electronAPI.updateMetadata(note.path, JSON.parse(JSON.stringify(metadata)));
      }
    }

    this.loadFromStorage();
  };

  deleteTag = async (tagPath: string) => {
    if (!window.electronAPI?.updateFile || !window.electronAPI?.updateMetadata) {
      throw new Error('Electron API not available');
    }

    for (const note of this.notes) {
      const hasTag = note.tags.findIndex(tag => tag === tagPath) > -1;
      const hasParagraphTag = note.paragraphTags.findIndex(tag => tag === tagPath) > -1;
      const metadata = {
        id: note.id,
        tags: note.tags,
        createdAt: new Date(note.createdAt).toISOString().split('T')[0],
        theme: note.theme,
        paragraphTags: note.paragraphTags,
      };
      let needsUpdate = false;
      if (hasTag) {
        console.log(`Deleting tag ${tagPath} in note ${note.filePath}`);
        needsUpdate = true;
        metadata.tags = note.tags.filter(tag => tag !== tagPath);
      }
      if (hasParagraphTag) {
        console.log(`Deleting paragraph tag ${tagPath} in note ${note.filePath}`);
        needsUpdate = true;
        metadata.paragraphTags = note.paragraphTags.filter(tag => tag !== tagPath);
        const parser = new DOMParser();
        const doc = parser.parseFromString(note.content, 'text/html');
        const paragraphs = doc.querySelectorAll('p[data-tags]');

        paragraphs.forEach(paragraph => {
          const tagsAttr = paragraph.getAttribute('data-tags');
          if (tagsAttr) {
            const tags = tagsAttr.split(',').map(tag => tag.trim());
            const updatedParagraphTags = tags.reduce((agr, tag) => {
              if (tag !== tagPath) {
                agr.push(tag);
              }

              return agr;
            }, []);
            paragraph.setAttribute('data-tags', updatedParagraphTags.join(','));
          }
        });

        const updatedContent = doc.body.innerHTML;
        await window.electronAPI.updateFile(note.path, updatedContent);
      }
      if (needsUpdate) {
        await window.electronAPI.updateMetadata(note.path, JSON.parse(JSON.stringify(metadata)));
      }
    }

    this.loadFromStorage();
  };

  getStatistics = () => {
    const emptyNotes = this.notes.filter(note => this.isNoteEmpty(note));
    const totalWords = this.notes.reduce((sum, note) => {
      return sum + this.countWords(note.content);
    }, 0);

    return {
      notebookCount: this.notebooks.length,
      noteCount: this.notes.length,
      totalWords,
      emptyNoteCount: emptyNotes.length,
    };
  };

  isNoteEmpty = (note: Note): boolean => {
    if (!note.content) return true;
    const parser = new DOMParser();
    const doc = parser.parseFromString(note.content, 'text/html');
    const text = doc.body.textContent || '';
    return text.trim().length === 0;
  };

  private countWords = (content: string): number => {
    if (!content) return 0;
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');
    const text = doc.body.textContent || '';
    const words = text.trim().split(/\s+/).filter(word => word.length > 0);
    return words.length;
  };

  getEmptyNotes = (): Note[] => {
    return this.notes.filter(note => this.isNoteEmpty(note));
  };

}