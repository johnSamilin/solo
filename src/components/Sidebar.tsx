import { Book, Plus, FolderPlus } from "lucide-react";
import { FC } from "react";
import { NotebookItem } from "./NotebookItem";
import { Editor } from "@tiptap/react";
import { Notebook, Note } from "../types";

type SidebarProps = {
	isZenMode: boolean;
	createNewNote: () => void
	setIsNewNotebookModalOpen: (isOpen: boolean) => void
	notebooks: Notebook[]
	notes: Note[]
	setSelectedNote: (note: Note) => void
	setIsEditing: (isEditing: boolean) => void
	editor: Editor | null
	selectedNote: Note | null
	toggleNotebook: (notebookId: string) => void
};

export const Sidebar: FC<SidebarProps> = ({
	isZenMode,
	createNewNote,
	setIsNewNotebookModalOpen,
	notebooks,
	notes,
	setSelectedNote,
	setIsEditing,
	editor,
	selectedNote,
	toggleNotebook
}) => {
	return (
		<div className={`sidebar ${isZenMode ? 'hidden' : ''}`}>
			<div className="sidebar-header">
				<Book className="h-5 w-5" />
				<h1 className="sidebar-title">Notes</h1>
			</div>

			<div className="sidebar-actions">
				<button className="new-note-button" onClick={createNewNote}>
					<Plus className="h-4 w-4" />
					New Note
				</button>
				<button className="new-notebook-button" onClick={() => setIsNewNotebookModalOpen(true)}>
					<FolderPlus className="h-4 w-4" />
					New Notebook
				</button>
			</div>

			<div className="notebooks-list">
				{notebooks
					.filter(notebook => notebook.parentId === null)
					.map(notebook => (
						<NotebookItem
							key={notebook.id}
							notebook={notebook}
							notebooks={notebooks}
							notes={notes}
							onSelect={(note) => {
								setSelectedNote(note);
								setIsEditing(true);
								editor?.commands.setContent(note.content);
							}}
							selectedNote={selectedNote}
							onToggle={toggleNotebook}
						/>
					))}
			</div>
		</div>
	);
};
