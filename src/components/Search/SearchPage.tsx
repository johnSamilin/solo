import { FC, useState, useEffect, useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import { Search, X, Tag as TagIcon, Filter, ArrowLeft, ChevronDown, ChevronUp, MoreHorizontal } from 'lucide-react';
import { useStore } from '../../stores/StoreProvider';
import { Note, TagNode } from '../../types';
import { buildTagTree, generateUniqueId } from '../../utils';
import { TagTreeItem } from '../Sidebar/TagTreeItem';
import { themes } from '../../constants';
import './SearchPage.css';

interface SearchPageProps {
  onClose: () => void;
  onNoteSelect: (note: Note) => void;
}

interface TagFilter {
  path: string;
  operator: 'AND' | 'OR' | 'NOT';
}

export const SearchPage: FC<SearchPageProps> = observer(({ onClose, onNoteSelect }) => {
  const { notesStore, settingsStore } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [tagFilters, setTagFilters] = useState<TagFilter[]>([]);
  const [availableTags, setAvailableTags] = useState<TagNode[]>([]);
  const [isTagSelectorOpen, setIsTagSelectorOpen] = useState(false);
  const [selectedTagOperator, setSelectedTagOperator] = useState<'AND' | 'OR' | 'NOT'>('AND');
  const [isFiltersCollapsed, setIsFiltersCollapsed] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState<Set<string>>(new Set());

  // Get all available tags from notes
  useEffect(() => {
    const allTags = Array.from(new Set(
      notesStore.notes.flatMap(note => note.tags.map(tag => tag.path))
    )).map(path => ({ id: path, path }));

    const tree = buildTagTree(allTags);
    setAvailableTags(tree);
  }, [notesStore.notes]);

  // Fuzzy search function
  const fuzzyMatch = (text: string, query: string): boolean => {
    if (!query) return true;
    
    const normalizedText = text.toLowerCase();
    const normalizedQuery = query.toLowerCase();
    
    // Simple fuzzy matching - check if all characters in query appear in order
    let queryIndex = 0;
    for (let i = 0; i < normalizedText.length && queryIndex < normalizedQuery.length; i++) {
      if (normalizedText[i] === normalizedQuery[queryIndex]) {
        queryIndex++;
      }
    }
    return queryIndex === normalizedQuery.length;
  };

  // Extract matching paragraphs from note content
  const getMatchingParagraphs = (content: string, query: string): string[] => {
    if (!query.trim()) return [];
    
    // Create a temporary div to parse HTML content
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;
    
    // Get all paragraph-like elements
    const elements = tempDiv.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li');
    const matchingParagraphs: string[] = [];
    
    elements.forEach(element => {
      const text = element.textContent || '';
      const dataTags = element.getAttribute('data-tags') || '';
      
      // Check if text content matches
      const textMatches = fuzzyMatch(text, query);
      
      // Check if any paragraph tags match
      const tagsMatch = dataTags && fuzzyMatch(dataTags.replace(/,/g, ' '), query);
      
      if (textMatches || tagsMatch) {
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
    
    // Check if a significant portion of the content matches
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = note.content;
    const fullText = tempDiv.textContent || '';
    
    // If the full text matches, consider it a full match
    return fuzzyMatch(fullText, query);
  };

  // Get content to display for a note (either full content or matching paragraphs)
  const getNoteDisplayContent = (note: Note, query: string): { content: string; isPartial: boolean } => {
    const filteredContent = getFilteredContent(note);
    
    if (!query.trim() || noteFullyMatches(note, query)) {
      return { content: filteredContent, isPartial: false };
    }
    
    // Get matching paragraphs
    const matchingParagraphs = getMatchingParagraphs(filteredContent, query);
    if (matchingParagraphs.length > 0) {
      return { content: matchingParagraphs.join(''), isPartial: true };
    }
    
    return { content: filteredContent, isPartial: false };
  };

  // Filter notes based on search query and tag filters
  const filteredNotes = useMemo(() => {
    let notes = notesStore.getVisibleNotes(settingsStore.isCensorshipEnabled());

    // Apply text search
    if (searchQuery.trim()) {
      notes = notes.filter(note => {
        // Check title match
        if (fuzzyMatch(note.title, searchQuery.trim())) {
          return true;
        }
        
        // Check if any paragraphs match
        const matchingParagraphs = getMatchingParagraphs(note.content, searchQuery.trim());
        return matchingParagraphs.length > 0;
      });
    }

    // Apply tag filters
    if (tagFilters.length > 0) {
      notes = notes.filter(note => {
        const noteTags = note.tags.map(tag => tag.path);
        
        // Group filters by operator
        const andFilters = tagFilters.filter(f => f.operator === 'AND');
        const orFilters = tagFilters.filter(f => f.operator === 'OR');
        const notFilters = tagFilters.filter(f => f.operator === 'NOT');

        // AND filters - all must match
        const andMatch = andFilters.length === 0 || andFilters.every(filter =>
          noteTags.some(tag => tag.includes(filter.path))
        );

        // OR filters - at least one must match
        const orMatch = orFilters.length === 0 || orFilters.some(filter =>
          noteTags.some(tag => tag.includes(filter.path))
        );

        // NOT filters - none must match
        const notMatch = notFilters.every(filter =>
          !noteTags.some(tag => tag.includes(filter.path))
        );

        return andMatch && orMatch && notMatch;
      });
    }

    // Sort by relevance (title matches first, then by creation date)
    return notes.sort((a, b) => {
      if (searchQuery.trim()) {
        const aTitle = a.title.toLowerCase().includes(searchQuery.toLowerCase());
        const bTitle = b.title.toLowerCase().includes(searchQuery.toLowerCase());
        
        if (aTitle && !bTitle) return -1;
        if (!aTitle && bTitle) return 1;
      }
      
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
  }, [searchQuery, tagFilters, notesStore.notes, settingsStore.isCensorshipEnabled()]);

  // Filter content based on censorship mode
  const getFilteredContent = (note: Note): string => {
    if (!settingsStore.isCensorshipEnabled()) {
      return note.content;
    }
    
    // Remove censored content when censorship is enabled
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = note.content;
    const censoredElements = tempDiv.querySelectorAll('span[data-censored]');
    censoredElements.forEach(el => el.remove());
    return tempDiv.innerHTML;
  };

  const addTagFilter = (tagPath: string) => {
    if (!tagFilters.some(f => f.path === tagPath)) {
      setTagFilters([...tagFilters, { path: tagPath, operator: selectedTagOperator }]);
    }
    setIsTagSelectorOpen(false);
  };

  const removeTagFilter = (tagPath: string) => {
    setTagFilters(tagFilters.filter(f => f.path !== tagPath));
  };

  const updateTagOperator = (tagPath: string, operator: 'AND' | 'OR' | 'NOT') => {
    setTagFilters(tagFilters.map(f => 
      f.path === tagPath ? { ...f, operator } : f
    ));
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setTagFilters([]);
  };

  const handleNoteClick = async (note: Note) => {
    // Load note content if not already loaded
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

  const getOperatorColor = (operator: 'AND' | 'OR' | 'NOT') => {
    switch (operator) {
      case 'AND': return '#22c55e';
      case 'OR': return '#3b82f6';
      case 'NOT': return '#ef4444';
      default: return '#6b7280';
    }
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

      // Load content for all notes in parallel
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
    const notebook = notesStore.notebooks.find(nb => nb.id === note.notebookId);
    const isLoading = loadingNotes.has(note.id);
    const { content: displayContent, isPartial } = getNoteDisplayContent(note, searchQuery);
    
    
    // Apply note-specific theme styles
    const noteTheme = note.theme ? themes[note.theme]?.settings : settingsStore.settings;
    const noteStyles = noteTheme ? {
      fontFamily: noteTheme.editorFontFamily,
      fontSize: noteTheme.editorFontSize,
      lineHeight: noteTheme.editorLineHeight,
    } : {};

    return (
      <div key={note.id} className="search-note-item">
        {isPartial && (
          <div className="partial-match-indicator">
            <MoreHorizontal className="h-4 w-4" />
            <span>Showing matching paragraphs</span>
            <MoreHorizontal className="h-4 w-4" />
          </div>
        )}
        
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
                __html: isPartial 
                  ? `<div class="partial-content">...${displayContent}...</div>`
                  : displayContent 
              }}
              onClick={(e) => {
                // Prevent event bubbling to note header
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

  const renderTagTree = (nodes: TagNode[], level = 0) => {
    return nodes.map(node => (
      <div key={node.id} style={{ paddingLeft: `${level}rem` }}>
        <div 
          className="tag-selector-item"
          onClick={() => addTagFilter(node.name)}
        >
          <TagIcon className="h-4 w-4" />
          <span>{node.name}</span>
        </div>
        {node.children.length > 0 && renderTagTree(node.children, level + 1)}
      </div>
    ));
  };

  return (
    <div className="search-page">
      <div className="search-header">
        <button onClick={onClose} className="search-back-button">
          <ArrowLeft className="h-5 w-5" />
          Back
        </button>
        <h1>Search Notes</h1>
      </div>

      <div className="search-content">
        <div className={`search-panel ${isFiltersCollapsed ? 'collapsed' : ''}`}>
          <button 
            className="filters-toggle"
            onClick={() => setIsFiltersCollapsed(!isFiltersCollapsed)}
          >
            <Filter className="h-4 w-4" />
            <span>Filters</span>
            {isFiltersCollapsed ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </button>
          
          <div className="search-input-section">
            <div className="search-input-wrapper">
              <Search className="h-5 w-5 search-icon" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search notes... (fuzzy search supported)"
                className="search-input"
                autoFocus
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="search-clear-button"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {!isFiltersCollapsed && (
            <div className="tag-filters-section">
            <div className="tag-filters-header">
              <h3>Tag Filters</h3>
              <div className="tag-operator-selector">
                <label>New filter type:</label>
                <select
                  value={selectedTagOperator}
                  onChange={(e) => setSelectedTagOperator(e.target.value as 'AND' | 'OR' | 'NOT')}
                  className="operator-select"
                >
                  <option value="AND">AND (must have)</option>
                  <option value="OR">OR (can have)</option>
                  <option value="NOT">NOT (must not have)</option>
                </select>
              </div>
            </div>

            <div className="active-filters">
              {tagFilters.map((filter, index) => (
                <div key={index} className="tag-filter-chip">
                  <span 
                    className="filter-operator"
                    style={{ backgroundColor: getOperatorColor(filter.operator) }}
                  >
                    {filter.operator}
                  </span>
                  <span className="filter-tag">{filter.path}</span>
                  <select
                    value={filter.operator}
                    onChange={(e) => updateTagOperator(filter.path, e.target.value as 'AND' | 'OR' | 'NOT')}
                    className="filter-operator-select"
                  >
                    <option value="AND">AND</option>
                    <option value="OR">OR</option>
                    <option value="NOT">NOT</option>
                  </select>
                  <button
                    onClick={() => removeTagFilter(filter.path)}
                    className="filter-remove-button"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>

            <div className="tag-selector">
              <button
                onClick={() => setIsTagSelectorOpen(!isTagSelectorOpen)}
                className="add-tag-filter-button"
              >
                <TagIcon className="h-4 w-4" />
                Add Tag Filter
              </button>

              {isTagSelectorOpen && (
                <div className="tag-selector-dropdown">
                  <div className="tag-selector-content">
                    {availableTags.length > 0 ? (
                      renderTagTree(availableTags)
                    ) : (
                      <p className="no-tags-message">No tags available</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {(searchQuery || tagFilters.length > 0) && (
              <button onClick={clearAllFilters} className="clear-filters-button">
                <Filter className="h-4 w-4" />
                Clear All Filters
              </button>
            )}
          </div>
          )}
        </div>

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
      </div>
    </div>
  );
});