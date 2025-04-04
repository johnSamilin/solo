import { ChevronDown, ChevronRight, Lock } from "lucide-react";
import { observer } from "mobx-react-lite";
import { Notebook } from "../../types";
import { useStore } from "../../stores/StoreProvider";
import { Editor } from "@tiptap/react";
import { useRef, useState, useEffect } from "react";
import { EditNotebookModal } from "../Modals/EditNotebookModal";

import './NotebookItem.css';
import './NoteItem.css';

type NotebookItemProps = {
  notebook: Notebook;
  level?: number;
  editor: Editor | null;
};

export const NotebookItem = observer(({ notebook, level = 0, editor }: NotebookItemProps) => {
  const { notesStore, settingsStore } = useStore();
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  const childNotebooks = notesStore.getChildNotebooks(notebook.id);
  const notebookNotes = notesStore.getNotebookNotes(notebook.id);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsContextMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNoteSelect = (noteId: string) => {
    const note = notesStore.notes.find(n => n.id === noteId);
    if (note) {
      if (note.isCensored && settingsStore.isCensorshipEnabled()) {
        // Don't show censored notes when censorship is enabled
        return;
      }
      notesStore.setSelectedNote(note);
      notesStore.isEditing = true;
      editor?.commands.setContent(note.content);
    }
  };

  const handleNotebookClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    notesStore.setFocusedNotebook(notebook.id);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuPosition({ x: e.clientX, y: e.clientY });
    setIsContextMenuOpen(true);
  };

  const handleEditNotebook = () => {
    setIsContextMenuOpen(false);
    setIsEditModalOpen(true);
  };

  const handleUpdateNotebook = (updates: Partial<Notebook>) => {
    const updatedNotebook = { ...notebook, ...updates };
    notesStore.updateNotebook(notebook.id, updatedNotebook);
  };

  const visibleNotes = notebookNotes.filter(note => 
    !note.isCensored || !settingsStore.isCensorshipEnabled()
  );

  const isNotebookCensored = notesStore.isNotebookCensored(notebook.id);

  // Don't render censored notebooks when censorship is enabled
  if (isNotebookCensored && settingsStore.isCensorshipEnabled()) {
    return null;
  }

  return (
    <div className="notebook-item" style={{ paddingLeft: `${level * 1.5}rem` }}>
      <div className={`notebook-header ${notesStore.focusedNotebookId === notebook.id ? 'focused' : ''}`}>
        <button 
          className="notebook-toggle"
          onClick={() => notesStore.toggleNotebook(notebook.id)}
        >
          {notebook.isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
        <span 
          className="notebook-name" 
          onClick={handleNotebookClick}
          onContextMenu={handleContextMenu}
        >
          {notebook.name}
          {isNotebookCensored && <Lock className="h-4 w-4 ml-2" />}
        </span>
      </div>
      {isContextMenuOpen && (
        <div
          ref={menuRef}
          className="notebook-context-menu"
          style={{
            position: 'fixed',
            left: `${menuPosition.x}px`,
            top: `${menuPosition.y}px`
          }}
          role="menu"
        >
          <button
            className="notebook-context-menu-item"
            onClick={handleEditNotebook}
            role="menuitem"
          >
            Edit Notebook
          </button>
        </div>
      )}
      {notebook.isExpanded && (
        <>
          {visibleNotes.map(note => (
            <div
              key={note.id}
              onClick={() => handleNoteSelect(note.id)}
              className={`note-item ${notesStore.selectedNote?.id === note.id ? 'selected' : ''}`}
            >
              <div className="note-item-header">
                <h3 className="note-item-title">{note.title}</h3>
                {note.isCensored && <Lock className="h-4 w-4" />}
              </div>
            </div>
          ))}
          {childNotebooks.map(childNotebook => (
            <NotebookItem
              key={childNotebook.id}
              notebook={childNotebook}
              level={level + 1}
              editor={editor}
            />
          ))}
        </>
      )}
      {isEditModalOpen && (
        <EditNotebookModal
          onClose={() => setIsEditModalOpen(false)}
          notebook={notebook}
          onUpdate={handleUpdateNotebook}
          onToggleCensorship={() => notesStore.toggleNotebookCensorship(notebook.id)}
          isNotebookCensored={isNotebookCensored}
        />
      )}
    </div>
  );
});