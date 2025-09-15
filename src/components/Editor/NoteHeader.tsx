import { FC } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '../../stores/StoreProvider';

interface NoteHeaderProps {
  onDateClick: () => void;
}

export const NoteHeader: FC<NoteHeaderProps> = observer(({ onDateClick }) => {
  const { notesStore, settingsStore } = useStore();

  if (!notesStore.selectedNote) return null;

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (notesStore.selectedNote) {
      notesStore.updateNote(notesStore.selectedNote.id, {
        title: e.target.value,
      });
    }
  };

  return (
    <>
      <input
        type="text"
        value={notesStore.selectedNote.title}
        onChange={handleTitleChange}
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