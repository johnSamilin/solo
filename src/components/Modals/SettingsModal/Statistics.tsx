import { FC } from "react";
import { observer } from "mobx-react-lite";
import { useStore } from "../../../stores/StoreProvider";
import { FileText, Book, Type, AlertCircle } from "lucide-react";

export const Statistics: FC = observer(() => {
  const { notesStore } = useStore();

  const stats = notesStore.getStatistics();

  return (
    <div className="settings-group">
      <h3>Statistics</h3>
      <div style={{ display: 'grid', gap: '1rem' }}>
        <div className="stat-item" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          padding: '1rem',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          border: '1px solid #e9ecef'
        }}>
          <Book className="h-5 w-5" style={{ color: '#007bff' }} />
          <div>
            <div style={{ fontSize: '0.875rem', color: '#6c757d' }}>Notebooks</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.notebookCount}</div>
          </div>
        </div>

        <div className="stat-item" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          padding: '1rem',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          border: '1px solid #e9ecef'
        }}>
          <FileText className="h-5 w-5" style={{ color: '#28a745' }} />
          <div>
            <div style={{ fontSize: '0.875rem', color: '#6c757d' }}>Notes</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.noteCount}</div>
          </div>
        </div>

        <div className="stat-item" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          padding: '1rem',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          border: '1px solid #e9ecef'
        }}>
          <Type className="h-5 w-5" style={{ color: '#6f42c1' }} />
          <div>
            <div style={{ fontSize: '0.875rem', color: '#6c757d' }}>Total Words</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
              {stats.totalWords.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="stat-item" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          padding: '1rem',
          backgroundColor: stats.emptyNoteCount > 0 ? '#fff3cd' : '#f8f9fa',
          borderRadius: '8px',
          border: `1px solid ${stats.emptyNoteCount > 0 ? '#ffc107' : '#e9ecef'}`
        }}>
          <AlertCircle className="h-5 w-5" style={{ color: '#dc3545' }} />
          <div>
            <div style={{ fontSize: '0.875rem', color: '#6c757d' }}>Empty Notes</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: stats.emptyNoteCount > 0 ? '#dc3545' : 'inherit' }}>
              {stats.emptyNoteCount}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
