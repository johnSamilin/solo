import { FC } from 'react';
import { ArrowLeft, Plus, ArrowRight } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useStore } from '../../stores/StoreProvider';

interface NoteNavigationProps {
  onCreateNote: () => void;
}

export const NoteNavigation: FC<NoteNavigationProps> = observer(({ onCreateNote }) => {
  const { notesStore, settingsStore } = useStore();

  if (!notesStore.selectedNote) return null;

  const visibleNotes = notesStore.getVisibleNotes(settingsStore.censorship.enabled);
  const currentIndex = visibleNotes.findIndex(note => note.id === notesStore.selectedNote?.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < visibleNotes.length - 1;

  const handlePrevNote = () => {
    if (hasPrev) {
      notesStore.setSelectedNote(visibleNotes[currentIndex - 1]);
    }
  };

  const handleNextNote = () => {
    if (hasNext) {
      notesStore.setSelectedNote(visibleNotes[currentIndex + 1]);
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