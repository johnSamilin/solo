import { EditorContent } from "@tiptap/react";
import { FC, useEffect, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import { Editor as TEditor } from "@tiptap/react";
import { Howl } from 'howler';
import { useStore } from "../../stores/StoreProvider";
import { FAB } from "./FAB";
import { TagsDisplay } from "./TagsDisplay";
import { NoteSettingsModal } from "../Modals/NoteSettingsModal";
import { TagModal } from "../Modals/TagModal";
import { ArrowLeft, Plus, ArrowRight, Maximize2, Trash2 } from "lucide-react";
import { themes } from "../../constants";

import './Editor.css';

const nonCharacterKeys = new Set([
  'Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab',
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  'Home', 'End', 'PageUp', 'PageDown',
  'Insert', 'Delete', 'Backspace', 'Escape',
  'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'
]);

const isTypewriterFont = (font: string) => {
  return ['GNU Typewriter', 'CMTypewriter', 'UMTypewriter'].includes(font);
};

type EditorProps = {
  editor: TEditor | null;
  handleImageUpload: (file: File) => void;
  handleLinkInsert: () => void;
  insertTaskList: () => void;
  handleParagraphTagging: () => void;
};

interface ImageContextMenu {
  x: number;
  y: number;
  target: HTMLImageElement;
}

export const Editor: FC<EditorProps> = observer(({
  editor,
  handleImageUpload,
  handleLinkInsert,
  insertTaskList,
}) => {
  const { notesStore, settingsStore, tagsStore } = useStore();
  const soundRef = useRef<Howl>();
  const editorContentRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<ImageContextMenu | null>(null);
  const [isParagraphTagModalOpen, setIsParagraphTagModalOpen] = useState(false);
  const [selectedParagraphTags, setSelectedParagraphTags] = useState<string[]>([]);
  
  useEffect(() => {
    const currentSettings = notesStore.selectedNote?.theme ? 
      themes[notesStore.selectedNote.theme].settings : 
      settingsStore.settings;

    soundRef.current = new Howl({
      src: [`/${currentSettings.typewriterSound}.mp3`],
      volume: 1,
      rate: 2.0
    });
  }, [settingsStore.settings.typewriterSound, notesStore.selectedNote?.theme]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenu && !e.target?.closest('.image-context-menu')) {
        setContextMenu(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [contextMenu]);

  const handleImageContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    const target = e.target as HTMLElement;
    if (target.tagName === 'IMG') {
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        target: target as HTMLImageElement
      });
    }
  };

  useEffect(() => {
    const editorContent = editorContentRef.current;
    if (editorContent) {
      editorContent.addEventListener('contextmenu', handleImageContextMenu);
      return () => editorContent.removeEventListener('contextmenu', handleImageContextMenu);
    }
  }, []);

  const toggleImageWidth = () => {
    if (contextMenu && editor) {
      editor.chain().focus().toggleImageFullWidth().run();
      setContextMenu(null);
    }
  };

  const deleteImage = async () => {
    if (!contextMenu || !notesStore.selectedNote) return;

    const src = contextMenu.target.src;
    
    if (settingsStore.syncMode === 'server' && settingsStore.server.token && src.startsWith(settingsStore.server.url)) {
      try {
        const imageId = src.split('/').pop();
        const response = await fetch(`${settingsStore.server.url}/api/images/${imageId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${settingsStore.server.token}`,
          },
        });

        if (!response.ok) {
          settingsStore.setToast('Failed to delete image from server', 'error');
          return;
        }
      } catch (error) {
        console.error('Failed to delete image:', error);
        settingsStore.setToast('Failed to delete image from server', 'error');
        return;
      }
    }

    if (editor) {
      editor.chain().focus().setContent(editor.getHTML().replace(contextMenu.target.outerHTML, '')).run();
    }

    setContextMenu(null);
    settingsStore.setToast('Image deleted successfully', 'success');
  };

  useEffect(() => {
    if (editorContentRef.current) {
      editorContentRef.current.scrollTop = 0;
    }
  }, [notesStore.selectedNote?.id]);

  useEffect(() => {
    if (settingsStore.isZenMode) {
      try {
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen();
        }
      } catch (error) {
        // Silently handle fullscreen errors
      }
    } else {
      try {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        }
      } catch (error) {
        // Silently handle fullscreen errors
      }
    }

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
      const currentSettings = notesStore.selectedNote?.theme ? 
        themes[notesStore.selectedNote.theme].settings : 
        settingsStore.settings;

      if (isTypewriterFont(currentSettings.editorFontFamily)) {
        const currentLength = editor.state.doc.textContent.length;
        
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
  }, [editor, settingsStore.settings.editorFontFamily, notesStore.selectedNote?.theme]);

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

  const handleThemeChange = (theme: string) => {
    if (notesStore.selectedNote) {
      notesStore.updateNote(notesStore.selectedNote.id, {
        theme: theme || undefined
      });
    }
  };

  const handlePrevNote = () => {
    if (!notesStore.selectedNote) return;
    const visibleNotes = notesStore.getVisibleNotes(settingsStore.censorship.enabled);
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

  const handleParagraphTagging = () => {
    if (!editor) return;
    setIsParagraphTagModalOpen(true);
    
    // Get current paragraph's tags
    const node = editor.state.selection.$from.node();
    if (node.attrs.tags) {
      setSelectedParagraphTags(node.attrs.tags);
    } else {
      setSelectedParagraphTags([]);
    }
  };

  const handleParagraphTagsApply = () => {
    if (editor) {
      editor.chain().focus().setParagraphTags(selectedParagraphTags).run();
    }
    setIsParagraphTagModalOpen(false);
  };

  const wordCount = editor?.state.doc.textContent.trim().split(/\s+/).filter(word => word.length > 0).length || 0;
  const paragraphCount = editor?.state.doc.content.content.filter(
    node => node.type.name === 'paragraph' || node.type.name === 'heading'
  ).length || 0;

  if (!notesStore.selectedNote) return null;

  const visibleNotes = notesStore.getVisibleNotes(settingsStore.censorship.enabled);
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
          handleParagraphTagging={handleParagraphTagging}
          setIsToolbarExpanded={(expanded) => settingsStore.isToolbarExpanded = expanded}
          openNoteSettings={() => settingsStore.setNoteSettingsOpen(true)}
        />
      </div>

      {contextMenu && (
        <div
          className="image-context-menu"
          style={{
            left: contextMenu.x,
            top: contextMenu.y
          }}
        >
          <button className="menu-item" onClick={toggleImageWidth}>
            <Maximize2 className="h-4 w-4" />
            Toggle Full Width
          </button>
          <button className="menu-item" onClick={deleteImage}>
            <Trash2 className="h-4 w-4" />
            Delete Image
          </button>
        </div>
      )}

      {settingsStore.isNoteSettingsOpen && (
        <NoteSettingsModal
          onClose={() => settingsStore.setNoteSettingsOpen(false)}
          notebooks={notesStore.notebooks}
          currentNotebookId={notesStore.selectedNote.notebookId}
          onMoveNote={handleMoveNote}
          onDeleteNote={handleDeleteNote}
          onToggleCensorship={() => notesStore.toggleNoteCensorship(notesStore?.selectedNote?.id ?? '')}
          isCensored={notesStore.selectedNote.isCensored}
          currentTheme={notesStore.selectedNote.theme || ''}
          onThemeChange={handleThemeChange}
        />
      )}

      {isParagraphTagModalOpen && (
        <TagModal
          onClose={() => setIsParagraphTagModalOpen(false)}
          selectedTags={selectedParagraphTags}
          onTagsChange={setSelectedParagraphTags}
          onApply={handleParagraphTagsApply}
        />
      )}
    </div>
  );
});