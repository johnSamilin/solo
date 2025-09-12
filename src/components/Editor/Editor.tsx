import { useEffect, useRef, useState } from 'react';
import { EditorContent } from "@tiptap/react";
import { Editor as TEditor } from "@tiptap/react";
import { Howl } from 'howler';
import { observer } from 'mobx-react-lite';
import { useStore } from "../../stores/StoreProvider";
import { FAB } from "./FAB";
import { TagsDisplay } from "./TagsDisplay";
import { NoteSettingsModal } from "../Modals/NoteSettingsModal";
import { TextRecognitionModal } from "../Modals/TextRecognitionModal";
import { ArrowLeft, Plus, ArrowRight, Maximize2, Trash2, ScanText, ImageIcon } from "lucide-react";
import { themes } from "../../constants";
import { analytics } from "../../utils/analytics";
import { DateEditDialog } from "./DateEditDialog";

import './Editor.css';

interface AnnotationImage {
  src: string;
  id: string;
}

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

interface ImageContextMenu {
  x: number;
  y: number;
  target: HTMLImageElement;
}

type EditorProps = {
  editor: TEditor | null;
  handleImageUpload: (file: File) => void;
  handleLinkInsert: () => void;
  insertTaskList: () => void;
  handleParagraphTagging: () => void;
  handleCutIn: () => void;
};

