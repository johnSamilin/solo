import { FC, useState } from 'react';
import { X, Lock, Unlock } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { Notebook } from '../../types';

import './Modals.css';

type EditNotebookModalProps = {
  onClose: () => void;
  notebook: Notebook;
  onUpdate: (updates: Partial<Notebook>) => void;
  onToggleCensorship: () => void;
  isNotebookCensored: boolean;
};

export const EditNotebookModal: FC<EditNotebookModalProps> = observer(({
  onClose,
  notebook,
  onUpdate,
  onToggleCensorship,
  isNotebookCensored,
}) => {
  const [name, setName] = useState(notebook.name);

  const handleSubmit = () => {
    if (name.trim()) {
      onUpdate({ name: name.trim() });
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
          <div className="setting-item">
            <label>Notebook Censorship</label>
            <button
              onClick={onToggleCensorship}
              className={`button-icon ${isNotebookCensored ? 'active' : ''}`}
              title={isNotebookCensored ? 'Remove Notebook Censorship' : 'Mark Notebook as Censored'}
            >
              {isNotebookCensored ? (
                <Lock className="h-4 w-4" />
              ) : (
                <Unlock className="h-4 w-4" />
              )}
            </button>
          </div>
          <div className="modal-actions">
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