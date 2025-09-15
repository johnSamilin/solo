import { FC, useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { Note } from '../../types';
import { useStore } from '../../stores/StoreProvider';
import { themes } from '../../constants';

interface TagFilter {
  path: string;
  operator: 'AND' | 'OR' | 'NOT';
}

interface SearchResultsProps {
  filteredNotes: Note[];
  searchQuery: string;
  tagFilters: TagFilter[];
  onNoteSelect: (note: Note) => void;
}

export const SearchResults: FC<SearchResultsProps> = observer(({
  filteredNotes,
  searchQuery,
  tagFilters,
  onNoteSelect
}) => {
  const { notesStore, settingsStore } = useStore();
  const [loadingNotes, setLoadingNotes] = useState<Set<string>>(new Set());

  // Fuzzy search function
  const fuzzyMatch = (text: string, query: string): boolean => {
    if (!query) return true;
    
    const normalizedText = text.toLowerCase();
    const normalizedQuery = query.toLowerCase();
    
    let queryIndex = 0;
    for (let i = 0; i < normalizedText.length && queryIndex < normalizedQuery.length; i++) {
      if (normalizedText[i] === normalizedQuery[queryIndex]) {
        queryIndex++;
      }
    }
    return queryIndex === normalizedQuery.length;
  };

  // Extract matching paragraphs from note content based on text search
  const getTextMatchingParagraphs = (content: string, query: string): string[] => {
    if (!query.trim()) return [];
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;
    
    const elements = tempDiv.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li');
    const matchingParagraphs: string[] = [];
    
    elements.forEach(element => {
      const text = element.textContent || '';
      
      if (fuzzyMatch(text, query)) {
        matchingParagraphs.push(element.outerHTML);
      }
    });
    
    return matchingParagraphs;
  };

  // Extract paragraphs that have matching tags
  const getMatchingParagraphs = (content: string, tagFilters: TagFilter[]): string[] => {
    if (tagFilters.length === 0) return [];
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;
    
    const elements = tempDiv.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li');
    const matchingParagraphs: string[] = [];
    
    elements.forEach(element => {
      const dataTags = element.getAttribute('data-tags') || '';
      if (!dataTags) return;
      
      const paragraphTags = dataTags.split(',').map(tag => tag.trim()).filter(tag => tag);
      
      const matches = tagFilters.some(filter => {
        return paragraphTags.some(tag => tag.includes(filter.path));
      });
      
      if (matches) {
        matchingParagraphs.push(element.outerHTML);
      }
    });
    
    return matchingParagraphs;
  };

  // Check if note title or full content matches query
  const noteFullyMatches = (note: Note, query: string): boolean => {
    if (!query.trim()) return true;
    
    const titleMatches = fuzzyMatch(note.title, query);
    if (titleMatches) return true;
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = note.content;
    const fullText = tempDiv.textContent || '';
    
    return fuzzyMatch(fullText, query);
  };

  // Filter content based on censorship mode
  const getFilteredContent = (note: Note): string => {
    if (!settingsStore.isCensorshipEnabled()) {
      return note.content;
    }
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = note.content;
    const censoredElements = tempDiv.querySelectorAll('span[data-censored]');
    censoredElements.forEach(el => el.remove());
    return tempDiv.innerHTML;
  };

  // Get content to display for a note
  const getNoteDisplayContent = (note: Note, query: string): { content: string; isPartial: boolean } => {
    const filteredContent = getFilteredContent(note);
    
    const matchingTagParagraphs = getMatchingParagraphs(filteredContent, tagFilters);
    
    if (!query.trim() && tagFilters.length === 0) {
      return { content: filteredContent, isPartial: false };
    }
    
    if (query.trim() && noteFullyMatches(note, query) && tagFilters.length === 0) {
      return { content: filteredContent, isPartial: false };
    }
    
    const textMatchingParagraphs = query.trim() ? getTextMatchingParagraphs(filteredContent, query) : [];
    
    const allMatchingParagraphs = [...new Set([...textMatchingParagraphs, ...matchingTagParagraphs])];
    
    if (allMatchingParagraphs.length > 0) {
      const partialContent = allMatchingParagraphs.join('<br/><br/>');
      return { content: partialContent, isPartial: true };
    }
    
    return { content: filteredContent, isPartial: false };
  };

  const handleNoteClick = async (note: Note) => {
    if (!note.content) {
      setLoadingNotes(prev => new Set(prev).add(note.id));
      await notesStore.loadNoteContent(note);
      setLoadingNotes(prev => {
        const newSet = new Set(prev);
        newSet.delete(note.id);
        return newSet;
      });
    }
    onNoteSelect(note);
  };

  // Load content for all filtered notes
  useEffect(() => {
    const loadAllContent = async () => {
      const notesToLoad = filteredNotes.filter(note => !note.content);
      if (notesToLoad.length === 0) return;

      setLoadingNotes(prev => {
        const newSet = new Set(prev);
        notesToLoad.forEach(note => newSet.add(note.id));
        return newSet;
      });

      await Promise.all(
        notesToLoad.map(note => notesStore.loadNoteContent(note))
      );

      setLoadingNotes(prev => {
        const newSet = new Set(prev);
        notesToLoad.forEach(note => newSet.delete(note.id));
        return newSet;
      });
    };

    loadAllContent();
  }, [filteredNotes, notesStore]);

  const renderNoteContent = (note: Note) => {
    const isLoading = loadingNotes.has(note.id);
    const { content: displayContent, isPartial } = getNoteDisplayContent(note, searchQuery);
    
    const noteTheme = note.theme ? themes[note.theme]?.settings : settingsStore.settings;
    const noteStyles = noteTheme ? {
      fontFamily: noteTheme.editorFontFamily,
      fontSize: noteTheme.editorFontSize,
      lineHeight: noteTheme.editorLineHeight,
    } : {};

    return (
      <div key={note.id} className="search-note-item">        
        <div 
          className="search-note-header" 
          onClick={() => handleNoteClick(note)}
          data-note-id={note.id}
        >
          <h2 style={{ 
            fontFamily: noteTheme?.titleFontFamily || settingsStore.settings.titleFontFamily,
            fontSize: noteTheme?.titleFontSize || settingsStore.settings.titleFontSize
          }}>
            {note.title}
          </h2>
        </div>
        
        <div 
          className="search-note-content"
          data-partial={isPartial}
          style={noteStyles}
        >
          {isLoading ? (
            <div className="note-loading">
              <div className="loading-spinner-small"></div>
              <span>Loading content...</span>
            </div>
          ) : displayContent ? (
            <div 
              dangerouslySetInnerHTML={{ 
                __html: displayContent
              }}
              onClick={(e) => {
                e.stopPropagation();
              }}
            />
          ) : (
            <div className="no-content">
              <em>No content</em>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="search-results">
      <div className="results-header">
        <h3>
          {filteredNotes.length} note{filteredNotes.length !== 1 ? 's' : ''} found
        </h3>
        {(searchQuery || tagFilters.length > 0) && (
          <div className="search-summary">
            {searchQuery && (
              <span className="search-term">
                Text: "{searchQuery}"
              </span>
            )}
            {tagFilters.length > 0 && (
              <span className="tag-summary">
                Tags: {tagFilters.map(f => `${f.operator} ${f.path}`).join(', ')}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="combined-notes-container">
        {filteredNotes.length > 0 ? (
          <div className="search-notes-list">
            {filteredNotes.map((note, index) => (
              <div key={note.id}>
                {renderNoteContent(note)}
                {index < filteredNotes.length - 1 && (
                  <hr className="note-separator" />
                )}
              </div>
            ))}
          </div>
        ) : null}

        {filteredNotes.length === 0 && (searchQuery || tagFilters.length > 0) && (
          <div className="no-results">
            <Search className="h-12 w-12 no-results-icon" />
            <h3>No notes found</h3>
            <p>Try adjusting your search terms or tag filters</p>
          </div>
        )}

        {filteredNotes.length === 0 && !searchQuery && tagFilters.length === 0 && (
          <div className="no-results">
            <Search className="h-12 w-12 no-results-icon" />
            <h3>Start searching</h3>
            <p>Enter search terms or add tag filters to find your notes</p>
          </div>
        )}
      </div>
    </div>
  );
});