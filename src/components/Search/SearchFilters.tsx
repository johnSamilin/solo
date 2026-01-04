import { FC, useState } from 'react';
import { Filter, ChevronDown, ChevronUp, X, Tag as TagIcon } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useStore } from '../../stores/StoreProvider';
import { TagNode } from '../../types';

interface TagFilter {
  path: string;
  operator: 'AND' | 'OR' | 'NOT';
}

interface SearchFiltersProps {
  tagFilters: TagFilter[];
  onAddTagFilter: (tagPath: string) => void;
  onRemoveTagFilter: (tagPath: string) => void;
  onUpdateTagOperator: (tagPath: string, operator: 'AND' | 'OR' | 'NOT') => void;
  onClearAllFilters: () => void;
  selectedTagOperator: 'AND' | 'OR' | 'NOT';
  onSetSelectedTagOperator: (operator: 'AND' | 'OR' | 'NOT') => void;
  searchQuery: string;
  showOnlyEmptyNotes: boolean;
  onToggleEmptyNotes: (show: boolean) => void;
}

export const SearchFilters: FC<SearchFiltersProps> = observer(({
  tagFilters,
  onAddTagFilter,
  onRemoveTagFilter,
  onUpdateTagOperator,
  onClearAllFilters,
  selectedTagOperator,
  onSetSelectedTagOperator,
  searchQuery,
  showOnlyEmptyNotes,
  onToggleEmptyNotes
}) => {
  const { tagsStore } = useStore();
  const [isFiltersCollapsed, setIsFiltersCollapsed] = useState(false);
  const [isTagSelectorOpen, setIsTagSelectorOpen] = useState(false);

  const getOperatorColor = (operator: 'AND' | 'OR' | 'NOT') => {
    switch (operator) {
      case 'AND': return '#22c55e';
      case 'OR': return '#3b82f6';
      case 'NOT': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const renderTagTree = (nodes: TagNode[], level = 0) => {
    return nodes.map(node => (
      <div key={node.id} style={{ paddingLeft: `${level}rem` }}>
        <div 
          className="tag-selector-item"
          onClick={() => {
            onAddTagFilter(node.name);
            setIsTagSelectorOpen(false);
          }}
        >
          <TagIcon className="h-4 w-4" />
          <span>{node.name}</span>
        </div>
        {node.children.length > 0 && renderTagTree(node.children, level + 1)}
      </div>
    ));
  };

  return (
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
      
      {!isFiltersCollapsed && (
        <div className="tag-filters-section">
          <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #e9ecef' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showOnlyEmptyNotes}
                onChange={(e) => onToggleEmptyNotes(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <span style={{ fontWeight: '500' }}>Show only empty notes</span>
            </label>
          </div>

          <div className="tag-filters-header">
            <h3>Tag Filters</h3>
            <div className="tag-operator-selector">
              <label>New filter type:</label>
              <select
                value={selectedTagOperator}
                onChange={(e) => onSetSelectedTagOperator(e.target.value as 'AND' | 'OR' | 'NOT')}
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
                  onChange={(e) => onUpdateTagOperator(filter.path, e.target.value as 'AND' | 'OR' | 'NOT')}
                  className="filter-operator-select"
                >
                  <option value="AND">AND</option>
                  <option value="OR">OR</option>
                  <option value="NOT">NOT</option>
                </select>
                <button
                  onClick={() => onRemoveTagFilter(filter.path)}
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
                  {tagsStore.tagTree.length > 0 ? (
                    renderTagTree(tagsStore.tagTree)
                  ) : (
                    <p className="no-tags-message">No tags available</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {(searchQuery || tagFilters.length > 0) && (
            <button onClick={onClearAllFilters} className="clear-filters-button">
              <Filter className="h-4 w-4" />
              Clear All Filters
            </button>
          )}
        </div>
      )}
    </div>
  );
});