import { FC, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useStore } from '../../stores/StoreProvider';
import './ReadingMode.css';

interface ReadingModeProps {
  onClose: () => void;
}

export const ReadingMode: FC<ReadingModeProps> = observer(({ onClose }) => {
  const { notesStore } = useStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        handlePrevNote();
      } else if (e.key === 'ArrowRight') {
        handleNextNote();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handlePrevNote = () => {
    if (!notesStore.selectedNote) return;
    const visibleNotes = notesStore.getVisibleNotes(false);
    const currentIndex = visibleNotes.findIndex(note => note.id === notesStore.selectedNote?.id);
    if (currentIndex > 0) {
      notesStore.setSelectedNote(visibleNotes[currentIndex - 1]);
    }
  };

  const handleNextNote = () => {
    if (!notesStore.selectedNote) return;
    const visibleNotes = notesStore.getVisibleNotes(false);
    const currentIndex = visibleNotes.findIndex(note => note.id === notesStore.selectedNote?.id);
    if (currentIndex < visibleNotes.length - 1) {
      notesStore.setSelectedNote(visibleNotes[currentIndex + 1]);
    }
  };

  if (!notesStore.selectedNote) return null;

  // Transform the content to ensure note title is an H1
  const content = notesStore.selectedNote.content.replace(
    /<h1[^>]*>.*?<\/h1>/g, 
    ''
  );

  const transformedContent = `
    <h1>${notesStore.selectedNote.title}</h1>
    ${content}
  `;

  return (
    <div className="reading-mode">
      <button className="reading-mode-close" onClick={onClose}>
        <X className="h-4 w-4" />
      </button>
      
      <div 
        className="reading-mode-content"
        dangerouslySetInnerHTML={{ __html: transformedContent }}
      />

      <div className="reading-mode-nav">
        <button
          onClick={handlePrevNote}
          disabled={!notesStore.selectedNote}
          title="Previous note (←)"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={handleNextNote}
          disabled={!notesStore.selectedNote}
          title="Next note (→)"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
});