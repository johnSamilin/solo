import { makeAutoObservable } from 'mobx';
import { Note, Tag, Notebook } from '../types';
import { generateUniqueId } from '../utils';

const STORAGE_KEY = 'solo-notes-data';

interface StoredData {
  notes: Note[];
  notebooks: Notebook[];
  selectedNoteId: string | null;
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
  isEditing = false;

  constructor() {
    makeAutoObservable(this);
    this.loadFromStorage();
  }

  private loadFromStorage = () => {
    const storedData = localStorage.getItem(STORAGE_KEY);
    if (storedData) {
      const data: StoredData = JSON.parse(storedData);
      this.notes = data.notes.map(note => ({
        ...note,
        createdAt: new Date(note.createdAt)
      }));
      this.notebooks = data.notebooks;
      if (data.selectedNoteId) {
        this.selectedNote = this.notes.find(note => note.id === data.selectedNoteId) || null;
      }
    }
  };

  private saveToStorage = () => {
    const data: StoredData = {
      notes: this.notes,
      notebooks: this.notebooks,
      selectedNoteId: this.selectedNote?.id || null
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  };

  createNote = (notebookId: string = 'default') => {
    const newNote: Note = {
      id: generateUniqueId(),
      title: 'Untitled Note',
      content: '',
      createdAt: new Date(),
      tags: [],
      notebookId
    };
    this.notes.push(newNote);
    this.selectedNote = newNote;
    this.isEditing = true;

    // Ensure the parent notebook is expanded
    const notebook = this.notebooks.find(n => n.id === notebookId);
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
    this.isEditing = !!note;
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