import React, { useEffect } from 'react';
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
import { SettingsModal } from './components/Modals/SettingsModal';
import { NewNotebookModal } from './components/Modals/NewNoteBookModal';
import { TagModal } from './components/Modals/TagModal';
import { Sidebar } from './components/Sidebar';
import { Editor } from './components/Editor/Editor';
import { generateUniqueId } from './utils';

const App = observer(() => {
	const { notesStore, settingsStore, tagsStore } = useStore();

	const editor = useEditor({
		extensions: [
			StarterKit,
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
					class: 'text-blue-600 hover:text-blue-800 underline',
				},
			}),
			Censored,
			TaskList,
			TaskItem.configure({
				nested: true,
			}),
		],
		content: notesStore.selectedNote?.content || '',
		onUpdate: ({ editor }) => {
			if (notesStore.selectedNote) {
				notesStore.updateNote(notesStore.selectedNote.id, {
					content: editor.getHTML(),
				});
			}
		},
	});

	const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (notesStore.selectedNote) {
			notesStore.updateNote(notesStore.selectedNote.id, {
				title: e.target.value,
			});
		}
	};

	const handleImageUpload = () => {
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
	}, [settingsStore.settings]);

	return (
		<div className={`app ${settingsStore.isZenMode ? 'zen-mode' : ''}`}>
			{/* Settings Modal */}
			{settingsStore.isSettingsOpen && (
				<SettingsModal
					onClose={() => settingsStore.setSettingsOpen(false)}
					settings={settingsStore.settings}
					setSettings={settingsStore.updateSettings}
				/>
			)}

			{/* New Notebook Modal */}
			{settingsStore.isNewNotebookModalOpen && (
				<NewNotebookModal
					onClose={() => settingsStore.setNewNotebookModalOpen(false)}
					notebooks={notesStore.notebooks}
					createNewNotebook={notesStore.createNotebook}
				/>
			)}

			{/* Tag Modal */}
			{settingsStore.isTagModalOpen && (
				<TagModal
					onClose={() => settingsStore.setTagModalOpen(false)}
					tagTree={tagsStore.tagTree}
					setTagTree={tagsStore.setTagTree}
					selectedNote={notesStore.selectedNote}
					setSelectedNote={notesStore.setSelectedNote}
					setNotes={(notes) => notesStore.notes = notes}
					notes={notesStore.notes}
					applySelectedTags={() => {
						const getSelectedTags = (nodes: TagNode[], parentPath = '') => {
							return nodes.flatMap(node => {
								const currentPath = parentPath ? `${parentPath}/${node.name}` : node.name;
								const tags = [];

								if (node.isChecked) {
									tags.push(tagsStore.createTag(currentPath));
								}

								if (node.children.length > 0) {
									tags.push(...getSelectedTags(node.children, currentPath));
								}

								return tags;
							});
						};

						if (notesStore.selectedNote) {
							const selectedTags = getSelectedTags(tagsStore.tagTree);
							notesStore.updateNote(notesStore.selectedNote.id, {
								tags: selectedTags
							});
						}
						settingsStore.setTagModalOpen(false);
					}}
				/>
			)}

			{/* Sidebar */}
			<Sidebar editor={editor} />

			{/* Main Content */}
			<div className="main-content">
				{notesStore.selectedNote ? (
					<Editor
						selectedNote={notesStore.selectedNote}
						handleTitleChange={handleTitleChange}
						editor={editor}
						wordCount={editor?.state.doc.textContent.trim().split(/\s+/).filter(word => word.length > 0).length || 0}
						paragraphCount={editor?.state.doc.content.content.filter(
							node => node.type.name === 'paragraph' || node.type.name === 'heading'
						).length || 0}
						removeTagFromNote={(tagId) => {
							if (notesStore.selectedNote) {
								notesStore.removeTagFromNote(notesStore.selectedNote.id, tagId);
							}
						}}
						setIsTagModalOpen={settingsStore.setTagModalOpen}
						setIsSettingsOpen={settingsStore.setSettingsOpen}
						isZenMode={settingsStore.isZenMode}
						toggleZenMode={settingsStore.toggleZenMode}
						isToolbarExpanded={settingsStore.isToolbarExpanded}
						handleImageUpload={handleImageUpload}
						handleLinkInsert={handleLinkInsert}
						insertTaskList={insertTaskList}
						setIsToolbarExpanded={(expanded) => settingsStore.isToolbarExpanded = expanded}
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