import { FC, useState, useEffect } from 'react';
import { ExternalLink } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useStore } from '../../stores/StoreProvider';
import { useI18n } from '../../i18n/I18nContext';

interface NoteHeaderProps {
  onDateClick: () => void;
}

export const NoteHeader: FC<NoteHeaderProps> = observer(({ onDateClick }) => {
  const { notesStore, settingsStore } = useStore();
  const { t } = useI18n();
  const [localTitle, setLocalTitle] = useState('');

  useEffect(() => {
    if (notesStore.selectedNote) {
      setLocalTitle(notesStore.selectedNote.title);
    }
  }, [notesStore.selectedNote?.id]);

  if (!notesStore.selectedNote) return null;

  const sourceUrl = notesStore.selectedNote.sourceUrl;

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalTitle(e.target.value);
  };

  const handleTitleBlur = () => {
    if (notesStore.selectedNote && localTitle !== notesStore.selectedNote.title) {
      notesStore.updateNote(notesStore.selectedNote.id, {
        title: localTitle,
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  return (
    <>
      {sourceUrl && (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="note-source-link"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.375rem',
            maxWidth: '100%',
            fontSize: '0.8125rem',
            color: 'var(--color-text-light)',
            textDecoration: 'none',
            marginBottom: '0.5rem',
          }}
        >
          <ExternalLink size={14} style={{ flexShrink: 0 }} />
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {sourceUrl}
          </span>
        </a>
      )}
      <input
        type="text"
        value={localTitle}
        onChange={handleTitleChange}
        onBlur={handleTitleBlur}
        onKeyDown={handleKeyDown}
        className="editor-title"
        placeholder={t.editor.noteTitle}
      />
      {!settingsStore.isZenMode && (
        <p className="note-item-date">
          <span
            className="note-date-clickable"
            onClick={onDateClick}
            title="Click to edit date"
          >
            {new Date(notesStore.selectedNote.createdAt).toLocaleDateString()}
          </span>
        </p>
      )}
    </>
  );
});