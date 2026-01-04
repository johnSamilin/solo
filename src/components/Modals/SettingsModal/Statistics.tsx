import { FC } from "react";
import { observer } from "mobx-react-lite";
import { useStore } from "../../../stores/StoreProvider";
import { FileText, Book, Type, AlertCircle } from "lucide-react";
import "./Statistics.css";

export const Statistics: FC = observer(() => {
  const { notesStore } = useStore();

  const stats = notesStore.getStatistics();

  return (
    <div className="settings-group">
      <h3>Statistics</h3>
      <div className="stats-grid">
        <div className="stat-item">
          <Book className="h-5 w-5 stat-icon notebooks" />
          <div>
            <div className="stat-label">Notebooks</div>
            <div className="stat-value">{stats.notebookCount}</div>
          </div>
        </div>

        <div className="stat-item">
          <FileText className="h-5 w-5 stat-icon notes" />
          <div>
            <div className="stat-label">Notes</div>
            <div className="stat-value">{stats.noteCount}</div>
          </div>
        </div>

        <div className="stat-item">
          <Type className="h-5 w-5 stat-icon words" />
          <div>
            <div className="stat-label">Total Words</div>
            <div className="stat-value">
              {stats.totalWords.toLocaleString()}
            </div>
          </div>
        </div>

        <div className={`stat-item ${stats.emptyNoteCount > 0 ? 'warning' : ''}`}>
          <AlertCircle className="h-5 w-5 stat-icon empty" />
          <div>
            <div className="stat-label">Empty Notes</div>
            <div className={`stat-value ${stats.emptyNoteCount > 0 ? 'warning' : ''}`}>
              {stats.emptyNoteCount}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
