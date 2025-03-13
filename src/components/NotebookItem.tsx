import { ChevronDown, ChevronRight, Folder } from "lucide-react";
import { observer } from "mobx-react-lite";
import { Notebook } from "../types";
import { useStore } from "../stores/StoreProvider";
import { Editor } from "@tiptap/react";

type NotebookItemProps = {
	notebook: Notebook;
	level?: number;
	editor: Editor | null;
};

export const NotebookItem = observer(({ notebook, level = 0, editor }: NotebookItemProps) => {
	const { notesStore } = useStore();

	const childNotebooks = notesStore.getChildNotebooks(notebook.id);
	const notebookNotes = notesStore.getNotebookNotes(notebook.id);

	const handleNoteSelect = (noteId: string) => {
		const note = notesStore.notes.find(n => n.id === noteId);
		if (note) {
			notesStore.setSelectedNote(note);
			notesStore.isEditing = true;
			editor?.commands.setContent(note.content);
		}
	};

	return (
		<div className="notebook-item" style={{ paddingLeft: `${level * 1.5}rem` }}>
			<div className="notebook-header">
				<button 
					className="notebook-toggle"
					onClick={() => notesStore.toggleNotebook(notebook.id)}
				>
					{notebook.isExpanded ? (
						<ChevronDown className="h-4 w-4" />
					) : (
						<ChevronRight className="h-4 w-4" />
					)}
				</button>
				<span className="notebook-name">{notebook.name}</span>
			</div>
			{notebook.isExpanded && (
				<>
					{notebookNotes.map(note => (
						<div
							key={note.id}
							onClick={() => handleNoteSelect(note.id)}
							className={`note-item ${notesStore.selectedNote?.id === note.id ? 'selected' : ''}`}
						>
							<h3 className="note-item-title">{note.title}</h3>
							<p className="note-item-date">
								{new Date(note.createdAt).toLocaleDateString()}
							</p>
						</div>
					))}
					{childNotebooks.map(childNotebook => (
						<NotebookItem
							key={childNotebook.id}
							notebook={childNotebook}
							level={level + 1}
							editor={editor}
						/>
					))}
				</>
			)}
		</div>
	);
});