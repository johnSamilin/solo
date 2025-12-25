import { FC, useState, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '../../stores/StoreProvider';

interface NoteHeaderProps {
  onDateClick: () => void;
}

export const NoteHeader: FC<NoteHeaderProps> = observer(({ onDateClick }) => {
  const { notesStore, settingsStore } = useStore();
  const [localTitle, setLocalTitle] = useState('');

  useEffect(() => {
    if (notesStore.selectedNote) {
      setLocalTitle(notesStore.selectedNote.title);
    }
  }, [notesStore.selectedNote?.id]);

  if (!notesStore.selectedNote) return null;

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
      <input
        type="text"
        value={localTitle}
        onChange={handleTitleChange}
        onBlur={handleTitleBlur}
        onKeyDown={handleKeyDown}
        className="editor-title"
        placeholder="Note Title"
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