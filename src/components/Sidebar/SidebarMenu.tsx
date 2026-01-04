import { FC, useState, useRef, useEffect } from 'react';
import { MoreVertical, Plus, Search, Clock, FolderPlus, Mail, Settings } from 'lucide-react';
import { Editor } from '@tiptap/react';
import { observer } from 'mobx-react-lite';
import { useStore } from '../../stores/StoreProvider';
import { isPlugin } from '../../config';

interface SidebarMenuProps {
  editor: Editor | null;
  onOpenSearch: () => void;
  onOpenTimeline: () => void;
}

export const SidebarMenu: FC<SidebarMenuProps> = observer(({
  editor,
  onOpenSearch,
  onOpenTimeline
}) => {
  const { notesStore, settingsStore } = useStore();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const stats = notesStore.getStatistics();
  const hasEmptyNotes = stats.emptyNoteCount > 0;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        buttonRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCreateNote = async () => {
    try {
      await notesStore.createNote(notesStore.focusedNotebookId ?? undefined);
      if (editor) {
        editor.commands.setContent('');
      }
      setIsMenuOpen(false);
    } catch (error) {
      settingsStore.setToast((error as Error).message || 'Failed to create note', 'error');
    }
  };

  const handleCreateNotebook = () => {
    settingsStore.setNewNotebookModalOpen(true);
    setIsMenuOpen(false);
  };

  const handleOpenSettings = () => {
    settingsStore.setSettingsOpen(true);
    setIsMenuOpen(false);
  };

  const handleAskQuestion = () => {
    window.open('mailto:masteralex@inbox.ru', '_blank');
    setIsMenuOpen(false);
  };


  return (
    <div className="sidebar-header">
      <div className="relative">
        <button
          ref={buttonRef}
          className="sidebar-menu-button"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label="Menu"
          aria-expanded={isMenuOpen}
        >
          <MoreVertical className="h-4 w-4" />
        </button>
        {isMenuOpen && (
          <div
            ref={menuRef}
            className="sidebar-dropdown"
            role="menu"
          >
            <button
              className="sidebar-dropdown-item"
              onClick={handleCreateNote}
              role="menuitem"
            >
              <Plus className="h-4 w-4" />
              New Note
            </button>
            <button
              className="sidebar-dropdown-item"
              onClick={() => {
                onOpenSearch();
                setIsMenuOpen(false);
              }}
              role="menuitem"
            >
              <Search className="h-4 w-4" />
              Search Notes
            </button>
            <button
              className="sidebar-dropdown-item"
              onClick={() => {
                onOpenTimeline();
                setIsMenuOpen(false);
              }}
              role="menuitem"
            >
              <Clock className="h-4 w-4" />
              Timeline View
            </button>
            <button
              className="sidebar-dropdown-item"
              onClick={handleCreateNotebook}
              role="menuitem"
            >
              <FolderPlus className="h-4 w-4" />
              New Notebook
            </button>
            <button
              className="sidebar-dropdown-item"
              onClick={handleAskQuestion}
              role="menuitem"
            >
              <Mail className="h-4 w-4" />
              Ask a question
            </button>
            <button
              className="sidebar-dropdown-item"
              onClick={handleOpenSettings}
              role="menuitem"
              style={{ position: 'relative' }}
            >
              <Settings className="h-4 w-4" />
              Settings
              {hasEmptyNotes && (
                <span style={{
                  position: 'absolute',
                  top: '0.5rem',
                  right: '0.5rem',
                  width: '8px',
                  height: '8px',
                  backgroundColor: '#dc3545',
                  borderRadius: '50%',
                  border: '1px solid white'
                }} />
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
});