export const Editor: FC<EditorProps> = observer(({
  editor,
  handleImageUpload,
  handleLinkInsert,
  insertTaskList,
  handleParagraphTagging,
  handleCutIn,
}) => {
  const { notesStore, settingsStore } = useStore();
  const soundRef = useRef<Howl>();
  const editorContentRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<ImageContextMenu | null>(null);
  const [isDictating, setIsDictating] = useState(false);
  const [dictationLang, setDictationLang] = useState<'en-US' | 'ru-RU'>('ru-RU');
  const [isOcrModalOpen, setIsOcrModalOpen] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string>('');
  const [isDateDialogOpen, setIsDateDialogOpen] = useState(false);
  const [annotationImages, setAnnotationImages] = useState<AnnotationImage[]>([]);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isLanguageSwitchPending = useRef(false);
  
  useEffect(() => {
    const currentSettings = notesStore.selectedNote?.theme ? 
      themes[notesStore.selectedNote.theme].settings : 
      settingsStore.settings;

    soundRef.current = new Howl({
      src: [`/${currentSettings.typewriterSound}.mp3`],
      volume: 1,
      rate: 2.0
    });
  }, [settingsStore.settings.typewriterSound, notesStore.selectedNote?.theme, settingsStore.settings]);

  // Extract images from note content for annotated layout
  useEffect(() => {
    if (!notesStore.selectedNote?.content) {
      setAnnotationImages([]);
      return;
    }

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = notesStore.selectedNote.content;
    const images = tempDiv.querySelectorAll('img');
    
    const imageList: AnnotationImage[] = Array.from(images).map((img, index) => ({
      src: img.src,
      id: `img-${index}`
    }));
    
    setAnnotationImages(imageList);
  }, [notesStore.selectedNote?.content]);

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

  const handleImageClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'IMG') {
      e.preventDefault();
      e.stopPropagation();
      
      const img = target as HTMLImageElement;
      if (img.requestFullscreen) {
        img.requestFullscreen().catch(err => {
          console.error('Error attempting to enable fullscreen:', err);
        });
      }
    }
  };

  useEffect(() => {
    const editorContent = editorContentRef.current;
    if (editorContent) {
      editorContent.addEventListener('contextmenu', handleImageContextMenu);
      editorContent.addEventListener('click', handleImageClick);
      return () => {
        editorContent.removeEventListener('contextmenu', handleImageContextMenu);
        editorContent.removeEventListener('click', handleImageClick);
      };
    }
  }, []);

  const toggleImageWidth = () => {
    if (contextMenu && editor) {
      editor.chain().focus().toggleImageFullWidth().run();
      setContextMenu(null);
    }
  };

  const recognizeImageText = () => {
    if (contextMenu) {
      setSelectedImageUrl(contextMenu.target.src);
      setIsOcrModalOpen(true);
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
      notesStore.updateNote(notesStore.selectedNote.id, {
        content: editor.getHTML()
      });
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

  const handleAnnotatedImageUpload = (file: File) => {
    // For annotated layout, add image to the images column
    handleImageUpload(file);
  };

  const handleAnnotatedImageClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        handleAnnotatedImageUpload(file);
      }
    };
    input.click();
  };

  const handleDateClick = () => {
    setIsDateDialogOpen(true);
  };

  const handleDateChange = (newDate: Date) => {
    if (notesStore.selectedNote) {
      notesStore.updateNote(notesStore.selectedNote.id, {
        createdAt: newDate
      });
    }
    setIsDateDialogOpen(false);
  };

  const handleDictation = () => {
    if (isDictating) {
      recognitionRef.current?.stop();
      isLanguageSwitchPending.current = false;
      return;
    }

    const recognition = initializeSpeechRecognition();
    if (recognition) {
      recognitionRef.current = recognition;
      recognition.start();
      analytics.dictationUsed();
    }
  };

  const initializeSpeechRecognition = () => {
    if (!('webkitSpeechRecognition' in window)) {
      settingsStore.setToast('Speech recognition is not supported in your browser', 'error');
      return null;
    }

    const SpeechRecognition = window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = dictationLang;

    recognition.onstart = () => {
      setIsDictating(true);
      settingsStore.setToast('Listening...', 'success');
    };

    recognition.onresult = (event) => {
      if (!editor) return;
      console.log(event.results);
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          editor.commands.insertContent(transcript + ' ');
        }
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      settingsStore.setToast('Speech recognition error: ' + event.error, 'error');
      setIsDictating(false);
      isLanguageSwitchPending.current = false;
    };

    recognition.onend = () => {
      setIsDictating(false);
      if (isLanguageSwitchPending.current) {
        isLanguageSwitchPending.current = false;
        const newRecognition = initializeSpeechRecognition();
        if (newRecognition) {
          recognitionRef.current = newRecognition;
          newRecognition.start();
        }
      }
    };

    return recognition;
  };

  const toggleDictationLanguage = () => {
    if (!isDictating) return;

    const newLang = dictationLang === 'en-US' ? 'ru-RU' : 'en-US';
    setDictationLang(newLang);
    isLanguageSwitchPending.current = true;
    recognitionRef.current?.stop();
  };

  const wordCount = editor?.state.doc.textContent.trim().split(/\s+/).filter(word => word.length > 0).length || 0;
  const paragraphCount = editor?.state.doc.content.content.filter(
    node => node.type.name === 'paragraph' || node.type.name === 'heading'
  ).length || 0;

  if (!notesStore.selectedNote) return null;

  const currentTheme = notesStore.selectedNote.theme;
  const isAnnotatedLayout = currentTheme === 'annotated';

  const visibleNotes = notesStore.getVisibleNotes(settingsStore.censorship.enabled);
  const currentIndex = visibleNotes.findIndex(note => note.id === notesStore.selectedNote?.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < visibleNotes.length - 1;

  return (
    <>
      <div className={`editor ${isAnnotatedLayout ? 'annotated' : ''}`}>
        <div className="editor-container">
          {isAnnotatedLayout ? (
            <div className="editor-content" ref={editorContentRef}>
              <div className="images-column">
                <button
                  onClick={handleAnnotatedImageClick}
                  className="add-image-button"
                >
                  <ImageIcon className="h-5 w-5" />
                  Add Image
                </button>
                {annotationImages.map((image) => (
                  <img
                    key={image.id}
                    src={image.src}
                    alt="Annotation"
                    className="annotation-image"
                    onClick={() => {
                      if (image.src.startsWith('http')) {
                        window.open(image.src, '_blank');
                      }
                    }}
                  />
                ))}
              </div>
              <div className="text-column">
                <input
                  type="text"
                  value={notesStore.selectedNote.title}
                  onChange={handleTitleChange}
                  className="editor-title"
                  placeholder="Note Title"
                />
                {!settingsStore.isZenMode && (
                  <p className="note-item-date">
                    <span 
                      className="note-date-clickable"
                      onClick={handleDateClick}
                      title="Click to edit date"
                    >
                      {new Date(notesStore.selectedNote.createdAt).toLocaleDateString()}
                    </span>
                  </p>
                )}
                <EditorContent editor={editor} className="editor-body" />
                <TagsDisplay />
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
                    onClick={handleCreateNote}
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
              </div>
            </div>
          ) : (
            <div className="editor-content" ref={editorContentRef}>
              <input
                type="text"
                value={notesStore.selectedNote.title}
                onChange={handleTitleChange}
                className="editor-title"
                placeholder="Note Title"
              />
              {!settingsStore.isZenMode && <p className="note-item-date">
                <span 
                  className="note-date-clickable"
                  onClick={handleDateClick}
                  title="Click to edit date"
                >
                  {new Date(notesStore.selectedNote.createdAt).toLocaleDateString()}
                </span>
              </p>}
              <EditorContent editor={editor} className="editor-body" />
              <TagsDisplay />
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
                  onClick={handleCreateNote}
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
              {!settingsStore.isZenMode && <div className="word-count">
                {wordCount}/{paragraphCount}
              </div>}
              {isDictating && (
                <button
                  onClick={toggleDictationLanguage}
                  className="language-selector"
                  title={`Current language: ${dictationLang === 'en-US' ? 'English' : 'Russian'}`}
                >
                  {dictationLang === 'en-US' ? '🇺🇸' : '🇷🇺'}
                </button>
              )}
            </div>
          )}
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
          handleDictation={handleDictation}
          isDictating={isDictating}
          handleCutIn={handleCutIn}
        />

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
            <button className="menu-item" onClick={recognizeImageText}>
              <ScanText className="h-4 w-4" />
              Recognise Text
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

        {isOcrModalOpen && (
          <TextRecognitionModal
            onClose={() => setIsOcrModalOpen(false)}
            imageUrl={selectedImageUrl}
          />
        )}

        {isDateDialogOpen && notesStore.selectedNote && (
          <DateEditDialog
            currentDate={notesStore.selectedNote.createdAt}
            onDateChange={handleDateChange}
            onClose={() => setIsDateDialogOpen(false)}
          />
        )}
      </div>
    </>
  );
});