import { FC, useEffect } from 'react';
import { X } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useStore } from '../../stores/StoreProvider';
import './ReadingMode.css';

interface ReadingModeProps {
  onClose: () => void;
}

export const ReadingMode: FC<ReadingModeProps> = observer(({ onClose }) => {
  const { notesStore, settingsStore } = useStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Get all visible notes
  const visibleNotes = notesStore.getVisibleNotes(settingsStore.isCensorshipEnabled());

  // Sort notes by notebook hierarchy and creation date
  const sortedNotes = visibleNotes.sort((a, b) => {
    // First sort by notebook hierarchy
    const notebookA = notesStore.notebooks.find(n => n.id === a.notebookId);
    const notebookB = notesStore.notebooks.find(n => n.id === b.notebookId);
    
    if (notebookA && notebookB) {
      if (notebookA.parentId !== notebookB.parentId) {
        return notebookA.parentId ? 1 : -1;
      }
    }
    
    // Then sort by creation date
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  // Combine all notes into a single content
  const combinedContent = sortedNotes.map(note => {
    // Remove any existing h1 tags from the content
    const content = note.content.replace(
      /<h1[^>]*>.*?<\/h1>/g, 
      ''
    );

    return `
      <h1>${note.title}</h1>
      ${content}
    `;
  }).join('<hr class="note-separator" />');

  return (
    <div className="reading-mode">
      <button className="reading-mode-close" onClick={onClose}>
        <X className="h-4 w-4" />
      </button>
      
      <div 
        className="reading-mode-content"
        dangerouslySetInnerHTML={{ __html: combinedContent }}
      />
    </div>
  );
});