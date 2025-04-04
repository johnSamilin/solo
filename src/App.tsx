import { useEffect } from 'react';
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
import { isPlugin } from './config';

const App = observer(() => {
  const { notesStore, settingsStore, tagsStore } = useStore();

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
      if (notesStore.selectedNote && !notesStore.selectedNote.isCensored) {
        const content = editor.getHTML();
        // Only update if content has actually changed
        if (content !== notesStore.selectedNote.content) {
          notesStore.updateNote(notesStore.selectedNote.id, {
            content: content,
          });

          // Check word count and enable zen mode if > 5 words
          const wordCount = editor.state.doc.textContent.trim().split(/\s+/).filter(word => word.length > 0).length;
          if (wordCount > 5 && !settingsStore.isZenMode) {
            settingsStore.toggleZenMode();
          }
        }
      }
    },
  });

  useEffect(() => {
    if (editor) {
      // Handle Ctrl+click on links
      const handleClick = (e: MouseEvent) => {
        if (e.target instanceof HTMLAnchorElement) {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (isPlugin) {
              window.bridge?.openExternal(e.target.href);
            } else {
              window.open(e.target.href, '_blank');
            }
          }
        }
      };

      // Handle right-click context menu for links
      const handleContextMenu = (e: MouseEvent) => {
        if (e.target instanceof HTMLAnchorElement) {
          e.preventDefault();
          const link = e.target;
          const menu = document.createElement('div');
          menu.className = 'link-context-menu';
          menu.innerHTML = `
            <button class="menu-item" data-action="open">Open link</button>
            <button class="menu-item" data-action="edit">Edit link</button>
          `;
          menu.style.position = 'fixed';
          menu.style.left = `${e.clientX}px`;
          menu.style.top = `${e.clientY}px`;
          document.body.appendChild(menu);

          const handleMenuClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target.classList.contains('menu-item')) {
              const action = target.dataset.action;
              if (action === 'open') {
                if (isPlugin) {
                  window.bridge?.openExternal(link.href);
                } else {
                  window.open(link.href, '_blank');
                }
              } else if (action === 'edit') {
                const url = window.prompt('Edit link URL:', link.href);
                if (url) {
                  editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
                }
              }
            }
            menu.remove();
            document.removeEventListener('click', handleMenuClick);
          };

          // Remove menu on any click
          setTimeout(() => {
            document.addEventListener('click', handleMenuClick, { once: true });
          }, 0);
        }
      };

      const editorElement = editor.view.dom;
      editorElement.addEventListener('click', handleClick);
      editorElement.addEventListener('contextmenu', handleContextMenu);

      return () => {
        editorElement.removeEventListener('click', handleClick);
        editorElement.removeEventListener('contextmenu', handleContextMenu);
      };
    }
  }, [editor]);

  // Update editor content when note changes or censorship state changes
  useEffect(() => {
    if (editor && notesStore.selectedNote) {
      if (notesStore.selectedNote.isCensored && settingsStore.isCensorshipEnabled()) {
        editor.commands.setContent('');
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
        }
      } else {
        // Only update if content has changed
        if (content !== editor.getHTML()) {
          editor.commands.setContent(content);
        }
      }
    }
  }, [editor, notesStore.selectedNote, settingsStore.isCensorshipEnabled()]);

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
    root.style.setProperty('--editor-font-family', settingsStore.settings.editorFontFamily);
    root.style.setProperty('--editor-font-size', settingsStore.settings.editorFontSize);
    root.style.setProperty('--editor-line-height', settingsStore.settings.editorLineHeight);
    root.style.setProperty('--title-font-family', settingsStore.settings.titleFontFamily);
    root.style.setProperty('--title-font-size', settingsStore.settings.titleFontSize);
    root.style.setProperty('--sidebar-font-family', settingsStore.settings.sidebarFontFamily);
    root.style.setProperty('--sidebar-font-size', settingsStore.settings.sidebarFontSize);
    root.style.setProperty('--page-margins', settingsStore.settings.pageMargins);
    root.style.setProperty('--paragraph-spacing', settingsStore.settings.paragraphSpacing);
    root.style.setProperty('--drop-cap-size', settingsStore.settings.dropCapSize);
    root.style.setProperty('--drop-cap-line-height', settingsStore.settings.dropCapLineHeight);
    root.style.setProperty('--editor-width', settingsStore.settings.maxEditorWidth);

    // Toggle drop caps
    const editorContent = document.querySelector('.editor-body');
    if (editorContent) {
      if (settingsStore.settings.enableDropCaps) {
        editorContent.classList.add('drop-caps');
      } else {
        editorContent.classList.remove('drop-caps');
      }
    }
  }, [settingsStore.settings]);

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
            handleImageUpload={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = 'image/*';
              input.onchange = async (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) {
                  const url = window.URL.createObjectURL(file);
                  editor?.chain().focus().setImage({ src: url }).run();
                }
              };
              input.click();
            }}
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