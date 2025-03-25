import { makeAutoObservable } from 'mobx';
import { Note, Tag, Notebook, ImportMode } from '../types';
import { generateUniqueId } from '../utils';
import { isPlugin } from '../config';

const STORAGE_KEY = 'solo-notes-data';

interface StoredData {
  notes: Note[];
  notebooks: Notebook[];
  selectedNoteId: string | null;
  focusedNotebookId: string | null;
}

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

  constructor() {
    makeAutoObservable(this);
    this.loadFromStorage();
  }

  private loadFromStorage = async () => {
    try {
      let storedData: StoredData | null = null;

      if (isPlugin) {
        storedData = JSON.parse(await window.bridge.loadFromStorage(STORAGE_KEY) ?? '{ "notes": [], "notebooks": [] }');
      } else {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          storedData = JSON.parse(stored);
        }
      }

      if (storedData) {
        this.notes = storedData.notes.map(note => ({
          ...note,
          createdAt: new Date(note.createdAt)
        }));
        this.notebooks = storedData.notebooks;
        if (storedData.selectedNoteId) {
          this.selectedNote = this.notes.find(note => note.id === storedData.selectedNoteId) || null;
        }
        this.focusedNotebookId = storedData.focusedNotebookId;
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  private saveToStorage = async () => {
    const data: StoredData = {
      notes: this.notes,
      notebooks: this.notebooks,
      selectedNoteId: this.selectedNote?.id || null,
      focusedNotebookId: this.focusedNotebookId
    };

    try {
      if (isPlugin) {
        await window.bridge.saveToStorage(STORAGE_KEY, JSON.stringify(data));
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      }
    } catch (error) {
      console.error('Error saving data:', error);
    }
  };

  freshStart = () => {
    this.notes = [];
    this.notebooks = [{
      id: 'default',
      name: 'Main notebook',
      parentId: null,
      isExpanded: true
    }];
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
      const existingNotebooks = new Map(this.notebooks.map(n => [n.name, n]));
      
      // Import notebooks, reusing existing IDs where possible
      data.notebooks.forEach(notebook => {
        const existing = existingNotebooks.get(notebook.name);
        if (!existing) {
          this.notebooks.push({
            ...notebook,
            id: generateUniqueId()
          });
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

    this.saveToStorage();
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
    }
  };

  deleteNote = (noteId: string) => {
    this.notes = this.notes.filter(note => note.id !== noteId);
    if (this.selectedNote?.id === noteId) {
      this.selectedNote = null;
      this.isEditing = false;
    }
    this.saveToStorage();
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
    }
  };

  removeTagFromNote = (noteId: string, tagId: string) => {
    const note = this.notes.find(n => n.id === noteId);
    if (note) {
      note.tags = note.tags.filter(tag => tag.id !== tagId);
      this.saveToStorage();
    }
  };

  createNotebook = (name: string, parentId: string | null = null) => {
    const newNotebook: Notebook = {
      id: generateUniqueId(),
      name,
      parentId,
      isExpanded: true
    };
    this.notebooks.push(newNotebook);
    this.saveToStorage();
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
    return this.notes.filter(note => note.notebookId === notebookId);
  };

  getChildNotebooks = (parentId: string | null) => {
    return this.notebooks.filter(notebook => notebook.parentId === parentId);
  };
}