/**
 * SyncConflictPanel — modal for viewing and resolving sync conflicts.
 *
 * Shows files that were modified on both devices.
 * Allows choosing resolution strategy: local_wins or remote_wins.
 */

import { FC, useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '../../stores/StoreProvider';
import {
  X,
  AlertTriangle,
  FileText,
  CheckCircle,
  Clock,
  ArrowLeftRight,
} from 'lucide-react';
import './Sync.css';

export const SyncConflictPanel: FC = observer(() => {
  const { syncStore } = useStore();

  const handleResolve = useCallback(
    async (conflictId: number, strategy: 'local_wins' | 'remote_wins') => {
      await syncStore.resolveConflict(conflictId, strategy);
    },
    [syncStore]
  );

  const handleClose = useCallback(() => {
    syncStore.setConflictPanelOpen(false);
  }, [syncStore]);

  const formatTime = (ts: number | null): string => {
    if (!ts) return '—';
    return new Date(ts).toLocaleString();
  };

  if (!syncStore.isConflictPanelOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal sync-conflict-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <AlertTriangle size={18} />
            {' '}Sync Conflicts
          </h2>
          <button className="button-icon" onClick={handleClose}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="modal-content">
          {syncStore.conflicts.length === 0 ? (
            <div className="sync-conflict-empty">
              <CheckCircle size={48} className="sync-conflict-empty__icon" />
              <p>No conflicts. All files are synced.</p>
            </div>
          ) : (
            <div className="sync-conflict-list">
              {syncStore.conflicts.map((conflict) => (
                <div key={conflict.conflictId} className="sync-conflict-card">
                  <div className="sync-conflict-card__header">
                    <FileText size={16} />
                    <span className="sync-conflict-card__file">
                      {conflict.filePath || conflict.fileId}
                    </span>
                    <span className={`sync-conflict-card__status sync-conflict-card__status--${conflict.resolution}`}>
                      {conflict.resolution === 'pending'
                        ? 'Unresolved'
                        : conflict.resolution === 'auto_resolved'
                        ? 'Auto'
                        : 'Manual'}
                    </span>
                  </div>

                  <div className="sync-conflict-card__details">
                    <div className="sync-conflict-card__version">
                      <span className="sync-conflict-card__label">Local version</span>
                      <span className="sync-conflict-card__value">v{conflict.localVersion}</span>
                      <span className="sync-conflict-card__time">
                        <Clock size={12} /> {formatTime(conflict.localModifiedAt)}
                      </span>
                    </div>
                    <div className="sync-conflict-card__vs">
                      <ArrowLeftRight size={14} />
                    </div>
                    <div className="sync-conflict-card__version">
                      <span className="sync-conflict-card__label">Remote version</span>
                      <span className="sync-conflict-card__value">v{conflict.remoteVersion}</span>
                      <span className="sync-conflict-card__time">
                        <Clock size={12} /> {formatTime(conflict.remoteModifiedAt)}
                      </span>
                    </div>
                  </div>

                  {conflict.resolution === 'pending' && (
                    <div className="sync-conflict-card__actions">
                      <button
                        className="sync-btn sync-btn--primary"
                        onClick={() => handleResolve(conflict.conflictId, 'local_wins')}
                      >
                        <CheckCircle size={14} /> Keep Local
                      </button>
                      <button
                        className="sync-btn sync-btn--secondary"
                        onClick={() => handleResolve(conflict.conflictId, 'remote_wins')}
                      >
                        <CheckCircle size={14} /> Accept Remote
                      </button>
                    </div>
                  )}

                  {conflict.resolution !== 'pending' && (
                    <div className="sync-conflict-card__resolved">
                      Resolved: {conflict.resolvedBy === 'lww' ? 'LWW' : conflict.resolvedBy === 'local_wins' ? 'Kept Local' : 'Accepted Remote'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
