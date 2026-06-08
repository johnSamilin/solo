/**
 * SyncStatusBar — compact sync status indicator.
 *
 * Displayed in the lower-left corner of the sidebar or in the app header.
 * Shows:
 *   - Bluetooth icon (enabled/disabled)
 *   - Current status (idle, syncing, error)
 *   - Number of connected peers
 *   - Conflict count (if any)
 *   - Button to open sync settings
 */

import { FC } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '../../stores/StoreProvider';
import { Bluetooth, BluetoothConnected, AlertTriangle, RefreshCw, Settings } from 'lucide-react';
import './SyncStatusBar.css';

export const SyncStatusBar: FC = observer(() => {
  const { syncStore, settingsStore } = useStore();

  const { status, hasConflicts, isSyncing, stateLabel, pairedPeers } = syncStore;

  const handleOpenSettings = () => {
    settingsStore.setActiveSettingsTab('sync');
    settingsStore.setSettingsOpen(true);
  };

  return (
    <div className="sync-status-bar" onClick={handleOpenSettings} title="Sync Settings">
      <div className="sync-status-bar__indicator">
        {status.state === 'error' ? (
          <AlertTriangle className="sync-status-bar__icon sync-status-bar__icon--error" size={14} />
        ) : isSyncing ? (
          <RefreshCw className="sync-status-bar__icon sync-status-bar__icon--syncing" size={14} />
        ) : pairedPeers.length > 0 ? (
          <BluetoothConnected className="sync-status-bar__icon sync-status-bar__icon--connected" size={14} />
        ) : (
          <Bluetooth className="sync-status-bar__icon sync-status-bar__icon--idle" size={14} />
        )}
      </div>

      <span className="sync-status-bar__label">
        {isSyncing ? 'Syncing...' : stateLabel}
      </span>

      {pairedPeers.length > 0 && (
        <span className="sync-status-bar__peers">
          {pairedPeers.length}
        </span>
      )}

      {hasConflicts && (
        <span className="sync-status-bar__conflicts" title="Has conflicts">
          {syncStore.conflicts.length}
        </span>
      )}

      <button
        className="sync-status-bar__settings-btn"
        onClick={(e) => {
          e.stopPropagation();
          handleOpenSettings();
        }}
        title="Sync Settings"
      >
        <Settings size={12} />
      </button>
    </div>
  );
});
