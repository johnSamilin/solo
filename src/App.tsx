import React, { useState, useEffect } from 'react';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Heading from '@tiptap/extension-heading';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Tag } from 'lucide-react';
import { Censored } from './extensions/Censored';
import { generateUniqueId, buildTagTree } from './utils';
import { Note, Notebook, TagNode, TypographySettings } from './types';
import { defaultSettings } from './constants';
import { SettingsModal } from './components/Modals/SettingsModal';
import { NewNotebookModal } from './components/Modals/NewNoteBookModal';
import { TagModal } from './components/Modals/TagModal';
import { Sidebar } from './components/Sidebar';
import { Editor } from './components/Editor/Editor';

interface Tag {
	id: string;
	path: string;
}

function App() {
	const [notes, setNotes] = useState<Note[]>([]);
	const [notebooks, setNotebooks] = useState<Notebook[]>([{
		id: 'default',
		name: 'My Notebook',
		parentId: null,
		isExpanded: true
	}]);
	const [selectedNote, setSelectedNote] = useState<Note | null>(null);
	const [isEditing, setIsEditing] = useState(false);
	const [isZenMode, setIsZenMode] = useState(false);
	const [isSettingsOpen, setIsSettingsOpen] = useState(false);
	const [isToolbarExpanded, setIsToolbarExpanded] = useState(false);
	const [isTagModalOpen, setIsTagModalOpen] = useState(false);
	const [settings, setSettings] = useState<TypographySettings>(defaultSettings);
	const [wordCount, setWordCount] = useState(0);
	const [paragraphCount, setParagraphCount] = useState(0);
	const [tagTree, setTagTree] = useState<TagNode[]>([]);
	const [isNewNotebookModalOpen, setIsNewNotebookModalOpen] = useState(false);
	const [selectedNotebookId, setSelectedNotebookId] = useState<string>('default');

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
		content: selectedNote?.content || '',
		onUpdate: ({ editor }) => {
			if (selectedNote) {
				const updatedNote = {
					...selectedNote,
					content: editor.getHTML(),
				};
				setSelectedNote(updatedNote);
				setNotes(notes.map(note =>
					note.id === updatedNote.id ? updatedNote : note
				));

				const text = editor.state.doc.textContent;
				const words = text.trim().split(/\s+/).filter(word => word.length > 0);
				setWordCount(words.length);

				const paragraphs = editor.state.doc.content.content.filter(
					node => node.type.name === 'paragraph' || node.type.name === 'heading'
				);
				setParagraphCount(paragraphs.length);
			}
		},
	});

	const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (selectedNote) {
			const updatedNote = {
				...selectedNote,
				title: e.target.value,
			};
			setSelectedNote(updatedNote);
			setNotes(notes.map(note =>
				note.id === updatedNote.id ? updatedNote : note
			));
		}
	};

	const createNewNote = () => {
		const newNote: Note = {
			id: generateUniqueId(),
			title: 'Untitled Note',
			content: '',
			createdAt: new Date(),
			tags: [],
			notebookId: selectedNotebookId
		};
		setNotes([...notes, newNote]);
		setSelectedNote(newNote);
		setIsEditing(true);
		editor?.commands.setContent('');
		setWordCount(0);
		setParagraphCount(0);
	};

	const createNewNotebook = (newNotebookName: string, parentId: string | null = null) => {
		const newNotebook: Notebook = {
			id: generateUniqueId(),
			name: newNotebookName,
			parentId,
			isExpanded: true
		};
		setNotebooks([...notebooks, newNotebook]);
		setIsNewNotebookModalOpen(false);
	};

	const toggleNotebook = (notebookId: string) => {
		setNotebooks(notebooks.map(notebook =>
			notebook.id === notebookId
				? { ...notebook, isExpanded: !notebook.isExpanded }
				: notebook
		));
	};

	const deleteNote = (noteId: string) => {
		setNotes(notes.filter(note => note.id !== noteId));
		setSelectedNote(null);
		editor?.commands.setContent('');
		setWordCount(0);
		setParagraphCount(0);
	};

	const toggleZenMode = () => {
		setIsZenMode(!isZenMode);
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

	const applySelectedTags = () => {
		if (!selectedNote) return;

		const getSelectedTags = (nodes: TagNode[], parentPath = ''): Tag[] => {
			return nodes.flatMap(node => {
				const currentPath = parentPath ? `${parentPath}/${node.name}` : node.name;
				const tags: Tag[] = [];

				if (node.isChecked) {
					tags.push({
						id: generateUniqueId(),
						path: currentPath
					});
				}

				if (node.children.length > 0) {
					tags.push(...getSelectedTags(node.children, currentPath));
				}

				return tags;
			});
		};

		const selectedTags = getSelectedTags(tagTree);
		const updatedNote = {
			...selectedNote,
			tags: selectedTags
		};

		setSelectedNote(updatedNote);
		setNotes(notes.map(note =>
			note.id === updatedNote.id ? updatedNote : note
		));
		setIsTagModalOpen(false);
	};

	const removeTagFromNote = (tagId: string) => {
		if (selectedNote) {
			const updatedNote = {
				...selectedNote,
				tags: selectedNote.tags.filter(tag => tag.id !== tagId),
			};

			setSelectedNote(updatedNote);
			setNotes(notes.map(note =>
				note.id === updatedNote.id ? updatedNote : note
			));
		}
	};

	useEffect(() => {
		if (isTagModalOpen) {
			const allTags = Array.from(new Set(
				notes.flatMap(note => note.tags.map(tag => tag.path))
			)).map(path => ({ id: generateUniqueId(), path }));

			const tree = buildTagTree(allTags);

			const markSelectedTags = (nodes: TagNode[]) => {
				nodes.forEach(node => {
					node.isChecked = selectedNote?.tags.some(tag => tag.path.includes(node.name)) || false;
					if (node.children.length > 0) {
						markSelectedTags(node.children);
					}
				});
			};

			markSelectedTags(tree);
			setTagTree(tree);
		}
	}, [isTagModalOpen, notes, selectedNote]);

	useEffect(() => {
		const root = document.documentElement;
		root.style.setProperty('--editor-font-family', settings.editorFontFamily);
		root.style.setProperty('--editor-font-size', settings.editorFontSize);
		root.style.setProperty('--editor-line-height', settings.editorLineHeight);
		root.style.setProperty('--title-font-family', settings.titleFontFamily);
		root.style.setProperty('--title-font-size', settings.titleFontSize);
		root.style.setProperty('--sidebar-font-family', settings.sidebarFontFamily);
		root.style.setProperty('--sidebar-font-size', settings.sidebarFontSize);
	}, [settings]);

	return (
		<div className={`app ${isZenMode ? 'zen-mode' : ''}`}>
			{/* Settings Modal */}
			{isSettingsOpen && (
				<SettingsModal
					onClose={() => setIsSettingsOpen(false)}
					settings={settings}
					setSettings={setSettings}
				/>
			)}

			{/* New Notebook Modal */}
			{isNewNotebookModalOpen && (
				<NewNotebookModal
					onClose={() => setIsNewNotebookModalOpen(false)}
					notebooks={notebooks}
					createNewNotebook={createNewNotebook}
				/>
			)}

			{/* Tag Modal */}
			{isTagModalOpen && (
				<TagModal
					onClose={() => setIsTagModalOpen(false)}
					tagTree={tagTree}
					setTagTree={setTagTree}
					selectedNote={selectedNote}
					setSelectedNote={setSelectedNote}
					setNotes={setNotes}
					notes={notes}
					applySelectedTags={applySelectedTags}
				/>
			)}

			{/* Sidebar */}
			<Sidebar
				isZenMode={isZenMode}
				createNewNote={createNewNote}
				setIsNewNotebookModalOpen={setIsNewNotebookModalOpen}
				notebooks={notebooks}
				notes={notes}
				setSelectedNote={setSelectedNote}
				setIsEditing={setIsEditing}
				editor={editor}
				selectedNote={selectedNote}
				toggleNotebook={toggleNotebook}
			/>

			{/* Main Content */}
			<div className="main-content">
				{selectedNote ? (
					<Editor
						selectedNote={selectedNote}
						handleTitleChange={handleTitleChange}
						editor={editor}
						wordCount={wordCount}
						paragraphCount={paragraphCount}
						removeTagFromNote={removeTagFromNote}
						setIsTagModalOpen={setIsTagModalOpen}
						setIsSettingsOpen={setIsSettingsOpen}
						isZenMode={isZenMode}
						toggleZenMode={toggleZenMode}
						isToolbarExpanded={isToolbarExpanded}
						handleImageUpload={handleImageUpload}
						handleLinkInsert={handleLinkInsert}
						insertTaskList={insertTaskList}
						setIsToolbarExpanded={setIsToolbarExpanded}
					/>
				) : (
					<div className="empty-state">
						<p>Select a note or create a new one</p>
					</div>
				)}
			</div>
		</div>
	);
}

export default App;