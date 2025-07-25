import { useEffect, useState } from 'react';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Heading from '@tiptap/extension-heading';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { observer } from 'mobx-react-lite';
import { Censored } from './extensions/Censored';
import { ParagraphTags } from './extensions/ParagraphTags';
import { FullWidthImage } from './extensions/FullWidthImage';
import { CutIn } from './extensions/CutIn';
import { buildTagTree } from './utils';
import { useStore } from './stores/StoreProvider';
import { SettingsModal } from './components/Modals/SettingsModal/SettingsModal';
import { NewNotebookModal } from './components/Modals/NewNoteBookModal';
import { TagModal } from './components/Modals/TagModal';
import { Sidebar } from './components/Sidebar/Sidebar';
import { Editor } from './components/Editor/Editor';
import { SearchPage } from './components/Search/SearchPage';
import { Toast } from './components/Toast/Toast';
import { generateUniqueId } from './utils';
import { TagNode } from './types';
import { themes } from './constants';
import { Plus } from 'lucide-react';
import { analytics } from './utils/analytics';

const App = observer(() => {
  const { notesStore, settingsStore, tagsStore } = useStore();
  const [initialContent, setInitialContent] = useState('');
  const [autoZenDisabled, setAutoZenDisabled] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

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
      Censored,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      ParagraphTags,
      CutIn,
    ],
    content: '',
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
    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        
        if (settingsStore.syncMode === 'server' && settingsStore.server.token) {
          try {
            const response = await fetch(`${settingsStore.server.url}/api/data`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settingsStore.server.token}`,
              },
              body: JSON.stringify({
                notes: notesStore.notes,
                notebooks: notesStore.notebooks,
              }),
            });

            if (response.ok) {
              settingsStore.setToast('Changes saved to server', 'success');
              analytics.syncCompleted('server');
            } else {
              settingsStore.setToast('Failed to save changes', 'error');
              analytics.syncFailed('server');
            }
          } catch (error) {
            console.error('Sync failed:', error);
            settingsStore.setToast('Failed to save changes', 'error');
            analytics.syncFailed('server');
          }
        } else if (settingsStore.syncMode === 'webdav' && window.bridge?.syncWebDAV) {
          try {
            const success = await window.bridge.syncWebDAV(JSON.stringify(settingsStore.webDAV));
            settingsStore.setToast(
              success ? 'Changes saved to WebDAV' : 'Failed to save changes',
              success ? 'success' : 'error'
            );
            if (success) {
              analytics.syncCompleted('webdav');
            } else {
              analytics.syncFailed('webdav');
            }
          } catch (error) {
            console.error('Sync failed:', error);
            settingsStore.setToast('Failed to save changes', 'error');
            analytics.syncFailed('webdav');
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [settingsStore.syncMode, settingsStore.server, settingsStore.webDAV]);

  useEffect(() => {
    if (editor && notesStore.selectedNote && !notesStore.isLoadingNoteContent) {
      // Load note content if not already loaded
      if (!notesStore.selectedNote.content) {
        notesStore.loadNoteContent(notesStore.selectedNote);
        return; // Don't set content until loading is complete
      }
      
      if (notesStore.selectedNote.isCensored && settingsStore.isCensorshipEnabled()) {
        editor.commands.setContent('');
        setInitialContent('');
        return;
      }

      const content = notesStore.selectedNote.content;
      if (settingsStore.isCensorshipEnabled()) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = content;
        const censoredElements = tempDiv.querySelectorAll('span[data-censored]');
        censoredElements.forEach(el => el.textContent = '');
        
        if (tempDiv.innerHTML !== editor.getHTML()) {
          editor.commands.setContent(tempDiv.innerHTML);
          setInitialContent(tempDiv.textContent || '');
        }
      } else {
        if (content !== editor.getHTML()) {
          // Ensure content is properly parsed with all attributes
          editor.commands.setContent(content, false, { preserveWhitespace: 'full' });
          setInitialContent(editor.state.doc.textContent);
        }
      }
      setAutoZenDisabled(false);
    }
  }, [editor, notesStore.selectedNote, settingsStore.isCensorshipEnabled(), notesStore.isLoadingNoteContent]);

  useEffect(() => {
    if (!settingsStore.isZenMode) {
      setAutoZenDisabled(true);
    }
  }, [settingsStore.isZenMode]);

  useEffect(() => {
    if (settingsStore.isTagModalOpen) {
      const allTags = Array.from(new Set(
        notesStore.notes.flatMap(note => note.tags.map(tag => tag.path))
      )).map(path => ({ id: generateUniqueId(), path }));

      const tree = buildTagTree(allTags);

      const markSelectedTags = (nodes: TagNode[]) => {
        nodes.forEach(node => {
          node.isChecked = notesStore.selectedNote?.tags.some(tag => tag.path.includes(node.name)) || false;
          if (node.children.length > 0) {
            markSelectedTags(node.children);
          }
        });
      };

      markSelectedTags(tree);
      tagsStore.setTagTree(tree);
    }
  }, [settingsStore.isTagModalOpen, notesStore.notes, notesStore.selectedNote]);

  useEffect(() => {
    const root = document.documentElement;
    const globalSettings = settingsStore.settings;
    
    // Apply theme-specific color scheme
    const currentTheme = notesStore.selectedNote?.theme;
    if (currentTheme && themes[currentTheme]) {
      document.documentElement.setAttribute('data-theme', currentTheme);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }

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
    if (settingsStore.syncMode === 'server' && settingsStore.server.token) {
      try {
        const formData = new FormData();
        formData.append('image', file);

        const response = await fetch(`${settingsStore.server.url}/api/upload`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${settingsStore.server.token}`,
          },
          body: formData
        });

        if (response.ok) {
          const { url } = await response.json();
          editor?.chain().focus().setImage({ 
            src: `${settingsStore.server.url}${url}` 
          }).run();
          analytics.imageUploaded();
        } else {
          settingsStore.setToast('Failed to upload image', 'error');
        }
      } catch (error) {
        console.error('Image upload failed:', error);
        settingsStore.setToast('Failed to upload image', 'error');
      }
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          editor?.chain().focus().setImage({ src: reader.result }).run();
          analytics.imageUploaded();
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleParagraphTagging = () => {
    if (!editor) return;

    // Get current paragraph and its tags
    const { selection } = editor.state;
    const { $from } = selection;
    const node = $from.node();
    
    let currentTags = '';
    if (node.type.name === 'paragraph' && node.attrs.tags?.length) {
      currentTags = node.attrs.tags.join(', ');
    }

    const tags = prompt('Enter tags for this paragraph (comma-separated):', currentTags);
    if (tags !== null) { // Check for null to handle cancel button
      // If tags is empty string, remove all tags; otherwise process the input
      const tagArray = tags.trim() === '' ? [] : tags.split(',').map(t => t.trim()).filter(t => t);
      editor.chain().focus().setParagraphTags(tagArray).run();
      
      // Add new paragraph tags to the note's tags collection
      if (notesStore.selectedNote && tagArray.length > 0) {
        const existingTagPaths = notesStore.selectedNote.tags.map(tag => tag.path);
        const newTags = tagArray
          .filter(tagPath => !existingTagPaths.includes(tagPath))
          .map(tagPath => ({
            id: generateUniqueId(),
            path: tagPath
          }));
        
        if (newTags.length > 0) {
          notesStore.updateNote(notesStore.selectedNote.id, {
            tags: [...notesStore.selectedNote.tags, ...newTags]
          });
        }
      }
    }
  };

  const handleCreateNote = () => {
    notesStore.createNote();
    if (editor) {
      editor.commands.setContent('');
    }
  };

  const handleLinkInsert = () => {
    const url = window.prompt('Enter the URL:');
    if (url) {
      editor?.chain().focus().toggleLink({ href: url }).run();
      analytics.linkInserted();
    }
  };

  const insertTaskList = () => {
    editor?.chain()
      .focus()
      .toggleTaskList()
      .run();
    analytics.taskListCreated();
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

      {settingsStore.isTagModalOpen && (
        <TagModal
          onClose={() => settingsStore.setTagModalOpen(false)}
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

      <Sidebar 
        editor={editor} 
        onOpenSearch={() => setIsSearchOpen(true)}
      />

      <div className="main-content">
        {notesStore.selectedNote ? (
          <Editor
            editor={editor}
            handleImageUpload={handleImageUpload}
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
    </div>

  );
});

export default App;