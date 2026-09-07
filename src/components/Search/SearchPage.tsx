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
import { performSemanticSearchWithNotes, buildTagExpression, TagFilter, filterNotes, fuzzyMatch, getTextMatchingParagraphs, getMatchingParagraphs } from '../../utils/search';
import './SearchPage.css';
import { useI18n } from '../../i18n/I18nContext';

interface SearchPageProps {
  onClose: () => void;
  onNoteSelect: (note: Note) => void;
  initialTagPath?: string;
  initialFilters?: SavedFilter;
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

  // Query the local model only when there is a text query. Tags remain a legacy filter.
  useEffect(() => {
    if (flags.extendedSearch && isExtendedSearch && searchQuery.trim()) {
      const timer = setTimeout(async () => {
        const results = await performSemanticSearchWithNotes(searchQuery, [], notesStore.notes, relevanceThreshold);
        setSemanticResults(results);
      }, 300); // Задержка для предотвращения частых запросов
     
     return () => clearTimeout(timer);
   } else {
     // Reset semantic results when extended search is disabled
     setSemanticResults([]);
   }
 }, [searchQuery, tagFilters, notesStore.notes, flags.extendedSearch, isExtendedSearch, relevanceThreshold]);

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



  // Обновленный useMemo для фильтрации заметок с учетом семантического поиска
   const filteredNotes = useMemo(() => {
     // Если включен расширенный поиск, используем семантический поиск
      if (flags.extendedSearch && isExtendedSearch) {
        const allNotes = notesStore.getVisibleNotes();

        if (tagFilters.length > 0 || tagInputValue.trim()) {
          const tagResults = filterNotes(allNotes, '', tagFilters, tagInputValue, showOnlyEmptyNotes);

          if (!searchQuery.trim()) {
            return tagResults;
          }

          const tagResultIds = new Set(tagResults.map(note => note.id));
          return semanticResults.filter(note => tagResultIds.has(note.id));
        }

        return semanticResults;
      }
     
     // Use the standard filtering function from the shared module
     const allNotes = notesStore.getVisibleNotes();
     return filterNotes(allNotes, searchQuery, tagFilters, tagInputValue, showOnlyEmptyNotes);
   }, [searchQuery, tagFilters, tagInputValue, showOnlyEmptyNotes, notesStore.getVisibleNotes, semanticResults, flags.extendedSearch, isExtendedSearch]);
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
          filteredNotes={filteredNotes}
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
