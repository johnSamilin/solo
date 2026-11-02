import { makeAutoObservable } from 'mobx';
import { NotesStore } from './NotesStore';
import { SettingsStore } from './SettingsStore';
import { getNativeAPI } from '../utils/nativeBridge';
import { extractArticle, extractArticleStyles } from '../utils/readLater';

const MAX_TITLE_LENGTH = 150;

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function sanitizeTitle(title: string): string {
  return title
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TITLE_LENGTH);
}

export class ReadLaterStore {
  isOpen = false;
  url = '';
  saveStyles = false;
  isLoading = false;
  error: string | null = null;

  private notesStore: NotesStore;
  private settingsStore: SettingsStore;

  constructor(notesStore: NotesStore, settingsStore: SettingsStore) {
    this.notesStore = notesStore;
    this.settingsStore = settingsStore;
    makeAutoObservable(this);
  }

  open = () => {
    this.error = null;
    this.saveStyles = false;
    this.isOpen = true;
    this.prefillFromClipboard();
  };

  close = () => {
    if (this.isLoading) return;
    this.isOpen = false;
    this.error = null;
  };

  setUrl = (url: string) => {
    this.url = url;
    this.error = null;
  };

  setSaveStyles = (value: boolean) => {
    this.saveStyles = value;
  };

  private prefillFromClipboard = async () => {
    try {
      const clipboard = navigator.clipboard;
      if (!clipboard || typeof clipboard.readText !== 'function') return;
      const text = (await clipboard.readText()).trim();
      if (text && isValidHttpUrl(text)) {
        this.url = text;
      }
    } catch {
      // Clipboard access denied — leave the field empty.
    }
  };

  submit = async () => {
    const url = this.url.trim();
    if (!isValidHttpUrl(url)) {
      this.error = 'Enter a valid http(s) URL';
      return;
    }

    const api = getNativeAPI();
    if (!api?.fetchUrl) {
      this.error = 'Read later is not available on this platform';
      return;
    }

    this.isLoading = true;
    this.error = null;
    try {
      const fetchResult = await api.fetchUrl(url);
      if (!fetchResult.success || !fetchResult.content) {
        throw new Error(fetchResult.error || 'Failed to fetch the page');
      }

      const article = extractArticle(fetchResult.content, fetchResult.finalUrl || url);
      if (!article.html) {
        throw new Error('No readable content found on the page');
      }

      const created = await this.notesStore.createNote();
      if (!created?.path) {
        throw new Error('Failed to create note');
      }

      let htmlPath = created.path;
      await api.updateFile(htmlPath, article.html);

      const safeTitle = sanitizeTitle(article.title);
      if (safeTitle) {
        try {
          const renameResult = await api.renameNote(htmlPath, safeTitle);
          if (renameResult.success && renameResult.newPath) {
            htmlPath = renameResult.newPath;
          }
        } catch {
          // Keep the default date-based name if renaming fails.
        }
      }

      const cssPath = htmlPath.replace(/\.html$/, '.css');
      if (this.saveStyles) {
        const css = extractArticleStyles(fetchResult.content);
        if (css) {
          await api.updateFile(cssPath, css);
        }
      }

      await api.updateMetadata(htmlPath, {
        id: created.id,
        tags: ['Unread'],
        createdAt: new Date(created.createdAt).toISOString().split('T')[0],
        theme: created.theme,
        paragraphTags: [],
        sourceUrl: fetchResult.finalUrl || url,
      });

      // Reload to reflect the new note (title, cssPath, metadata) from disk.
      await this.notesStore.loadFromStorage();
      const savedNote = this.notesStore.notes.find((note) => note.path === htmlPath);
      if (savedNote) {
        this.notesStore.setSelectedNote(savedNote);
      }

      this.settingsStore.setToast('Saved for later', 'success');
      this.isOpen = false;
      this.url = '';
    } catch (error) {
      const message = (error as Error).message || 'Failed to save the article';
      this.error = message;
      this.settingsStore.setToast(message, 'error');
    } finally {
      this.isLoading = false;
    }
  };
}
