import { makeAutoObservable } from 'mobx';
import { Note } from '../types';

const STORAGE_KEY = 'solo-seen-timestamps';

/**
 * Хранит в localStorage метки времени последнего просмотра для каждой заметки.
 * Запись считается «непросмотренной» (UNSEEN), если `note.updatedAt` (или `note.createdAt`)
 * больше сохранённой метки для этого note.id (или метки нет вовсе).
 *
 * Просмотром считается вызов `markAsSeen(note)`, который проставляется при
 * открытии заметки (см. NotesStore.setSelectedNote).
 */
export class SeenStore {
  /** Map<noteId, ISO‑строка последнего просмотра> */
  private seenMap: Map<string, string> = new Map();

  constructor() {
    makeAutoObservable(this);
    this.loadFromStorage();
  }

  // ── Публичный API ──

  /** Отметить заметку как просмотренную (текущее время в UTC). */
  markAsSeen(note: Note): void {
    const now = new Date().toISOString();
    this.seenMap.set(note.id, now);
    this.saveToStorage();
  }

  /**
   * Проверить, есть ли у заметки непросмотренные изменения.
   *
   * Сравнение:
   * - `updatedAt` (из .json метаданных / git commit date) — если заметка была изменена
   * - если `updatedAt` нет — используем `createdAt`
   * - если заметка ни разу не открывалась (нет в seenMap) — считаем непросмотренной
   */
  isUnseen(note: Note): boolean {
    const lastSeen = this.seenMap.get(note.id);
    const changeDate = note.updatedAt
      ?? (note.createdAt instanceof Date ? note.createdAt.toISOString() : String(note.createdAt));

    if (!lastSeen) {
      // Никогда не открывали — считаем новой
      return !!changeDate;
    }

    if (!changeDate) return false;

    return changeDate > lastSeen;
  }

  /** Количество непросмотренных заметок среди переданного списка. */
  countUnseen(notes: Note[]): number {
    return notes.filter(n => this.isUnseen(n)).length;
  }

  /** Полностью сбросить историю просмотров. */
  resetAll(): void {
    this.seenMap.clear();
    this.saveToStorage();
  }

  // ── Persistence ──

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (typeof parsed === 'object' && parsed !== null) {
          this.seenMap = new Map(Object.entries(parsed));
          return;
        }
      }
    } catch {
      // ignore corrupt data
    }
    this.seenMap = new Map();
  }

  private saveToStorage(): void {
    try {
      const obj: Record<string, string> = {};
      this.seenMap.forEach((value, key) => { obj[key] = value; });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch {
      // localStorage may be full or unavailable
    }
  }
}
