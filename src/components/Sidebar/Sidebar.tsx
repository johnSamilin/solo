import { FC, useState, useEffect, useRef } from "react";
import { observer } from "mobx-react-lite";
import { useStore } from "../../stores/StoreProvider";
import { Editor } from "@tiptap/react";
import { NotebookItem } from "./NotebookItem";
import { SidebarMenu } from "./SidebarMenu";
import { SidebarToggle } from "./SidebarToggle";

import './Sidebar.css';

type SidebarProps = {
  editor: Editor | null;
  onOpenSearch: () => void;
  onOpenTimeline: () => void;
};

export const Sidebar: FC<SidebarProps> = observer(({ editor, onOpenSearch, onOpenTimeline }) => {
  const { notesStore, settingsStore } = useStore();
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const toggleButtonRef = useRef<HTMLButtonElement>(null);

  const rootNotes = notesStore.getRootNotes();

  const handleNoteSelect = (noteId: string) => {
    const note = notesStore.notes.find(n => n.id === noteId);
    if (note) {
      notesStore.setSelectedNote(note);
      notesStore.isEditing = true;
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Handle sidebar clicks when unpinned
      if (
        !settingsStore.settings.sidebarPinned &&
        isSidebarVisible &&
        sidebarRef.current &&
        toggleButtonRef.current &&
        !sidebarRef.current.contains(event.target as Node) &&
        !toggleButtonRef.current.contains(event.target as Node)
      ) {
        setIsSidebarVisible(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSidebarVisible, settingsStore.settings.sidebarPinned]);

  const toggleSidebar = () => {
    setIsSidebarVisible(!isSidebarVisible);
  };

  const sidebarClasses = [
    'sidebar',
    settingsStore.isZenMode ? 'hidden' : '',
    !settingsStore.settings.sidebarPinned ? 'unpinned' : '',
    isSidebarVisible ? 'visible' : ''
  ].filter(Boolean).join(' ');

  return (
    <>
      <SidebarToggle
        onClick={toggleSidebar}
        isZenMode={settingsStore.isZenMode}
        sidebarPinned={settingsStore.settings.sidebarPinned}
      />
      <div ref={sidebarRef} className={sidebarClasses}>
        <SidebarMenu
          editor={editor}
          onOpenSearch={onOpenSearch}
          onOpenTimeline={onOpenTimeline}
        />

        <div className="notebooks-list">
          {rootNotes.map(note => (
            <div
              key={note.id}
              onClick={() => handleNoteSelect(note.id)}
              className={`note-item ${notesStore.selectedNote?.id === note.id ? 'selected' : ''}`}
            >
              <div className="note-item-header">
                <h3 className="note-item-title">{note.title}</h3>
              </div>
            </div>
          ))}
          {notesStore.notebooks
            .filter(notebook => notebook.parentId === null)
            .map(notebook => (
              <NotebookItem
                key={notebook.id}
                notebook={notebook}
                editor={editor}
              />
            ))}
        </div>
      </div>
    </>
  );
});