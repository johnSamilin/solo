import { FC, useState, useRef, useEffect } from 'react';
import { X, Save } from 'lucide-react';

interface SaveFilterModalProps {
  isOpen: boolean;
  initialLabel?: string;
  onConfirm: (label: string) => void;
  onCancel: () => void;
}

export const SaveFilterModal: FC<SaveFilterModalProps> = ({
  isOpen,
  initialLabel = '',
  onConfirm,
  onCancel,
}) => {
  const [label, setLabel] = useState(initialLabel);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setLabel(initialLabel);
      // Focus input after modal animation
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, initialLabel]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = label.trim();
    if (trimmed) {
      onConfirm(trimmed);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '24rem' }}>
        <div className="modal-header">
          <h2>{initialLabel ? 'Редактировать фильтр' : 'Сохранить поиск'}</h2>
          <button
            onClick={onCancel}
            className="modal-close-button"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-text-light)',
              padding: '0.25rem',
              display: 'flex',
            }}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-content">
            <label
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: 'var(--color-text)',
                fontFamily: "'Outfit', system-ui, sans-serif",
              }}
            >
              Название фильтра
            </label>
            <input
              ref={inputRef}
              type="text"
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="Например: Работа / проекты"
              className="modal-input"
              style={{
                width: '100%',
                padding: '0.625rem 0.75rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--color-border)',
                fontSize: '0.875rem',
                color: 'var(--color-text)',
                fontFamily: "'Outfit', system-ui, sans-serif",
                backgroundColor: 'var(--color-white)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              autoFocus
            />
          </div>

          <div className="modal-actions">
            <button
              type="button"
              onClick={onCancel}
              className="button-secondary"
              style={{
                padding: '0.625rem 1.25rem',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                fontFamily: "'Outfit', system-ui, sans-serif",
                border: '1px solid var(--color-border)',
                background: 'var(--color-white)',
                color: 'var(--color-text)',
                cursor: 'pointer',
              }}
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={!label.trim()}
              className="button-primary"
            >
              <Save size={16} />
              {initialLabel ? 'Сохранить' : 'Сохранить фильтр'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
