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
import { buildTagTree } from './utils';
import { useStore } from './stores/StoreProvider';
import { SettingsModal } from './components/Modals/SettingsModal/SettingsModal';
import { NewNotebookModal } from './components/Modals/NewNoteBookModal';
import { TagModal } from './components/Modals/TagModal';
import { Sidebar } from './components/Sidebar/Sidebar';
import { Editor } from './components/Editor/Editor';
import { Toast } from './components/Toast/Toast';
import { generateUniqueId } from './utils';
import { TagNode } from './types';
import { themes } from './constants';

const App = observer(() => {
  const { notesStore, settingsStore, tagsStore } = useStore();
  const [initialContent, setInitialContent] = useState('');
  const [autoZenDisabled, setAutoZenDisabled] = useState(false);

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
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          rel: 'noopener noreferrer',
          class: 'text-blue-600 hover:text-blue-800 underline cursor-pointer',
        },
        onModifyLink: (link) => {
          const url = window.prompt('Edit link URL:', link);
          return url;
        },
      }),
      Censored,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
    ],
    content: '',
    onUpdate: ({ editor }) => {
      if (notesStore.selectedNote) {
        const content = editor.getHTML();
        // Only update if content has actually changed
        if (content !== notesStore.selectedNote.content) {
          notesStore.updateNote(notesStore.selectedNote.id, {
            content: content,
          });

          // Check word count since note was opened
          const currentContent = editor.state.doc.textContent.trim();
          const initialWords = initialContent.trim().split(/\s+/).filter(word => word.length > 0).length;
          const currentWords = currentContent.split(/\s+/).filter(word => word.length > 0).length;
          const newWords = currentWords - initialWords;

          if (newWords > 5 && !settingsStore.isZenMode && !autoZenDisabled) {
            settingsStore.toggleZenMode();
          }
        }
      }
    },
  });

  useEffect(() => {
    if (editor && notesStore.selectedNote) {
      if (notesStore.selectedNote.isCensored && settingsStore.isCensorshipEnabled()) {
        editor.commands.setContent('');
        setInitialContent('');
        return;
      }

      const content = notesStore.selectedNote.content;
      if (settingsStore.isCensorshipEnabled()) {
        // Remove censored content
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = content;
        const censoredElements = tempDiv.querySelectorAll('span[data-censored]');
        censoredElements.forEach(el => el.textContent = '');
        
        // Only update if content has changed
        if (tempDiv.innerHTML !== editor.getHTML()) {
          editor.commands.setContent(tempDiv.innerHTML);
          setInitialContent(tempDiv.textContent || '');
        }
      } else {
        // Only update if content has changed
        if (content !== editor.getHTML()) {
          editor.commands.setContent(content);
          setInitialContent(editor.state.doc.textContent);
        }
      }
      // Reset auto zen mode when switching notes
      setAutoZenDisabled(false);
    }
  }, [editor, notesStore.selectedNote, settingsStore.isCensorshipEnabled()]);

  // Watch for zen mode changes
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

    // Always apply global settings to sidebar
    root.style.setProperty('--sidebar-font-family', globalSettings.sidebarFontFamily);
    root.style.setProperty('--sidebar-font-size', globalSettings.sidebarFontSize);

    // Apply note-specific or global settings for editor
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

    // Toggle drop caps
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
        } else {
          settingsStore.setToast('Failed to upload image', 'error');
        }
      } catch (error) {
        console.error('Image upload failed:', error);
        settingsStore.setToast('Failed to upload image', 'error');
      }
    } else {
      // Fallback to base64 if no server sync
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          editor?.chain().focus().setImage({ src: reader.result }).run();
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className={`app ${settingsStore.isZenMode ? 'zen-mode' : ''}`}>
      {/* Settings Modal */}
      {settingsStore.isSettingsOpen && (
        <SettingsModal
          onClose={() => settingsStore.setSettingsOpen(false)}
        />
      )}

      {/* New Notebook Modal */}
      {settingsStore.isNewNotebookModalOpen && (
        <NewNotebookModal
          onClose={() => settingsStore.setNewNotebookModalOpen(false)}
        />
      )}

      {/* Tag Modal */}
      {settingsStore.isTagModalOpen && (
        <TagModal
          onClose={() => settingsStore.setTagModalOpen(false)}
        />
      )}

      {/* Toast */}
      <Toast />

      {/* Sidebar */}
      <Sidebar editor={editor} />

      {/* Main Content */}
      <div className="main-content">
        {notesStore.selectedNote ? (
          <Editor
            editor={editor}
            handleImageUpload={handleImageUpload}
            handleLinkInsert={() => {
              const url = window.prompt('Enter the URL:');
              if (url) {
                editor?.chain().focus().toggleLink({ href: url }).run();
              }
            }}
            insertTaskList={() => {
              editor?.chain()
                .focus()
                .toggleTaskList()
                .run();
            }}
          />
        ) : (
          <div className="empty-state">
            <p>Select a note or create a new one</p>
          </div>
        )}
      </div>
    </div>
  );
});

export default App;