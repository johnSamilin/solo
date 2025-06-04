import { FC, useEffect, useRef, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useStore } from '../../stores/StoreProvider';
import './ReadingMode.css';

interface ReadingModeProps {
  onClose: () => void;
}

export const ReadingMode: FC<ReadingModeProps> = observer(({ onClose }) => {
  const { notesStore } = useStore();
  const contentRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [fontSize, setFontSize] = useState('1rem');

  useEffect(() => {
    const handleScroll = () => {
      if (!contentRef.current) return;
      const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
      const progress = (scrollTop / (scrollHeight - clientHeight)) * 100;
      setProgress(Math.round(progress));
    };

    contentRef.current?.addEventListener('scroll', handleScroll);
    return () => contentRef.current?.removeEventListener('scroll', handleScroll);
  }, []);

  const handlePrevNote = () => {
    if (!notesStore.selectedNote) return;
    const visibleNotes = notesStore.getVisibleNotes(false);
    const currentIndex = visibleNotes.findIndex(note => note.id === notesStore.selectedNote?.id);
    if (currentIndex > 0) {
      notesStore.setSelectedNote(visibleNotes[currentIndex - 1]);
      if (contentRef.current) {
        contentRef.current.scrollTop = 0;
      }
    }
  };

  const handleNextNote = () => {
    if (!notesStore.selectedNote) return;
    const visibleNotes = notesStore.getVisibleNotes(false);
    const currentIndex = visibleNotes.findIndex(note => note.id === notesStore.selectedNote?.id);
    if (currentIndex < visibleNotes.length - 1) {
      notesStore.setSelectedNote(visibleNotes[currentIndex + 1]);
      if (contentRef.current) {
        contentRef.current.scrollTop = 0;
      }
    }
  };

  if (!notesStore.selectedNote) return null;

  return (
    <div className="reading-mode">
      <div className="reading-mode-header">
        <h1 className="reading-mode-title">{notesStore.selectedNote.title}</h1>
        <button className="button-icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </button>
      </div>

      <div 
        ref={contentRef}
        className="reading-mode-content"
        style={{ fontSize }}
        dangerouslySetInnerHTML={{ __html: notesStore.selectedNote.content }}
      />

      <div className="reading-mode-footer">
        <div className="reading-mode-progress">
          {progress}% read
        </div>
        <div className="reading-mode-controls">
          <select 
            value={fontSize}
            onChange={(e) => setFontSize(e.target.value)}
            title="Font size"
          >
            <option value="0.875rem">Small</option>
            <option value="1rem">Medium</option>
            <option value="1.125rem">Large</option>
            <option value="1.25rem">Extra Large</option>
          </select>
          <button
            className="button-icon"
            onClick={handlePrevNote}
            disabled={!notesStore.selectedNote}
            title="Previous note"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            className="button-icon"
            onClick={handleNextNote}
            disabled={!notesStore.selectedNote}
            title="Next note"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
});