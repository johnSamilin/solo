// ============================================================
// SyncSettings — P2P sync configuration UI
// ============================================================

import { FC, useState } from "react";
import { observer } from "mobx-react-lite";
import { useStore } from "../../stores/StoreProvider";
import { Wifi, Bluetooth, Plus, X, Globe } from "lucide-react";
import "./SyncSettings.css";

export const SyncSettings: FC = observer(() => {
  const { syncStore } = useStore();
  const [manualIp, setManualIp] = useState('');
  const [manualPort, setManualPort] = useState('54879');

  const handleToggleSync = async () => {
    await syncStore!.toggleSync();
  };

  const handleManualConnect = async () => {
    if (!manualIp) return;
    const port = parseInt(manualPort, 10) || 54879;
    await syncStore!.connectToPeer(manualIp, port);
    setManualIp('');
    setManualPort('54879');
  };

  const handleTransportToggle = async (transport: 'wifi' | 'bluetooth') => {
    const config = { ...syncStore!.transportConfig };
    config[transport] = !config[transport];
    await syncStore!.setTransportConfig(config);
  };

  const formatDate = (ts: number | null): string => {
    if (!ts) return '—';
    return new Date(ts).toLocaleString();
  };

  const statusLabel = (): string => {
    switch (syncStore!.syncStatus) {
      case 'idle': return syncStore!.enabled ? 'Ready' : 'Disabled';
      case 'scanning': return 'Scanning...';
      case 'discovering': return 'Discovering...';
      case 'syncing': return 'Syncing...';
      case 'error': return `Error: ${syncStore!.errorMessage}`;
      default: return 'Unknown';
    }
  };

  return (
    <div className="settings-group">
      <h3>Sync</h3>

      {/* Enable/disable toggle */}
      <div className="setting-item">
        <label>Device Sync</label>
        <div className="sync-toggle-wrapper">
          <button
            className={`sync-toggle-btn ${syncStore!.enabled ? 'active' : ''}`}
            onClick={handleToggleSync}
          >
            {syncStore!.enabled ? 'On' : 'Off'}
          </button>
        </div>
        <small className="setting-help">
          Sync your notes across Solo devices
        </small>
      </div>

      {/* Device name */}
      <div className="setting-item">
        <label>Device Name</label>
        <input
          type="text"
          value={syncStore!.deviceName}
          onChange={(e) => syncStore!.setDeviceName(e.target.value)}
          className="sync-input"
          placeholder="My Device"
        />
        <small className="setting-help">
          Other devices will see this name
        </small>
      </div>

      {/* Transport toggles */}
      <div className="setting-item">
        <label>Sync Methods</label>
        <div className="sync-transport-options">
          <label className="sync-transport-option">
            <div className="sync-transport-header">
              <Wifi className="sync-icon sync-icon-wifi" />
              <span>WiFi (LAN)</span>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={syncStore!.transportConfig.wifi}
                onChange={() => handleTransportToggle('wifi')}
              />
              <span className="switch-slider"></span>
            </label>
          </label>

          <label className="sync-transport-option">
            <div className="sync-transport-header">
              <Bluetooth className="sync-icon sync-icon-bluetooth" />
              <span>Bluetooth</span>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={syncStore!.transportConfig.bluetooth}
                onChange={() => handleTransportToggle('bluetooth')}
              />
              <span className="switch-slider"></span>
            </label>
          </label>
        </div>
        <small className="setting-help">
          Bluetooth is the default transport for mobile devices
        </small>
      </div>

      {/* Status */}
      <div className="setting-item">
        <label>Status</label>
        <div className={`sync-status-badge ${syncStore!.syncStatus}`}>
          <span className={`sync-status-dot ${syncStore!.enabled ? 'active' : ''}`}></span>
          <span>{statusLabel()}</span>
        </div>
        {syncStore!.syncProgress && (
          <small className="setting-help">{syncStore!.syncProgress}</small>
        )}
      </div>

      {/* Connected peers */}
      {syncStore!.connectedPeers.length > 0 && (
        <div className="setting-item">
          <label>Connected ({syncStore!.connectedPeers.length})</label>
          <div className="sync-peer-list">
            {syncStore!.connectedPeers.map((peer: { deviceId: string; deviceName: string; address: string; port: number; transport: string }) => (
              <div key={peer.deviceId} className="sync-peer-item">
                <div className="sync-peer-info">
                  <Globe className="sync-icon sync-icon-globe" />
                  <div>
                    <div className="sync-peer-name">{peer.deviceName}</div>
                    <div className="sync-peer-address">
                      {peer.address}:{peer.port} ({peer.transport})
                    </div>
                  </div>
                </div>
                <button
                  className="sync-peer-remove"
                  onClick={() => syncStore!.disconnectFromPeer(peer.deviceId)}
                  title="Disconnect"
                >
                  <X className="sync-icon sync-icon-small" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Manual connection */}
      <div className="setting-item">
        <label>Manual Connect</label>
        <div className="sync-manual-connect">
          <input
            type="text"
            value={manualIp}
            onChange={(e) => setManualIp(e.target.value)}
            placeholder="IP address"
            className="sync-input sync-input-ip"
          />
          <input
            type="number"
            value={manualPort}
            onChange={(e) => setManualPort(e.target.value)}
            placeholder="Port"
            className="sync-input sync-input-port"
          />
          <button
            onClick={handleManualConnect}
            className="sync-connect-btn"
            disabled={!manualIp}
          >
            <Plus className="sync-icon sync-icon-plus" />
            Connect
          </button>
        </div>
      </div>

      {/* Last sync */}
      <div className="setting-item">
        <label>Last Sync</label>
        <span className="sync-last-time">{formatDate(syncStore!.lastSyncTime)}</span>
      </div>

      {/* Conflicts */}
      {syncStore!.pendingConflicts.length > 0 && (
        <div className="setting-item">
          <label>Conflicts ({syncStore!.pendingConflicts.length})</label>
          <div className="sync-conflict-list">
            {syncStore!.pendingConflicts.map((conflict: { conflictId: string; fileId: string }) => (
              <div key={conflict.conflictId} className="sync-conflict-item">
                <div className="sync-conflict-file">{conflict.fileId}</div>
                <div className="sync-conflict-actions">
                  <button
                    className="sync-conflict-btn sync-conflict-btn-local"
                    onClick={() => syncStore!.resolveConflict(conflict.conflictId, 'keep_local')}
                  >
                    Keep Local
                  </button>
                  <button
                    className="sync-conflict-btn sync-conflict-btn-remote"
                    onClick={() => syncStore!.resolveConflict(conflict.conflictId, 'keep_remote')}
                  >
                    Accept Remote
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
