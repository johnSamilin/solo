import React, { FC, useState, useMemo, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import MeshGradient from 'mesh-gradient.js';
import { Plus, ChevronRight, ChevronDown, X, Edit2 } from 'lucide-react';
import { useStore } from '../../stores/StoreProvider';
import { TagNode, SavedFilter } from '../../types';
import { SaveFilterModal } from '../Modals/SaveFilterModal';
import './EmptyState.css';

const gradient = new MeshGradient();
const PASTEL_GRADIENTS = [
  '#fde8e8', '#fce4f3',
  '#eb75b6', '#ddf3ff',
  '#6e3deb', '#c92f3c',
  '#e8f4fd', '#e4f3e8',
  '#fdf6e8', '#fde8d0',
  '#eee8fd', '#e8f0fd',
  '#e8fdf5', '#e8fdee',
  '#fdf0e8', '#fde8e8',
  '#f0fde8', '#e8f9fd',
  '#fde8f5', '#f5e8fd',
];

interface EmptyStateProps {
  onCreateNote: () => void;
  onOpenSearch: (tagPath?: string) => void;
  onOpenSearchWithFilters?: (filter: SavedFilter) => void;
}

interface TagTreeNodeProps {
  node: TagNode;
  onTagClick: (path: string) => void;
}

const TagTreeNode: FC<TagTreeNodeProps> = ({ node, onTagClick }) => {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = node.children.length > 0;

  return (
    <li className="es-tag-item">
      <div className="es-tag-row">
        {hasChildren ? (
          <button
            className="es-tag-expand"
            onClick={() => setExpanded(v => !v)}
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
        ) : (
          <span className="es-tag-expand es-tag-expand--spacer" />
        )}
        <button className="es-tag-link" onClick={() => onTagClick(node.path)}>
          {node.name}
        </button>
      </div>
      {hasChildren && expanded && (
        <ul className="es-tag-children">
          {node.children.map(child => (
            <TagTreeNode key={child.id} node={child} onTagClick={onTagClick} />
          ))}
        </ul>
      )}
    </li>
  );
};

export const EmptyState: FC<EmptyStateProps> = observer(({ onCreateNote, onOpenSearch, onOpenSearchWithFilters }) => {
  const { tagsStore, savedFiltersStore } = useStore();
  const [editingFilter, setEditingFilter] = useState<SavedFilter | null>(null);

  const handleTagClick = (path: string) => {
    onOpenSearch(path);
  };

  const handleFilterClick = (filter: SavedFilter) => {
    onOpenSearchWithFilters?.(filter);
  };

  const handleDeleteFilter = (e: React.MouseEvent, filterId: string) => {
    e.stopPropagation();
    savedFiltersStore.deleteFilter(filterId);
  };

  const handleEditFilter = (e: React.MouseEvent, filter: SavedFilter) => {
    e.stopPropagation();
    setEditingFilter(filter);
  };

  // Initialize gradients for saved filter canvases
  useEffect(() => {
    savedFiltersStore.savedFilters.forEach(filter => {
      const canvas = document.getElementById(`bg-saved-${filter.id}`) as HTMLCanvasElement;
      if (canvas) {
        try {
          gradient.initGradient(`#bg-saved-${filter.id}`, PASTEL_GRADIENTS);
          gradient?.changePosition(filter.label.length);
        } catch (err) {
          // Canvas might not be ready yet
        }
      }
    });
  }, [savedFiltersStore.savedFilters]);

  return (
    <div className="es-root">
      <div className="es-inner">
        {savedFiltersStore.savedFilters.length > 0 && (
          <section className="es-section es-section-saved-filters">
            <h2 className="es-section-title">Сохранённые фильтры</h2>
            <div className="es-filters-grid">
              {savedFiltersStore.savedFilters.map(filter => (
                <div
                  className="es-filter-card"
                  key={filter.id}
                  onClick={() => handleFilterClick(filter)}
                >
                  <canvas
                    id={`bg-saved-${filter.id}`}
                    className="es-filter-bg"
                  />
                  <button
                    className="es-filter-delete"
                    onClick={(e) => handleDeleteFilter(e, filter.id)}
                    title="Удалить фильтр"
                  >
                    <X size={14} />
                  </button>
                  <button
                    className="es-filter-edit"
                    onClick={(e) => handleEditFilter(e, filter)}
                    title="Редактировать название"
                  >
                    <Edit2 size={12} />
                  </button>
                  <span className="es-filter-label">{filter.label}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {tagsStore.tagTree.length > 0 && (
          <section className="es-section">
            <h2 className="es-section-title">Теги</h2>
            <ul className="es-tag-tree">
              {tagsStore.tagTree.map(node => (
                <TagTreeNode key={node.id} node={node} onTagClick={handleTagClick} />
              ))}
            </ul>
          </section>
        )}

        <div className="es-actions">
          <button onClick={onCreateNote} className="button-primary">
            <Plus size={16} />
            Создать заметку
          </button>
        </div>
      </div>

      <SaveFilterModal
        isOpen={editingFilter !== null}
        initialLabel={editingFilter?.label ?? ''}
        onConfirm={(newLabel) => {
          if (editingFilter) {
            savedFiltersStore.updateLabel(editingFilter.id, newLabel);
          }
          setEditingFilter(null);
        }}
        onCancel={() => setEditingFilter(null)}
      />
    </div>
  );
});
