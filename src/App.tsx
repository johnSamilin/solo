import { useEffect, useState, useRef } from 'react';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Heading from '@tiptap/extension-heading';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { observer } from 'mobx-react-lite';
import { ParagraphTags } from './extensions/ParagraphTags';
import { FullWidthImage } from './extensions/FullWidthImage';
import { CutIn } from './extensions/CutIn';
import { Carousel } from './extensions/Carousel';
import { buildTagTree } from './utils';
import { useStore } from './stores/StoreProvider';
import { SettingsModal } from './components/Modals/SettingsModal/SettingsModal';
import { NewNotebookModal } from './components/Modals/NewNoteBookModal';
import { Sidebar } from './components/Sidebar/Sidebar';
import { Editor } from './components/Editor/Editor';
import { SearchPage } from './components/Search/SearchPage';
import { Timeline } from './components/Timeline/Timeline';
import { Toast } from './components/Toast/Toast';
import { generateUniqueId } from './utils';
import { TagNode } from './types';
import { themes } from './constants';
import { Plus } from 'lucide-react';
import { TagModal } from './components/Modals/TagModal/TagModal';
import { ImageInsertModal } from './components/Modals/ImageInsertModal';

const App = observer(() => {
  const { notesStore, settingsStore, tagsStore } = useStore();
  const [initialContent, setInitialContent] = useState('');
  const [autoZenDisabled, setAutoZenDisabled] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [isParagraphTagModalOpen, setIsParagraphTagModalOpen] = useState(false);
  const [currentParagraphTags, setCurrentParagraphTags] = useState<Tag[]>([]);
  const [isImageInsertModalOpen, setIsImageInsertModalOpen] = useState(false);
  const imageUploadRef = useRef<((file: File) => Promise<void>) | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        text: {
          preserveWhitespace: 'always',
        }
      }),
      Placeholder.configure({
        placeholder: 'Start writing...',
      }),
      Heading.configure({
        levels: [1, 2, 3],
      }),
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
      FullWidthImage.configure({}),
      Link.configure({
        openOnClick: true,
        HTMLAttributes: {
          rel: 'noopener noreferrer',
          class: 'text-blue-600 hover:text-blue-800 underline cursor-pointer',
        },
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      ParagraphTags,
      CutIn,
      Carousel,
    ],
    content: '',
    editorProps: {
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;

        for (const item of Array.from(items)) {
          if (item.type.indexOf('image') === 0) {
            event.preventDefault();
            const file = item.getAsFile();
            if (file && imageUploadRef.current) {
              imageUploadRef.current(file);
            }
            return true;
          }
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      if (notesStore.selectedNote) {
        const content = editor.getHTML();
        if (content !== notesStore.selectedNote.content) {
          notesStore.updateNote(notesStore.selectedNote.id, {
            content: content,
          });

          const currentContent = editor.state.doc.textContent.trim();
          const initialWords = initialContent.trim().split(/\s+/).filter(word => word.length > 0).length;
          const currentWords = currentContent.split(/\s+/).filter(word => word.length > 0).length;
          const newWords = currentWords - initialWords;

          const currentSettings = notesStore.selectedNote?.theme ?
            themes[notesStore.selectedNote.theme].settings :
            settingsStore.settings;

          if (newWords > 5 && !settingsStore.isZenMode && !autoZenDisabled && currentSettings.autoZenMode) {
            settingsStore.toggleZenMode();
          }
        }
      }
    },
  });


  useEffect(() => {
    if (editor && notesStore.selectedNote && !notesStore.isLoadingNoteContent) {
      // Load note content if not already loaded
      if (!notesStore.selectedNote.isLoaded) {
        notesStore.loadNoteContent(notesStore.selectedNote);
        return;
      }

      const content = notesStore.selectedNote.content;
      if (content !== editor.getHTML()) {
        editor.commands.setContent(content);
        setInitialContent(editor.state.doc.textContent);
      }
      setAutoZenDisabled(false);
    }
  }, [editor, notesStore.selectedNote, notesStore.isLoadingNoteContent]);

  useEffect(() => {
    if (!settingsStore.isZenMode) {
      setAutoZenDisabled(true);
    }
  }, [settingsStore.isZenMode]);

  useEffect(() => {
    const root = document.documentElement;
    const globalSettings = settingsStore.settings;

    root.style.setProperty('--sidebar-font-family', globalSettings.sidebarFontFamily);
    root.style.setProperty('--sidebar-font-size', globalSettings.sidebarFontSize);

    const currentSettings = notesStore.selectedNote?.theme ? 
      themes[notesStore.selectedNote.theme].settings : 
      globalSettings;

    root.style.setProperty('--editor-font-family', currentSettings.editorFontFamily);
    root.style.setProperty('--editor-font-size', currentSettings.editorFontSize);
    root.style.setProperty('--editor-line-height', currentSettings.editorLineHeight);
    root.style.setProperty('--title-font-family', currentSettings.titleFontFamily);
    root.style.setProperty('--title-font-size', currentSettings.titleFontSize);
    root.style.setProperty('--page-margins', currentSettings.pageMargins);
    root.style.setProperty('--paragraph-spacing', currentSettings.paragraphSpacing);
    root.style.setProperty('--drop-cap-size', currentSettings.dropCapSize);
    root.style.setProperty('--drop-cap-line-height', currentSettings.dropCapLineHeight);
    root.style.setProperty('--editor-width', currentSettings.maxEditorWidth);

    const editorContent = document.querySelector('.editor-body');
    if (editorContent) {
      if (currentSettings.enableDropCaps) {
        editorContent.classList.add('drop-caps');
      } else {
        editorContent.classList.remove('drop-caps');
      }
    }
  }, [settingsStore.settings, notesStore.selectedNote?.theme]);

  const handleImageUpload = async (file: File) => {
    if (window.electronAPI) {
      try {
        const reader = new FileReader();
        reader.onload = async () => {
          if (typeof reader.result === 'string') {
            const result = await window.electronAPI.uploadImage(reader.result, file.name);
            if (result.success && result.url) {
              editor?.chain().focus().setImage({ src: result.url }).run();
            } else {
              settingsStore.setToast(result.error || 'Failed to upload image', 'error');
            }
          }
        };
        reader.readAsDataURL(file);
      } catch (error) {
        console.error('Image upload failed:', error);
        settingsStore.setToast('Failed to upload image', 'error');
      }
    }
  };

  imageUploadRef.current = handleImageUpload;

  const handleImageInsertClick = () => {
    setIsImageInsertModalOpen(true);
  };

  const handleInsertCarousel = (images: string[]) => {
    if (editor && images.length > 0) {
      editor.chain().focus().setCarousel(images).run();
    }
  };

  const handleParagraphTagging = () => {
    if (!editor) return;

    const { selection } = editor.state;
    const { $from } = selection;
    const node = $from.node();
    
    let currentTags: Tag[] = [];
    if (node.type.name === 'paragraph' && node.attrs.tags?.length) {
      currentTags = node.attrs.tags.map((tagPath: string) => ({
        id: generateUniqueId(),
        path: tagPath
      }));
    }

    setCurrentParagraphTags(currentTags);
    setIsParagraphTagModalOpen(true);
  };

  const handleParagraphTagsApply = (selectedTags: Tag[]) => {
    if (!editor) return;
    
    const tagPaths = selectedTags.map(tag => tag.path);
    editor.chain().focus().setParagraphTags(tagPaths).run();
    setIsParagraphTagModalOpen(false);
  };

  const handleCreateNote = async () => {
    try {
      await notesStore.createNote();
      if (editor) {
        editor.commands.setContent('');
      }
    } catch (error) {
      settingsStore.setToast((error as Error).message || 'Failed to create note', 'error');
    }
  };

  const handleLinkInsert = () => {
    const url = window.prompt('Enter the URL:');
    if (url) {
      editor?.chain().focus().toggleLink({ href: url }).run();
    }
  };

  const insertTaskList = () => {
    editor?.chain()
      .focus()
      .toggleTaskList()
      .run();
  };

  const handleCutIn = () => {
    if (!editor) return;
    
    const { from, to } = editor.state.selection;
    const position = confirm('Position on right side?') ? 'right' : 'left';
    
    const content = editor.state.doc.textBetween(from, to);
    if (content) {
      editor.chain()
        .focus()
        .deleteRange({ from, to })
        .setCutIn({ text: content, position })
        .run();
    }
  };

  return (
    <div className={`app ${settingsStore.isZenMode ? 'zen-mode' : ''}`}>
      {settingsStore.isSettingsOpen && (
        <SettingsModal
          onClose={() => settingsStore.setSettingsOpen(false)}
        />
      )}

      {settingsStore.isNewNotebookModalOpen && (
        <NewNotebookModal
          onClose={() => settingsStore.setNewNotebookModalOpen(false)}
        />
      )}

      <Toast />

      {isSearchOpen && (
        <SearchPage
          onClose={() => setIsSearchOpen(false)}
          onNoteSelect={(note) => {
            notesStore.setSelectedNote(note);
            setIsSearchOpen(false);
          }}
        />
      )}

      {isTimelineOpen && (
        <Timeline
          onClose={() => setIsTimelineOpen(false)}
          onNoteSelect={(note) => {
            notesStore.setSelectedNote(note);
            setIsTimelineOpen(false);
          }}
        />
      )}

      <Sidebar 
        editor={editor} 
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenTimeline={() => setIsTimelineOpen(true)}
      />

      <div className="main-content">
        {window.electronAPI && !settingsStore.dataFolder ? (
          <div className="empty-state">
            <div className="empty-state-content">
              <p className="empty-state-text">No data folder selected</p>
              <p style={{ marginTop: '1rem', color: '#666', textAlign: 'center' }}>
                To start working, please select a folder where your notes will be stored.
                Go to Settings → Data and choose a folder on your computer.
              </p>
              <div className="empty-state-buttons">
                <button
                  onClick={() => {
                    settingsStore.setSettingsOpen(true);
                    settingsStore.setActiveSettingsTab('data');
                  }}
                  className="button-primary"
                >
                  Open Settings
                </button>
              </div>
            </div>
          </div>
        ) : notesStore.selectedNote ? (
          <Editor
            editor={editor}
            handleImageUpload={handleImageUpload}
            handleImageClick={handleImageInsertClick}
            handleLinkInsert={handleLinkInsert}
            insertTaskList={insertTaskList}
            handleParagraphTagging={handleParagraphTagging}
            handleCutIn={handleCutIn}
          />
        ) : (
          <div className="empty-state">
            <div className="empty-state-content">
              <p className="empty-state-text">Select a note or create a new one</p>
              <div className="empty-state-buttons">
                <button onClick={handleCreateNote} className="button-primary">
                  <Plus className="h-4 w-4" />
                  Create Note
                </button>
                <a href="/about" target="_blank" className="button-primary">
                  Learn More
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
      {notesStore.isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner">
            <p>Loading your notes...</p>
          </div>
        </div>
      )}

      {isParagraphTagModalOpen && (
        <TagModal
          isOpen={isParagraphTagModalOpen}
          onClose={() => setIsParagraphTagModalOpen(false)}
          appliedTags={currentParagraphTags}
          onApply={handleParagraphTagsApply}
          title="Add Tags to Paragraph"
        />
      )}

      {isImageInsertModalOpen && (
        <ImageInsertModal
          onClose={() => setIsImageInsertModalOpen(false)}
          onInsertFile={handleImageUpload}
          onInsertCarousel={handleInsertCarousel}
        />
      )}
    </div>
  );
});

export default App;