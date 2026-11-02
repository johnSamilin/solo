import { FC, useRef, useEffect } from 'react';
import { X, BookmarkPlus } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useStore } from '../../stores/StoreProvider';
import { useI18n } from '../../i18n/I18nContext';

export const ReadLaterModal: FC = observer(() => {
  const { readLaterStore } = useStore();
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (readLaterStore.isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [readLaterStore.isOpen]);

  if (!readLaterStore.isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!readLaterStore.isLoading) {
      readLaterStore.submit();
    }
  };

  return (
    <div className="modal-overlay" onClick={readLaterStore.close}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '28rem' }}>
        <div className="modal-header">
          <h2>{t.readLater.title}</h2>
          <button
            onClick={readLaterStore.close}
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
              URL
            </label>
            <input
              ref={inputRef}
              type="url"
              value={readLaterStore.url}
              onChange={e => readLaterStore.setUrl(e.target.value)}
              placeholder={t.readLater.urlPlaceholder}
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
            />

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginTop: '1rem',
                fontSize: '0.875rem',
                color: 'var(--color-text)',
                fontFamily: "'Outfit', system-ui, sans-serif",
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={readLaterStore.saveStyles}
                onChange={e => readLaterStore.setSaveStyles(e.target.checked)}
              />
              {t.readLater.saveStyles}
            </label>

            {readLaterStore.error && (
              <p
                style={{
                  marginTop: '0.75rem',
                  fontSize: '0.8125rem',
                  color: '#dc3545',
                }}
              >
                {readLaterStore.error}
              </p>
            )}
          </div>

          <div className="modal-actions">
            <button
              type="button"
              onClick={readLaterStore.close}
              className="button-secondary"
              disabled={readLaterStore.isLoading}
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
              {t.readLater.cancel}
            </button>
            <button
              type="submit"
              disabled={readLaterStore.isLoading || !readLaterStore.url.trim()}
              className="button-primary"
            >
              <BookmarkPlus size={16} />
              {readLaterStore.isLoading ? t.readLater.saving : t.readLater.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});
