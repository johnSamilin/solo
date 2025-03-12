import { ChevronDown, ChevronRight, Folder } from "lucide-react";
import { Notebook, Note } from "../types";

export function NotebookItem({ notebook, notebooks, notes, level = 0, onSelect, selectedNote, onToggle }: {
	notebook: Notebook;
	notebooks: Notebook[];
	notes: Note[];
	level?: number;
	onSelect: (note: Note) => void;
	selectedNote: Note | null;
	onToggle: (notebookId: string) => void;
}) {
	const childNotebooks = notebooks.filter(n => n.parentId === notebook.id);
	const notebookNotes = notes.filter(n => n.notebookId === notebook.id);

	return (
		<div className="notebook-item" style={{ paddingLeft: `${level * 1.5}rem` }}>
			<div className="notebook-header">
				<button 
					className="notebook-toggle"
					onClick={() => onToggle(notebook.id)}
				>
					{notebook.isExpanded ? (
						<ChevronDown className="h-4 w-4" />
					) : (
						<ChevronRight className="h-4 w-4" />
					)}
				</button>
				<Folder className="h-4 w-4" />
				<span className="notebook-name">{notebook.name}</span>
			</div>
			{notebook.isExpanded && (
				<>
					{notebookNotes.map(note => (
						<div
							key={note.id}
							onClick={() => onSelect(note)}
							className={`note-item ${selectedNote?.id === note.id ? 'selected' : ''}`}
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
							notebooks={notebooks}
							notes={notes}
							level={level + 1}
							onSelect={onSelect}
							selectedNote={selectedNote}
							onToggle={onToggle}
						/>
					))}
				</>
			)}
		</div>
	);
}
