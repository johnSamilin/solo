import { EditorContent } from "@tiptap/react";
import { FC, useEffect, useRef } from "react";
import { observer } from "mobx-react-lite";
import { Editor as TEditor } from "@tiptap/react";
import { Howl } from 'howler';
import { useStore } from "../../stores/StoreProvider";
import { FAB } from "./FAB";
import { TagsDisplay } from "./TagsDisplay";
import { NoteSettingsModal } from "../Modals/NoteSettingsModal";
import { ArrowLeft, Plus, ArrowRight } from "lucide-react";

import './Editor.css';

// Keys that should not trigger the typewriter sound
const nonCharacterKeys = new Set([
  'Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab',
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  'Home', 'End', 'PageUp', 'PageDown',
  'Insert', 'Delete', 'Backspace', 'Escape',
  'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'
]);

type EditorProps = {
  editor: TEditor | null;
  handleImageUpload: () => void;
  handleLinkInsert: () => void;
  insertTaskList: () => void;
};

export const Editor: FC<EditorProps> = observer(({
  editor,
  handleImageUpload,
  handleLinkInsert,
  insertTaskList,
}) => {
  const { notesStore, settingsStore } = useStore();
  const soundRef = useRef<Howl>();
  const editorContentRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    soundRef.current = new Howl({
      src: [`/${settingsStore.settings.typewriterSound}.mp3`],
      volume: 1,
      rate: 2.0
    });
  }, [settingsStore.settings.typewriterSound]);

  // Scroll to top when note changes
  useEffect(() => {
    if (editorContentRef.current) {
      editorContentRef.current.scrollTop = 0;
    }
  }, [notesStore.selectedNote?.id]);

  useEffect(() => {
    const handleFullscreen = async () => {
      try {
        if (settingsStore.isZenMode) {
          if (document.documentElement.requestFullscreen) {
            await document.documentElement.requestFullscreen();
          }
        } else if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      } catch (error) {
        // Silently handle fullscreen errors
      }
    };

    handleFullscreen();

    function onFSChange() {
      try {
        if (!document.fullscreenElement) {
          settingsStore.turnZenModeOff();
        }
      } catch (error) {
        // Silently handle fullscreen errors
      }
    }

    document.addEventListener('fullscreenchange', onFSChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFSChange);
    };
  }, [settingsStore.isZenMode]);

  useEffect(() => {
    if (!editor) return;

    let lastLength = editor.state.doc.textContent.length;

    const handleKeyUp = (event: KeyboardEvent) => {
      if (settingsStore.settings.editorFontFamily === 'GNU Typewriter') {
        const currentLength = editor.state.doc.textContent.length;
        
        // Only play sound if:
        // 1. Not a special key
        // 2. Content length has increased (character was added)
        // 3. Not a combination with modifier keys
        if (!nonCharacterKeys.has(event.key) && 
            currentLength > lastLength &&
            !event.ctrlKey && 
            !event.altKey && 
            !event.metaKey) {
          soundRef.current?.play();
        }
        
        lastLength = currentLength;
      }
    };

    const element = editor.view.dom;
    element.addEventListener('keyup', handleKeyUp);

    return () => {
      element.removeEventListener('keyup', handleKeyUp);
    };
  }, [editor, settingsStore.settings.editorFontFamily]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (notesStore.selectedNote) {
      notesStore.updateNote(notesStore.selectedNote.id, {
        title: e.target.value,
      });
    }
  };

  const handleMoveNote = (notebookId: string) => {
    if (notesStore.selectedNote) {
      notesStore.updateNote(notesStore.selectedNote.id, {
        notebookId
      });
      settingsStore.setNoteSettingsOpen(false);
    }
  };

  const handleDeleteNote = () => {
    if (notesStore.selectedNote && confirm("Are you sure?")) {
      notesStore.deleteNote(notesStore.selectedNote.id);
      settingsStore.setNoteSettingsOpen(false);
    }
  };

  const handlePrevNote = () => {
    if (!notesStore.selectedNote) return;
    const visibleNotes = notesStore.getVisibleNotes();
    const currentIndex = visibleNotes.findIndex(note => note.id === notesStore.selectedNote?.id);
    if (currentIndex > 0) {
      notesStore.setSelectedNote(visibleNotes[currentIndex - 1]);
    }
  };

  const handleNextNote = () => {
    if (!notesStore.selectedNote) return;
    const visibleNotes = notesStore.getVisibleNotes(settingsStore.censorship.enabled);
    const currentIndex = visibleNotes.findIndex(note => note.id === notesStore.selectedNote?.id);
    if (currentIndex < visibleNotes.length - 1) {
      notesStore.setSelectedNote(visibleNotes[currentIndex + 1]);
    }
  };

  const handleCreateNote = () => {
    if (notesStore.selectedNote) {
      notesStore.createNote(notesStore.selectedNote.notebookId);
    }
  };

  const wordCount = editor?.state.doc.textContent.trim().split(/\s+/).filter(word => word.length > 0).length || 0;
  const paragraphCount = editor?.state.doc.content.content.filter(
    node => node.type.name === 'paragraph' || node.type.name === 'heading'
  ).length || 0;

  if (!notesStore.selectedNote) return null;

  const visibleNotes = notesStore.getVisibleNotes();
  const currentIndex = visibleNotes.findIndex(note => note.id === notesStore.selectedNote?.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < visibleNotes.length - 1;

  return (
    <div className="editor">
      <div className="editor-container">
        <div className="editor-content" ref={editorContentRef}>
          <input
            type="text"
            value={notesStore.selectedNote.title}
            onChange={handleTitleChange}
            className="editor-title"
            placeholder="Note Title"
          />
          {!settingsStore.isZenMode && <p className="note-item-date">
            {new Date(notesStore.selectedNote.createdAt).toLocaleDateString()}
          </p>}
          <EditorContent editor={editor} className="editor-body" />
          <TagsDisplay />
          <div className="note-navigation">
            <button
              onClick={handlePrevNote}
              className="button-icon"
              disabled={!hasPrev}
              title="Previous note"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button
              onClick={handleCreateNote}
              className="button-icon"
              title="Create new note"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              onClick={handleNextNote}
              className="button-icon"
              disabled={!hasNext}
              title="Next note"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          {!settingsStore.isZenMode && <div className="word-count">
            {wordCount}/{paragraphCount}
          </div>}
        </div>
        <FAB
          editor={editor}
          isZenMode={settingsStore.isZenMode}
          toggleZenMode={settingsStore.toggleZenMode}
          isToolbarExpanded={settingsStore.isToolbarExpanded}
          handleImageUpload={handleImageUpload}
          handleLinkInsert={handleLinkInsert}
          insertTaskList={insertTaskList}
          setIsToolbarExpanded={(expanded) => settingsStore.isToolbarExpanded = expanded}
          openNoteSettings={() => settingsStore.setNoteSettingsOpen(true)}
        />
      </div>

      {settingsStore.isNoteSettingsOpen && (
        <NoteSettingsModal
          onClose={() => settingsStore.setNoteSettingsOpen(false)}
          notebooks={notesStore.notebooks}
          currentNotebookId={notesStore.selectedNote.notebookId}
          onMoveNote={handleMoveNote}
          onDeleteNote={handleDeleteNote}
          onToggleCensorship={() => notesStore.toggleNoteCensorship(notesStore?.selectedNote?.id ?? '')}
          isCensored={notesStore.selectedNote.isCensored}
        />
      )}
    </div>
  );
});