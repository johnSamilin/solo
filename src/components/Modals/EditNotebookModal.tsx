import { FC, useState } from 'react';
import { X } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { Notebook } from '../../types';

import './Modals.css';

type EditNotebookModalProps = {
  onClose: () => void;
  notebook: Notebook;
  onUpdate: (updates: Partial<Notebook>) => void;
  onDelete?: () => void;
};

export const EditNotebookModal: FC<EditNotebookModalProps> = observer(({
  onClose,
  notebook,
  onUpdate,
  onDelete,
}) => {
  const [name, setName] = useState(notebook.name);

  const handleSubmit = () => {
    if (name.trim()) {
      onUpdate({ name: name.trim() });
      onClose();
    }
  };

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete "${notebook.name}" and all its contents?`)) {
      onDelete?.();
      onClose();
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h2>Edit Notebook</h2>
          <button className="button-icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="modal-content">
          <div className="setting-item">
            <label>Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="notebook-input"
              placeholder="Enter notebook name"
            />
          </div>
          <div className="modal-actions">
            {onDelete && (
              <button
                onClick={handleDelete}
                className="button-secondary"
                style={{ backgroundColor: '#dc3545', color: 'white' }}
              >
                Delete Notebook
              </button>
            )}
            <button
              onClick={handleSubmit}
              className="button-primary"
              disabled={!name.trim()}
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});