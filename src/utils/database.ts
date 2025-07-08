interface DBNote {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  notebookId: string;
  isCensored?: boolean;
  theme?: string;
  tags: string; // JSON string of tags array
}

interface DBNotebook {
  id: string;
  name: string;
  parentId: string | null;
  isExpanded: boolean;
  isCensored?: boolean;
}

interface DBSettings {
  key: string;
  value: string; // JSON string
}

class DatabaseManager {
  private db: IDBDatabase | null = null;
  private readonly dbName = 'SoloApp';
  private readonly version = 1;

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create notes table
        if (!db.objectStoreNames.contains('notes')) {
          const notesStore = db.createObjectStore('notes', { keyPath: 'id' });
          notesStore.createIndex('notebookId', 'notebookId', { unique: false });
          notesStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // Create notebooks table
        if (!db.objectStoreNames.contains('notebooks')) {
          const notebooksStore = db.createObjectStore('notebooks', { keyPath: 'id' });
          notebooksStore.createIndex('parentId', 'parentId', { unique: false });
        }

        // Create settings table
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };
    });
  }

  private getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): IDBObjectStore {
    if (!this.db) throw new Error('Database not initialized');
    const transaction = this.db.transaction([storeName], mode);
    return transaction.objectStore(storeName);
  }

  // Notes operations
  async getAllNotes(): Promise<DBNote[]> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('notes');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getNote(id: string): Promise<DBNote | null> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('notes');
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async saveNote(note: DBNote): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('notes', 'readwrite');
      const request = store.put(note);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteNote(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('notes', 'readwrite');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getNotesByNotebook(notebookId: string): Promise<DBNote[]> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('notes');
      const index = store.index('notebookId');
      const request = index.getAll(notebookId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Notebooks operations
  async getAllNotebooks(): Promise<DBNotebook[]> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('notebooks');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveNotebook(notebook: DBNotebook): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('notebooks', 'readwrite');
      const request = store.put(notebook);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteNotebook(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('notebooks', 'readwrite');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Settings operations
  async getSetting(key: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('settings');
      const request = store.get(key);
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? JSON.parse(result.value) : null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async saveSetting(key: string, value: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('settings', 'readwrite');
      const request = store.put({ key, value: JSON.stringify(value) });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Migration and sync operations
  async clearAllData(): Promise<void> {
    const stores = ['notes', 'notebooks', 'settings'];
    const promises = stores.map(storeName => 
      new Promise<void>((resolve, reject) => {
        const store = this.getStore(storeName, 'readwrite');
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      })
    );
    await Promise.all(promises);
  }

  async importData(data: { notes: any[], notebooks: any[] }): Promise<void> {
    // Convert and save notebooks
    for (const notebook of data.notebooks) {
      const dbNotebook: DBNotebook = {
        id: notebook.id,
        name: notebook.name,
        parentId: notebook.parentId,
        isExpanded: notebook.isExpanded,
        isCensored: notebook.isCensored
      };
      await this.saveNotebook(dbNotebook);
    }

    // Convert and save notes
    for (const note of data.notes) {
      const dbNote: DBNote = {
        id: note.id,
        title: note.title,
        content: note.content,
        createdAt: typeof note.createdAt === 'string' ? note.createdAt : note.createdAt.toISOString(),
        notebookId: note.notebookId,
        isCensored: note.isCensored,
        theme: note.theme,
        tags: JSON.stringify(note.tags || [])
      };
      await this.saveNote(dbNote);
    }
  }

  async exportData(): Promise<{ notes: any[], notebooks: any[] }> {
    const [dbNotes, dbNotebooks] = await Promise.all([
      this.getAllNotes(),
      this.getAllNotebooks()
    ]);

    const notes = dbNotes.map(note => ({
      id: note.id,
      title: note.title,
      content: note.content,
      createdAt: new Date(note.createdAt),
      notebookId: note.notebookId,
      isCensored: note.isCensored,
      theme: note.theme,
      tags: JSON.parse(note.tags || '[]')
    }));

    const notebooks = dbNotebooks.map(notebook => ({
      id: notebook.id,
      name: notebook.name,
      parentId: notebook.parentId,
      isExpanded: notebook.isExpanded,
      isCensored: notebook.isCensored
    }));

    return { notes, notebooks };
  }
}

export const db = new DatabaseManager();