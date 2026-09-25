import { Note } from '../../types';

export type SearchTagFilter = {
  path: string;
  operator: 'AND' | 'OR' | 'NOT';
};

export type NoteDisplayContent = {
  content: string;
  isPartial: boolean;
};

const fuzzyMatch = (text: string, query: string): boolean => {
  if (!query) return true;

  const normalizedText = text.toLowerCase();
  const normalizedQuery = query.toLowerCase();
  let queryIndex = 0;

  for (let index = 0; index < normalizedText.length && queryIndex < normalizedQuery.length; index++) {
    if (normalizedText[index] === normalizedQuery[queryIndex]) queryIndex++;
  }

  return queryIndex === normalizedQuery.length;
};

const getTextMatchingParagraphs = (content: string, query: string): string[] => {
  if (!query.trim()) return [];

  const root = document.createElement('div');
  root.innerHTML = content;
  return Array.from(root.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li'))
    .filter(element => fuzzyMatch(element.textContent || '', query))
    .map(element => element.outerHTML);
};

const getMatchingParagraphs = (content: string, tagFilters: SearchTagFilter[]): string[] => {
  if (tagFilters.length === 0) return [];

  const root = document.createElement('div');
  root.innerHTML = content;
  return Array.from(root.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li'))
    .filter(element => {
      const tags = (element.getAttribute('data-tags') || '').split(',').map(tag => tag.trim()).filter(Boolean);
      return tagFilters.some(filter => tags.some(tag => tag.includes(filter.path)));
    })
    .map(element => element.outerHTML);
};

const noteFullyMatches = (note: Note, query: string): boolean => {
  if (!query.trim() || fuzzyMatch(note.title, query)) return true;

  const root = document.createElement('div');
  root.innerHTML = note.content;
  return fuzzyMatch(root.textContent || '', query);
};

export const getNoteDisplayContent = (
  note: Note,
  query: string,
  tagFilters: SearchTagFilter[],
): NoteDisplayContent => {
  if (!query.trim() && tagFilters.length === 0) return { content: note.content, isPartial: false };
  if (query.trim() && noteFullyMatches(note, query) && tagFilters.length === 0) return { content: note.content, isPartial: false };

  const matchedParagraphs = [
    ...new Set([
      ...getTextMatchingParagraphs(note.content, query),
      ...getMatchingParagraphs(note.content, tagFilters),
    ]),
  ];

  return matchedParagraphs.length > 0
    ? { content: matchedParagraphs.join('<br/><br/>'), isPartial: true }
    : { content: note.content, isPartial: false };
};
