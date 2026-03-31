import { FC, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Plus, ChevronRight, ChevronDown } from 'lucide-react';
import { useStore } from '../../stores/StoreProvider';
import { TagNode } from '../../types';
import './EmptyState.css';

interface EmptyStateProps {
  onCreateNote: () => void;
  onOpenSearch: (tagPath?: string) => void;
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

  const handleTagClick = (path: string) => {
    onOpenSearch(path);
  };

  return (
    <div className="es-root">
      <div className="es-inner">
        <section className="es-section">
          <h2 className="es-section-title">Сохранённые фильтры</h2>
          <div className="es-filters-grid">
            {EXAMPLE_FILTERS.map(filter => (
              <button
                key={filter.id}
                className="es-filter-card"
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
