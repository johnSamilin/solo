import { FC, useState, useMemo, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { ArrowLeft } from 'lucide-react';
import { useStore } from '../../stores/StoreProvider';
import { Note } from '../../types';
import { SearchInput } from './SearchInput';
import { SearchFilters } from './SearchFilters';
import { SearchResults } from './SearchResults';
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
  const { notesStore, settingsStore, tagsStore } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [tagFilters, setTagFilters] = useState<TagFilter[]>([]);
  const [selectedTagOperator, setSelectedTagOperator] = useState<'AND' | 'OR' | 'NOT'>('AND');

  useEffect(() => {
    tagsStore.loadTagsFromElectron();
  }, [tagsStore]);

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

  // Filter notes based on search query and tag filters
  const filteredNotes = useMemo(() => {
    let notes = notesStore.getVisibleNotes(settingsStore.isCensorshipEnabled());

    // Apply text search
    if (searchQuery.trim()) {
      notes = notes.filter(note => {
        if (fuzzyMatch(note.title, searchQuery.trim())) {
          return true;
        }
        
        const matchingParagraphs = getTextMatchingParagraphs(note.content, searchQuery.trim());
        return matchingParagraphs.length > 0;
      });
    }

    // Apply tag filters
    if (tagFilters.length > 0) {
      notes = notes.filter(note => {
        const matchingParagraphs = getMatchingParagraphs(note.content, tagFilters);
        if (matchingParagraphs.length > 0) {
          return true;
        }
        
        const noteTags = note.tags.map(tag => tag.path);
        
        const andFilters = tagFilters.filter(f => f.operator === 'AND');
        const orFilters = tagFilters.filter(f => f.operator === 'OR');
        const notFilters = tagFilters.filter(f => f.operator === 'NOT');

        const andMatch = andFilters.length === 0 || andFilters.every(filter =>
          noteTags.some(tag => tag.includes(filter.path))
        );

        const orMatch = orFilters.length === 0 || orFilters.some(filter =>
          noteTags.some(tag => tag.includes(filter.path))
        );

        const notMatch = notFilters.every(filter =>
          !noteTags.some(tag => tag.includes(filter.path))
        );

        return andMatch && orMatch && notMatch;
      });
    }

    // Sort by relevance
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
        <SearchInput
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
        
        <SearchFilters
          tagFilters={tagFilters}
          onAddTagFilter={addTagFilter}
          onRemoveTagFilter={removeTagFilter}
          onUpdateTagOperator={updateTagOperator}
          onClearAllFilters={clearAllFilters}
          selectedTagOperator={selectedTagOperator}
          onSetSelectedTagOperator={setSelectedTagOperator}
          searchQuery={searchQuery}
        />

        <SearchResults
          filteredNotes={filteredNotes}
          searchQuery={searchQuery}
          tagFilters={tagFilters}
          onNoteSelect={onNoteSelect}
        />
      </div>
    </div>
  );
});