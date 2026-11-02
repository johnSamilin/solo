import { FC } from 'react';
import { ArrowLeft, Plus, ArrowRight } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useStore } from '../../stores/StoreProvider';

interface NoteNavigationProps {
  onCreateNote: () => void;
}

export const NoteNavigation: FC<NoteNavigationProps> = observer(({ onCreateNote }) => {
  const { notesStore } = useStore();

  if (!notesStore.selectedNote) return null;

  const sidebarNotes = notesStore.getSidebarNotes();
  const currentIndex = sidebarNotes.findIndex(note => note.id === notesStore.selectedNote?.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < sidebarNotes.length - 1;

  const handlePrevNote = () => {
    if (hasPrev) {
      notesStore.setSelectedNote(sidebarNotes[currentIndex - 1]);
    }
  };

  const handleNextNote = () => {
    if (hasNext) {
      notesStore.setSelectedNote(sidebarNotes[currentIndex + 1]);
    }
  };

  return (
    <div className="note-navigation" style={{ clear: 'both' }}>
      <button
        onClick={handlePrevNote}
        className="button-icon"
        disabled={!hasPrev}
        title="Previous note"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>
      <button
        onClick={onCreateNote}
        className="button-icon"
        title="Create new note"
      >
        <Plus className="h-4 w-4" />
      </button>
      <button
        onClick={handleNextNote}
        className="button-icon"
        title="Next note"
      >
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
});
