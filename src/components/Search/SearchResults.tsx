import { FC, useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { Note } from '../../types';
import { useStore } from '../../stores/StoreProvider';
import { themes } from '../../constants';
import { getNoteDisplayContent, SearchTagFilter } from './noteDisplayContent';


interface SearchResultsProps {
  filteredNotes: Note[];
  searchQuery: string;
  tagFilters: SearchTagFilter[];
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
    const { content: displayContent, isPartial } = getNoteDisplayContent(note, searchQuery, tagFilters);
    
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
