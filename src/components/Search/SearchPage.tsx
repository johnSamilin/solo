import { FC, useState, useMemo, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { ArrowLeft, Save, RefreshCw, Tag as TagIcon, X } from 'lucide-react';
import { useStore } from '../../stores/StoreProvider';
import { Note, SavedFilter, TagNode } from '../../types';
import { SearchInput } from './SearchInput';
import { SearchFilters } from './SearchFilters';
import { SearchResults } from './SearchResults';
import { SaveFilterModal } from '../Modals/SaveFilterModal';
import { flags } from '../../utils/featureFlags';
import { getNativeAPI } from '../../utils/nativeBridge';
import './SearchPage.css';
import { useI18n } from '../../i18n/I18nContext';

interface SearchPageProps {
  onClose: () => void;
  onNoteSelect: (note: Note) => void;
  initialTagPath?: string;
  initialFilters?: SavedFilter;
}

interface TagFilter {
  path: string;
  operator: 'AND' | 'OR' | 'NOT';
}

export const SearchPage: FC<SearchPageProps> = observer(({ onClose, onNoteSelect, initialTagPath, initialFilters }) => {
  const { notesStore, settingsStore, tagsStore, savedFiltersStore } = useStore();
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [tagFilters, setTagFilters] = useState<TagFilter[]>(
    initialTagPath ? [{ path: initialTagPath, operator: 'AND' }] : []
  );
  const [selectedTagOperator, setSelectedTagOperator] = useState<'AND' | 'OR' | 'NOT'>('AND');
  const [showOnlyEmptyNotes, setShowOnlyEmptyNotes] = useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [isExtendedSearch, setIsExtendedSearch] = useState(false);
  const [isReindexing, setIsReindexing] = useState(false);
  const [reindexProgress, setReindexProgress] = useState<{ processed: number; total: number } | null>(null);
  const [reindexError, setReindexError] = useState<string | null>(null);
  const [showTagTree, setShowTagTree] = useState(true);
  const [tagInputValue, setTagInputValue] = useState('');
  const [relevanceThreshold, setRelevanceThreshold] = useState<number>(0.1);
  const [semanticResults, setSemanticResults] = useState<Note[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Apply initialFilters when provided
  useEffect(() => {
    if (initialFilters) {
      setSearchQuery(initialFilters.searchQuery);
      setTagFilters(initialFilters.tagFilters);
      setShowOnlyEmptyNotes(initialFilters.showOnlyEmptyNotes);
    }
  }, [initialFilters]);

  useEffect(() => {
    tagsStore.loadTagsFromElectron();
  }, [tagsStore]);
// Subscribe to re-index progress events emitted by the Electron host while a
// full re-index runs. Only relevant when extended search is available.
useEffect(() => {
  if (!flags.extendedSearch) return;
  const api = getNativeAPI();
  if (!api?.onReindexProgress) return;
  const unsubscribe = api.onReindexProgress((data) => {
    setReindexProgress(data);
  });
  return unsubscribe;
}, []);

// Perform semantic search when search parameters change
useEffect(() => {
  if (flags.extendedSearch && isExtendedSearch) {
    const timer = setTimeout(() => {
      performSemanticSearch().then(results => {
        setSemanticResults(results);
      });
    }, 300); // Задержка для предотвращения частых запросов
    
    return () => clearTimeout(timer);
  } else {
    // Reset semantic results when extended search is disabled
    setSemanticResults([]);
  }
}, [searchQuery, tagFilters, flags.extendedSearch, isExtendedSearch, relevanceThreshold]);

  const handleReindex = async () => {
    const api = getNativeAPI();
    if (!api?.reindexAll || isReindexing) return;

    setIsReindexing(true);
    setReindexError(null);
    setReindexProgress({ processed: 0, total: 0 });
    try {
      const result = await api.reindexAll();
      if (!result.success) {
        setReindexError(result.error || 'Не удалось переиндексировать заметки');
      }
    } catch (error) {
      setReindexError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsReindexing(false);
    }
  };

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

  // Filter notes based on search query, tag input and tag filters
  const standardFilteredNotes = useMemo(() => {
    const hasSearchQuery = searchQuery.trim().length > 0;
    const hasTagFilters = tagFilters.length > 0;
    const hasTagInput = tagInputValue.trim().length > 0;
    const hasAnyFilter = hasSearchQuery || hasTagFilters || hasTagInput || showOnlyEmptyNotes;

    if (!hasAnyFilter) {
      return [];
    }

    let notes = notesStore.getVisibleNotes();

    // Apply empty notes filter
    if (showOnlyEmptyNotes) {
      notes = notes.filter(note => notesStore.isNoteEmpty(note));
    }

    // Apply text search
    if (hasSearchQuery) {
      notes = notes.filter(note => {
        if (fuzzyMatch(note.title, searchQuery.trim())) {
          return true;
        }

        const matchingParagraphs = getTextMatchingParagraphs(note.content, searchQuery.trim());
        return matchingParagraphs.length > 0;
      });
    }

    // Apply tag filters
    if (hasTagFilters) {
      notes = notes.filter(note => {
        const matchingParagraphs = getMatchingParagraphs(note.content, tagFilters);
        if (matchingParagraphs.length > 0) {
          return true;
        }

        const allTags = [...note.tags, ...(note.paragraphTags || [])];

        const andFilters = tagFilters.filter(f => f.operator === 'AND');
        const orFilters = tagFilters.filter(f => f.operator === 'OR');
        const notFilters = tagFilters.filter(f => f.operator === 'NOT');

        const andMatch = andFilters.length === 0 || andFilters.every(filter =>
          allTags.some(tag => tag.includes(filter.path))
        );

        const orMatch = orFilters.length === 0 || orFilters.some(filter =>
          allTags.some(tag => tag.includes(filter.path))
        );

        const notMatch = notFilters.every(filter =>
          !allTags.some(tag => tag.includes(filter.path))
        );

        return andMatch && orMatch && notMatch;
      });
    }

    // Apply tag input filter
    if (hasTagInput) {
      const tagInputTerms = tagInputValue.trim().split(/\s+/).filter(term => term.length > 0);
      
      if (tagInputTerms.length > 0) {
        // For now we'll use AND logic between terms in the tag input field
        notes = notes.filter(note => {
          const allNoteTags = [...note.tags, ...(note.paragraphTags || [])];
          return tagInputTerms.every(term =>
            allNoteTags.some(tag => tag.toLowerCase().includes(term.toLowerCase()))
          );
        });
      }
    }

    // Sort by relevance
    return notes.slice().sort((a, b) => {
      if (searchQuery.trim()) {
        const aTitle = a.title.toLowerCase().includes(searchQuery.toLowerCase());
        const bTitle = b.title.toLowerCase().includes(searchQuery.toLowerCase());
        
        if (aTitle && !bTitle) return -1;
        if (!aTitle && bTitle) return 1;
      }

      return b.createdAt.getTime() - a.createdAt.getTime();
    });
  }, [searchQuery, tagFilters, tagInputValue, showOnlyEmptyNotes, notesStore.notes]);

  // Функция для преобразования результатов семантического поиска в формат Note
  const convertSemanticResultsToNotes = (semanticResults: any): Note[] => {
    const groupedResults = new Map<string, { note: Note, scores: number[] }>();
    
    semanticResults.results.forEach((result: any) => {
      // Извлекаем ID заметки из пути файла или из поля noteId
      const noteId = result.noteId || result.filePath.replace(/\.[^/.]+$/, ''); // убираем расширение файла
      
      // Находим соответствующую заметку в хранилище
      const note = notesStore.notes.find(n => n.id === noteId || n.filePath === result.filePath);
      
      if (note) {
        if (groupedResults.has(note.id)) {
          // Если заметка уже есть, добавляем к ней оценку
          groupedResults.get(note.id)!.scores.push(result.score || 0);
        } else {
          // Создаем новую запись для заметки
          groupedResults.set(note.id, {
            note: { ...note },
            scores: [result.score || 0]
          });
        }
      }
    });
    
    // Преобразуем в массив и вычисляем среднюю оценку для сортировки
    return Array.from(groupedResults.values()).map(item => ({
      ...item.note,
      // Используем максимальный или средний скор из всех параграфов заметки
      relevanceScore: Math.max(...item.scores)
    })).sort((a, b) => {
      // Сортировка по дате по возрастанию
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
  };

  // Обновленная функция поиска с использованием семантики
  const performSemanticSearch = async () => {
    if (!flags.extendedSearch || !isExtendedSearch) {
      return [];
    }
    
    setIsSearching(true);
    try {
      const api = getNativeAPI();
      if (!api?.searchSemantic) {
        console.error('Semantic search API not available');
        return [];
      }
      
      // Подготовка текстового запроса и выражения тегов
      const queryText = searchQuery.trim() || undefined;
      const tagFiltersStr = tagFilters.length > 0
        ? tagFilters.map(f => `${f.operator} ${f.path}`).join(' ').trim()
        : undefined;
      
      const response = await api.searchSemantic(queryText, tagFiltersStr);
      
      if (!response.success || !response.result) {
        console.error('Semantic search failed:', response.error);
        return [];
      }
      
      // Фильтрация по порогу релевантности
      const filteredResults = {
        ...response.result,
        results: response.result.results.filter(result =>
          result.score === undefined || result.score >= relevanceThreshold
        )
      };
      
      // Преобразование результатов в формат Note
      return convertSemanticResultsToNotes(filteredResults);
    } catch (error) {
      console.error('Error during semantic search:', error);
      return [];
    } finally {
      setIsSearching(false);
    }
  };

  // Обновленный useMemo для фильтрации заметок с учетом семантического поиска
  const filteredNotes = useMemo(() => {
    // Если включен расширенный поиск, используем семантический поиск
    if (flags.extendedSearch && isExtendedSearch) {
      return semanticResults;
    }
    
    const hasSearchQuery = searchQuery.trim().length > 0;
    const hasTagFilters = tagFilters.length > 0;
    const hasTagInput = tagInputValue.trim().length > 0;
    const hasAnyFilter = hasSearchQuery || hasTagFilters || hasTagInput || showOnlyEmptyNotes;

    if (!hasAnyFilter) {
      return [];
    }

    let notes = notesStore.getVisibleNotes();

    // Apply empty notes filter
    if (showOnlyEmptyNotes) {
      notes = notes.filter(note => notesStore.isNoteEmpty(note));
    }

    // Apply text search
    if (hasSearchQuery) {
      notes = notes.filter(note => {
        if (fuzzyMatch(note.title, searchQuery.trim())) {
          return true;
        }

        const matchingParagraphs = getTextMatchingParagraphs(note.content, searchQuery.trim());
        return matchingParagraphs.length > 0;
      });
    }

    // Apply tag filters
    if (hasTagFilters) {
      notes = notes.filter(note => {
        const matchingParagraphs = getMatchingParagraphs(note.content, tagFilters);
        if (matchingParagraphs.length > 0) {
          return true;
        }

        const allTags = [...note.tags, ...(note.paragraphTags || [])];

        const andFilters = tagFilters.filter(f => f.operator === 'AND');
        const orFilters = tagFilters.filter(f => f.operator === 'OR');
        const notFilters = tagFilters.filter(f => f.operator === 'NOT');

        const andMatch = andFilters.length === 0 || andFilters.every(filter =>
          allTags.some(tag => tag.includes(filter.path))
        );

        const orMatch = orFilters.length === 0 || orFilters.some(filter =>
          allTags.some(tag => tag.includes(filter.path))
        );

        const notMatch = notFilters.every(filter =>
          !allTags.some(tag => tag.includes(filter.path))
        );

        return andMatch && orMatch && notMatch;
      });
    }

    // Apply tag input filter
    if (hasTagInput) {
      const tagInputTerms = tagInputValue.trim().split(/\s+/).filter(term => term.length > 0);
      
      if (tagInputTerms.length > 0) {
        // For now we'll use AND logic between terms in the tag input field
        notes = notes.filter(note => {
          const allNoteTags = [...note.tags, ...(note.paragraphTags || [])];
          return tagInputTerms.every(term =>
            allNoteTags.some(tag => tag.toLowerCase().includes(term.toLowerCase()))
          );
        });
      }
    }

    // Sort by relevance
    return notes.slice().sort((a, b) => {
      if (searchQuery.trim()) {
        const aTitle = a.title.toLowerCase().includes(searchQuery.toLowerCase());
        const bTitle = b.title.toLowerCase().includes(searchQuery.toLowerCase());
        
        if (aTitle && !bTitle) return -1;
        if (!aTitle && bTitle) return 1;
      }

      return b.createdAt.getTime() - a.createdAt.getTime();
    });
  }, [searchQuery, tagFilters, tagInputValue, showOnlyEmptyNotes, notesStore.notes, semanticResults, flags.extendedSearch, isExtendedSearch]);
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

  const insertTagIntoTagInput = (tagPath: string) => {
    setTagInputValue(prev => prev ? `${prev} ${tagPath}` : tagPath);
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setTagFilters([]);
    setShowOnlyEmptyNotes(false);
  };

  const hasActiveFilters = searchQuery.trim().length > 0 || tagFilters.length > 0 || showOnlyEmptyNotes;

  // Функция для отображения дерева тегов
  const renderTagTree = (nodes: TagNode[], level = 0) => {
    return nodes.map(node => (
      <div key={node.id} style={{ paddingLeft: `${level}rem` }}>
        <div
          className="tag-selector-item"
          onClick={() => insertTagIntoTagInput(node.path)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.25rem 0.5rem',
            cursor: 'pointer',
            borderRadius: '4px',
            margin: '0.125rem 0',
            transition: 'background-color 0.2s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''}
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
        <SearchInput
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
        {hasActiveFilters && (
          <button
            onClick={() => setIsSaveDialogOpen(true)}
            className="search-save-filter-button"
            style={{
              marginLeft: 'auto',
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--color-border)',
              background: 'var(--color-white)',
              color: 'var(--color-text)',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 500,
              fontFamily: "'Outfit', system-ui, sans-serif",
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s ease',
            }}
          >
            <Save size={16} />
            Сохранить поиск
          </button>
        )}
      </div>

      <div className="search-content">
        <div className='search-filters-panel'>
          {flags.extendedSearch && (
            <label className="extended-search-toggle">
              <span className="extended-search-toggle__labels">
                <span className="extended-search-toggle__title">Extended search</span>
                <span className="extended-search-toggle__hint">Turn this off if search works like shit</span>
              </span>
              <span className="extended-search-toggle__switch">
                <input
                  type="checkbox"
                  role="switch"
                  checked={isExtendedSearch}
                  onChange={(e) => setIsExtendedSearch(e.target.checked)}
                />
                <span className="extended-search-toggle__slider" />
              </span>
            </label>
          )}

          {flags.extendedSearch && isExtendedSearch && (
            <div className="reindex-panel">
              <button
                type="button"
                className="reindex-button"
                onClick={handleReindex}
                disabled={isReindexing}
              >
                <RefreshCw size={16} className={isReindexing ? 'reindex-icon--spinning' : undefined} />
                {isReindexing ? 'Переиндексация…' : 'Переиндексировать заметки'}
              </button>

              {isReindexing && (
                <div className="reindex-progress">
                  <div className="reindex-progress__bar">
                    <div
                      className="reindex-progress__fill"
                      style={{
                        width:
                          reindexProgress && reindexProgress.total > 0
                            ? `${Math.round((reindexProgress.processed / reindexProgress.total) * 100)}%`
                            : '0%',
                      }}
                    />
                  </div>
                  <span className="reindex-progress__label">
                    {reindexProgress && reindexProgress.total > 0
                      ? `${reindexProgress.processed} / ${reindexProgress.total}`
                      : 'Подготовка…'}
                  </span>
                </div>
              )}

              {reindexError && (
                <span className="reindex-error">{reindexError}</span>
              )}
              
              {/* Панель настройки порога релевантности */}
              <div className="relevance-threshold-panel">
                <label className="relevance-threshold-label">
                  Relevance threshold: {relevanceThreshold.toFixed(2)}
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={relevanceThreshold}
                  onChange={(e) => setRelevanceThreshold(parseFloat(e.target.value))}
                  className="relevance-threshold-slider"
                />
              </div>
            </div>
          )}
          
          {/* Поле для ввода тегов */}
          <div className="tag-input-section">
            <div className="tag-input-wrapper">
              <TagIcon className="h-5 w-5 search-icon"/>
              <input
                type="text"
                value={tagInputValue}
                onChange={(e) => setTagInputValue(e.target.value)}
                placeholder={t.search.enterTags}
                className="tag-input search-input"
              />
              {tagInputValue && (
                <button
                  onClick={() => setTagInputValue('')}
                  className="search-clear-button"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          
          {/* Добавляем кнопку для переключения видимости дерева тегов */}
          <div className="tag-tree-toggle-container">
            <button
              onClick={() => setShowTagTree(!showTagTree)}
              className="show-tags-toggle-button"
            >
              <TagIcon className="h-4 w-4" />
              {showTagTree ? t.search.hideTags : t.search.showTags}
            </button>
            
            {/* Отображаем дерево тегов под полем ввода */}
            {showTagTree && (
              <div className="tag-tree-container">
                {tagsStore.tagTree.length > 0 ? (
                  renderTagTree(tagsStore.tagTree)
                ) : (
                  <p className="no-tags-message">{t.tags.noTags}</p>
                )}
              </div>
            )}
          </div>
        </div>
        <SearchResults
          filteredNotes={flags.extendedSearch && isExtendedSearch ? semanticResults : standardFilteredNotes}
          searchQuery={searchQuery}
          tagFilters={tagFilters}
          onNoteSelect={onNoteSelect}
        />
      </div>

      <SaveFilterModal
        isOpen={isSaveDialogOpen}
        onConfirm={(label) => {
          savedFiltersStore.saveFilter(label, searchQuery, tagFilters, showOnlyEmptyNotes);
          setIsSaveDialogOpen(false);
        }}
        onCancel={() => setIsSaveDialogOpen(false)}
      />
    </div>
  );
});