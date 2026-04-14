import { FC, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Editor as TEditor } from "@tiptap/react";
import { useStore } from "../../stores/StoreProvider";
import { FAB } from "./FAB";
import { NoteSettingsModal } from "../Modals/NoteSettingsModal";
import { TextRecognitionModal } from "../Modals/TextRecognitionModal";
import { DateEditDialog } from "./DateEditDialog";
import { ImageContextMenu } from "./ImageContextMenu";
import { AnnotatedLayout } from "./AnnotatedLayout";
import { StandardLayout } from "./StandardLayout";
import { useTypewriterSound } from "./hooks/useTypewriterSound";
import { useImageHandling } from "./hooks/useImageHandling";
import { useSpeechRecognition } from "./hooks/useSpeechRecognition";
import { useZenMode } from "./hooks/useZenMode";
import { themes } from "../../constants";
import { PdfViewer } from "../PdfViewer/PdfViewer";

import './Editor.css';

type EditorProps = {
  editor: TEditor | null;
  handleImageUpload: (file: File) => void;
  handleImageClick: () => void;
  handleLinkInsert: () => void;
  insertTaskList: () => void;
  handleParagraphTagging: () => void;
  handleCutIn: () => void;
};

export const Editor: FC<EditorProps> = observer(({
  editor,
  handleImageUpload,
  handleImageClick,
  handleLinkInsert,
  insertTaskList,
  handleParagraphTagging,
  handleCutIn,
}) => {
  const { notesStore, settingsStore } = useStore();
  const [isOcrModalOpen, setIsOcrModalOpen] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string>('');
  const [isDateDialogOpen, setIsDateDialogOpen] = useState(false);

  // Custom hooks for functionality
  useTypewriterSound(editor);
  useZenMode();
  
  const {
    contextMenu,
    annotationImages,
    editorContentRef,
    toggleImageWidth,
    deleteImage,
  } = useImageHandling(editor);

  const {
    isDictating,
    dictationLang,
    handleDictation,
    toggleDictationLanguage
  } = useSpeechRecognition(editor);

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

  const handleCreateNote = async () => {
    if (notesStore.selectedNote) {
      try {
        await notesStore.createNote(notesStore.selectedNote.notebookId);
      } catch (error) {
        settingsStore.setToast((error as Error).message || 'Failed to create note', 'error');
      }
    }
  };

  const handleAnnotatedImageUpload = (file: File) => {
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

  const handleDateChange = (newDate: Date) => {
    if (notesStore.selectedNote) {
      notesStore.updateNote(notesStore.selectedNote.id, {
        createdAt: newDate
      });
    }
    setIsDateDialogOpen(false);
  };

  const recognizeImageText = () => {
    if (contextMenu) {
      setSelectedImageUrl(contextMenu.target.src);
      setIsOcrModalOpen(true);
    }
  };

  if (!notesStore.selectedNote) return null;

  const isPdf = notesStore.selectedNote.fileType === 'pdf';
  const currentTheme = notesStore.selectedNote.theme;
  const isAnnotatedLayout = currentTheme === 'annotated';

  if (isPdf) {
    return (
      <div className="editor" ref={editorContentRef}>
        <PdfViewer base64Data={notesStore.selectedNote.content} />

        {settingsStore.isNoteSettingsOpen && (
          <NoteSettingsModal
            onClose={() => settingsStore.setNoteSettingsOpen(false)}
            notebooks={notesStore.notebooks}
            currentNotebookId={notesStore.selectedNote.notebookId}
            onMoveNote={handleMoveNote}
            onDeleteNote={handleDeleteNote}
            currentTheme={notesStore.selectedNote.theme || ''}
            onThemeChange={handleThemeChange}
          />
        )}

        {isDateDialogOpen && notesStore.selectedNote && (
          <DateEditDialog
            currentDate={notesStore.selectedNote.createdAt}
            onDateChange={handleDateChange}
            onClose={() => setIsDateDialogOpen(false)}
          />
        )}

        <button
          className="pdf-settings-button"
          onClick={() => settingsStore.setNoteSettingsOpen(true)}
          title="Note settings"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6m9-9h-6m-6 0H3m15.364-6.364l-4.243 4.243M8.879 15.121l-4.243 4.243m0-12.728l4.243 4.243m6.364 6.364l4.243 4.243"/></svg>
        </button>
      </div>
    );
  }

  return (
    <>
      <div className={`editor ${isAnnotatedLayout ? 'annotated' : ''}`} ref={editorContentRef}>
        <div id="note-editor-content" className="editor-container">
          {isAnnotatedLayout ? (
            <AnnotatedLayout
              editor={editor}
              annotationImages={annotationImages}
              onImageClick={handleAnnotatedImageClick}
              onDateClick={() => setIsDateDialogOpen(true)}
              onCreateNote={handleCreateNote}
            />
          ) : (
            <StandardLayout
              editor={editor}
              isZenMode={settingsStore.isZenMode}
              isDictating={isDictating}
              dictationLang={dictationLang}
              onDateClick={() => setIsDateDialogOpen(true)}
              onCreateNote={handleCreateNote}
              onToggleLanguage={toggleDictationLanguage}
            />
          )}
        </div>

        <FAB
          editor={editor}
          isZenMode={settingsStore.isZenMode}
          toggleZenMode={settingsStore.toggleZenMode}
          isToolbarExpanded={settingsStore.isToolbarExpanded}
          handleImageClick={handleImageClick}
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
          <ImageContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onToggleWidth={toggleImageWidth}
            onRecognizeText={recognizeImageText}
            onDelete={deleteImage}
          />
        )}

        {settingsStore.isNoteSettingsOpen && (
          <NoteSettingsModal
            onClose={() => settingsStore.setNoteSettingsOpen(false)}
            notebooks={notesStore.notebooks}
            currentNotebookId={notesStore.selectedNote.notebookId}
            onMoveNote={handleMoveNote}
            onDeleteNote={handleDeleteNote}
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