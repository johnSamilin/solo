import { X } from "lucide-react";
import { observer } from "mobx-react-lite";
import { FC, useState } from "react";
import { useStore } from "../../stores/StoreProvider";

import './Modals.css';
import './NewNoteBookModal.css';

type NewNotebookModalProps = {
	onClose: () => void;
};

export const NewNotebookModal: FC<NewNotebookModalProps> = observer(({ onClose }) => {
	const [newNotebookName, setNewNotebookName] = useState('');
	const [selectedNotebookId, setSelectedNotebookId] = useState('');
	  const { notesStore } = useStore();

	return (
		<div className="modal-overlay">
			<div className="modal">
				<div className="modal-header">
					<h2>New Notebook</h2>
					<button className="button-icon" onClick={() => onClose()}>
						<X className="h-4 w-4" />
					</button>
				</div>
				<div className="modal-content">
					<div className="setting-item">
						<label>Notebook Name</label>
						<input
							type="text"
							value={newNotebookName}
							onChange={(e) => setNewNotebookName(e.target.value)}
							className="notebook-input"
							placeholder="Enter notebook name"
						/>
					</div>
					<div className="setting-item">
						<label>Parent Notebook</label>
						<select
							value={selectedNotebookId}
							onChange={(e) => setSelectedNotebookId(e.target.value)}
							className="notebook-select"
						>
							<option value="">None</option>
							{notesStore.notebooks.map(notebook => (
								<option key={notebook.id} value={notebook.id}>
									{notebook.name}
								</option>
							))}
						</select>
					</div>
					<div className="modal-actions">
						<button
							onClick={() => {
								notesStore.createNotebook(newNotebookName, selectedNotebookId || null);
								setNewNotebookName('');
							}}
							className="button-primary"
							disabled={!newNotebookName.trim()}
						>
							Create Notebook
						</button>
					</div>
				</div>
			</div>
		</div>
	);
});
