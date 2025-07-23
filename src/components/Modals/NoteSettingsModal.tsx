import { FC } from 'react';
import { X, Trash2, Lock, Unlock } from 'lucide-react';
import { Notebook } from '../../types';
import { themes } from '../../constants';

import './Modals.css';

type NoteSettingsModalProps = {
  onClose: () => void;
  notebooks: Notebook[];
  currentNotebookId: string;
  onMoveNote: (notebookId: string) => void;
  onDeleteNote: () => void;
  isCensored: boolean | undefined;
  onToggleCensorship: () => void;
  currentTheme: string;
  onThemeChange: (theme: string) => void;
};

export const NoteSettingsModal: FC<NoteSettingsModalProps> = ({
  onClose,
  notebooks,
  currentNotebookId,
  onMoveNote,
  onDeleteNote,
  isCensored,
  onToggleCensorship,
  currentTheme,
  onThemeChange,
}) => {
  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h2>Note Settings</h2>
          <button className="button-icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="modal-content">
          <div className="setting-item">
            <label>Move to Notebook</label>
            <select
              value={currentNotebookId}
              onChange={(e) => onMoveNote(e.target.value)}
              className="notebook-select"
            >
              {notebooks.map(notebook => (
                <option key={notebook.id} value={notebook.id}>
                  {notebook.name}
                </option>
              ))}
            </select>
          </div>
          <div className="setting-item">
            <label>Theme</label>
            <select
              value={currentTheme}
              onChange={(e) => onThemeChange(e.target.value)}
              className="notebook-select"
            >
              <option value="">Use Global Theme</option>
              {Object.entries(themes).map(([key, theme]) => (
                <option key={key} value={key}>
                  {theme.name}
                </option>
              ))}
            </select>
          </div>
          <div className="setting-item">
            <label>Note Censorship</label>
            <button
              onClick={onToggleCensorship}
              className={`button-icon ${isCensored ? 'active' : ''}`}
              title={isCensored ? 'Remove Censorship' : 'Mark as Censored'}
            >
              {isCensored ? (
                <Lock className="h-4 w-4" />
              ) : (
                <Unlock className="h-4 w-4" />
              )}
            </button>
          </div>
          <div className="modal-actions">
            <button
              onClick={onDeleteNote}
              className="button-danger"
            >
              <Trash2 className="h-4 w-4" />
              Delete Note
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};