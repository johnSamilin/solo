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

import './Editor.css';

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

  const currentTheme = notesStore.selectedNote.theme;
  const isAnnotatedLayout = currentTheme === 'annotated';

  return (
    <>
      <div className={`editor ${isAnnotatedLayout ? 'annotated' : ''}`} ref={editorContentRef}>
        <div className="editor-container">
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