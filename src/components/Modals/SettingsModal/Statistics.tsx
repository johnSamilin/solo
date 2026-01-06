import { FC } from "react";
import { observer } from "mobx-react-lite";
import { useStore } from "../../../stores/StoreProvider";
import { FileText, Book, Type, AlertCircle } from "lucide-react";
import "./Statistics.css";

export const Statistics: FC = observer(() => {
  const { notesStore } = useStore();

  const stats = notesStore.getStatistics();

  const numberFormatter = new Intl.NumberFormat(undefined, {
    notation: 'standard',
    maximumFractionDigits: 0
  });

  const compactFormatter = new Intl.NumberFormat(undefined, {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 1
  });

  const formatNumber = (value: number) => {
    if (value >= 10000) {
      return compactFormatter.format(value);
    }
    return numberFormatter.format(value);
  };

  return (
    <div className="settings-group">
      <h3>Statistics</h3>
      <div className="stats-grid">
        <div className="stat-item">
          <Book className="h-5 w-5 stat-icon notebooks" />
          <div>
            <div className="stat-label">Notebooks</div>
            <div className="stat-value">{numberFormatter.format(stats.notebookCount)}</div>
          </div>
        </div>

        <div className="stat-item">
          <FileText className="h-5 w-5 stat-icon notes" />
          <div>
            <div className="stat-label">Notes</div>
            <div className="stat-value">{numberFormatter.format(stats.noteCount)}</div>
          </div>
        </div>

        <div className="stat-item">
          <Type className="h-5 w-5 stat-icon words" />
          <div>
            <div className="stat-label">Total Words</div>
            <div className="stat-value">
              {formatNumber(stats.totalWords)}
            </div>
          </div>
        </div>

        <div className={`stat-item ${stats.emptyNoteCount > 0 ? 'warning' : ''}`}>
          <AlertCircle className="h-5 w-5 stat-icon empty" />
          <div>
            <div className="stat-label">Empty Notes</div>
            <div className={`stat-value ${stats.emptyNoteCount > 0 ? 'warning' : ''}`}>
              {numberFormatter.format(stats.emptyNoteCount)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
