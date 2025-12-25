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
	const [isCreating, setIsCreating] = useState(false);
	const { notesStore, settingsStore } = useStore();

	const availableNotebooks = notesStore.notebooks;

	const getNotebookPath = (notebookId: string): string => {
		const notebook = availableNotebooks.find(n => n.id === notebookId);
		if (!notebook) return '';

		if (notebook.parentId) {
			const parentPath = getNotebookPath(notebook.parentId);
			return parentPath ? `${parentPath} / ${notebook.name}` : notebook.name;
		}
		return notebook.name;
	};

	const handleCreate = async () => {
		setIsCreating(true);
		try {
			await notesStore.createNotebook(newNotebookName, selectedNotebookId || null);
			setNewNotebookName('');
			settingsStore.setToast('Notebook created successfully', 'success');
			onClose();
		} catch (error) {
			settingsStore.setToast((error as Error).message || 'Failed to create notebook', 'error');
		} finally {
			setIsCreating(false);
		}
	};

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
							<option value="">None (Root Level)</option>
							{availableNotebooks.map(notebook => (
								<option key={notebook.id} value={notebook.id}>
									{getNotebookPath(notebook.id)}
								</option>
							))}
						</select>
					</div>
					<div className="modal-actions">
						<button
							onClick={handleCreate}
							className="button-primary"
							disabled={!newNotebookName.trim() || isCreating}
						>
							{isCreating ? 'Creating...' : 'Create Notebook'}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
});