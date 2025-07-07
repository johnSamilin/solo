import { FC, useState, useEffect, useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import { Search, X, Tag as TagIcon, Filter, ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { useStore } from '../../stores/StoreProvider';
import { Note, TagNode } from '../../types';
import { buildTagTree } from '../../utils';
import { TagTreeItem } from '../Sidebar/TagTreeItem';
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

  // Filter notes based on search query and tag filters
  const filteredNotes = useMemo(() => {
    let notes = notesStore.getVisibleNotes(settingsStore.isCensorshipEnabled());

    // Apply text search
    if (searchQuery.trim()) {
      notes = notes.filter(note => {
        const searchableText = `${note.title} ${note.content}`.toLowerCase();
        return fuzzyMatch(searchableText, searchQuery.trim());
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
      await notesStore.loadNoteContent(note);
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

  // Combine all filtered notes into one big content
  const combinedContent = useMemo(() => {
    if (filteredNotes.length === 0) return '';
    
    return filteredNotes.map(note => {
      const notebook = notesStore.notebooks.find(nb => nb.id === note.notebookId);
      const noteHeader = `
        <div class="combined-note-header" data-note-id="${note.id}">
          <h2>${note.title}</h2>
          <div class="note-meta">
            <span class="notebook-name">${notebook?.name || 'Unknown'}</span>
            <span class="note-date">${note.createdAt.toLocaleDateString()}</span>
          </div>
          ${note.tags.length > 0 ? `
            <div class="note-tags">
              ${note.tags.map(tag => `<span class="note-tag">${tag.path}</span>`).join('')}
            </div>
          ` : ''}
        </div>
      `;
      
      return noteHeader + (note.content || '<p><em>No content</em></p>');
    }).join('<hr class="note-separator" />');
  }, [filteredNotes, notesStore.notebooks]);

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
              <div 
                className="combined-notes-content"
                dangerouslySetInnerHTML={{ __html: combinedContent }}
                onClick={(e) => {
                  // Handle clicks on note headers to select individual notes
                  const target = e.target as HTMLElement;
                  const noteHeader = target.closest('.combined-note-header');
                  if (noteHeader) {
                    const noteId = noteHeader.getAttribute('data-note-id');
                    const note = filteredNotes.find(n => n.id === noteId);
                    if (note) {
                      handleNoteClick(note);
                    }
                  }
                }}
              />
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