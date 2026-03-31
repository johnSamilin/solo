import React, { FC, useState, useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import { Plus, ChevronRight, ChevronDown } from 'lucide-react';
import { useStore } from '../../stores/StoreProvider';
import { TagNode } from '../../types';
import './EmptyState.css';

interface EmptyStateProps {
  onCreateNote: () => void;
  onOpenSearch: (tagPath?: string) => void;
}

const PASTEL_GRADIENTS = [
  ['#fde8e8', '#fce4f3'],
  ['#e8f4fd', '#e4f3e8'],
  ['#fdf6e8', '#fde8d0'],
  ['#eee8fd', '#e8f0fd'],
  ['#e8fdf5', '#e8fdee'],
  ['#fdf0e8', '#fde8e8'],
  ['#f0fde8', '#e8f9fd'],
  ['#fde8f5', '#f5e8fd'],
];

function pickGradient(index: number): string {
  const pair = PASTEL_GRADIENTS[index % PASTEL_GRADIENTS.length];
  const angle = 120 + (index * 37) % 120;
  return `linear-gradient(${angle}deg, ${pair[0]}, ${pair[1]})`;
}

const EXAMPLE_FILTERS = [
  { id: '1', label: 'Дети и воспоминания' },
  { id: '2', label: 'Заметки и поездки, кроме Финляндия' },
  { id: '3', label: 'Идеи и планы' },
  { id: '4', label: 'Работа / проекты' },
];

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

export const EmptyState: FC<EmptyStateProps> = observer(({ onCreateNote, onOpenSearch }) => {
  const { tagsStore } = useStore();

  const gradientOffset = useMemo(() => Math.floor(Math.random() * PASTEL_GRADIENTS.length), []);

  const handleTagClick = (path: string) => {
    onOpenSearch(path);
  };

  return (
    <div className="es-root">
      <div className="es-inner">
        <section className="es-section">
          <h2 className="es-section-title">Сохранённые фильтры</h2>
          <div className="es-filters-grid">
            {EXAMPLE_FILTERS.map((filter, i) => (
              <button
                key={filter.id}
                className="es-filter-card"
                style={{ background: pickGradient(gradientOffset + i) } as React.CSSProperties}
                onClick={() => onOpenSearch()}
              >
                <span className="es-filter-label">{filter.label}</span>
              </button>
            ))}
          </div>
        </section>

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
    </div>
  );
});
