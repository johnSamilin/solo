/**
 * SyncSettings — sync settings tab in SettingsModal.
 *
 * Позволяет:
 *   - Переключаться между Bluetooth и WebDAV режимами
 *   - Настраивать выбранный транспорт
 *   - Просматривать список доверенных устройств (Bluetooth)
 *   - Находить новые устройства (Bluetooth)
 *   - Управлять конфликтами
 */

import { FC, useState, useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '../../stores/StoreProvider';
import {
  Bluetooth,
  BluetoothConnected,
  BluetoothSearching,
  Cloud,
  Plus,
  AlertTriangle,
  RefreshCw,
  Check,
  X,
  Smartphone,
  Monitor,
  ShieldCheck,
  Clock,
} from 'lucide-react';
import { WebDAVSettings } from './WebDAVSettings';
import './Sync.css';

export const SyncSettings: FC = observer(() => {
  const { syncStore } = useStore();
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [deviceNameInput, setDeviceNameInput] = useState(syncStore.deviceName);

  const isBluetooth = syncStore.syncMode === 'bluetooth';

  // ========== Переключение режима ==========

  const handleSetBluetoothMode = useCallback(() => {
    if (syncStore.isEnabled) {
      syncStore.setEnabled(false);
    }
    syncStore.setSyncMode('bluetooth');
  }, [syncStore]);

  const handleSetWebdavMode = useCallback(() => {
    if (syncStore.isEnabled) {
      syncStore.setEnabled(false);
    }
    syncStore.setSyncMode('webdav');
  }, [syncStore]);

  // ========== Bluetooth actions ==========

  const handleToggleEnable = useCallback(async () => {
    syncStore.setEnabled(!syncStore.isEnabled);
  }, [syncStore]);

  const handleDiscover = useCallback(async () => {
    setIsDiscovering(true);
    try {
      await syncStore.discoverPeers();
    } finally {
      setIsDiscovering(false);
    }
  }, [syncStore]);

  const handlePair = useCallback(
    async (deviceId: string) => {
      await syncStore.pairDevice(deviceId);
    },
    [syncStore]
  );

  const handleUnpair = useCallback(
    async (deviceId: string) => {
      await syncStore.unpairDevice(deviceId);
    },
    [syncStore]
  );

  const handleDeviceNameSave = useCallback(() => {
    syncStore.setDeviceName(deviceNameInput);
  }, [syncStore, deviceNameInput]);

  const handleOpenConflicts = useCallback(() => {
    syncStore.setConflictPanelOpen(true);
  }, [syncStore]);

  const formatTime = (ts: number | null): string => {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleString();
  };

  return (
    <div className="sync-settings">
      {/* ========== Mode Switcher ========== */}
      <div className="settings-group">
        <h3>Sync Mode</h3>

        <div className="setting-item">
          <label>Transport</label>
          <div className="sync-mode-switcher">
            <button
              className={`sync-mode-btn ${isBluetooth ? 'sync-mode-btn--active' : ''}`}
              onClick={handleSetBluetoothMode}
            >
              <Bluetooth size={16} />
              <span>Bluetooth</span>
            </button>
            <button
              className={`sync-mode-btn ${!isBluetooth ? 'sync-mode-btn--active' : ''}`}
              onClick={handleSetWebdavMode}
            >
              <Cloud size={16} />
              <span>WebDAV</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========== Bluetooth Settings ========== */}
      {isBluetooth ? (
        <div className="sync-settings-bt">
          <div className="settings-group">
            <h3>Bluetooth Sync</h3>

            {/* Enable/disable */}
            <div className="setting-item">
              <label>Enable Sync</label>
              <div className="sync-toggle-wrapper">
                <button
                  className={`sync-toggle ${syncStore.isEnabled ? 'sync-toggle--active' : ''}`}
                  onClick={handleToggleEnable}
                >
                  {syncStore.isEnabled ? (
                    <>
                      <BluetoothConnected size={16} /> Enabled
                    </>
                  ) : (
                    <>
                      <Bluetooth size={16} /> Disabled
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Device name */}
            <div className="setting-item">
              <label>Device Name</label>
              <div className="sync-device-name">
                <input
                  type="text"
                  className="sync-input"
                  value={deviceNameInput}
                  onChange={(e) => setDeviceNameInput(e.target.value)}
                  placeholder="My Device"
                  disabled={!syncStore.isEnabled}
                />
                <button
                  className="sync-btn sync-btn--primary"
                  onClick={handleDeviceNameSave}
                  disabled={!syncStore.isEnabled || !deviceNameInput.trim()}
                >
                  <Check size={14} /> Save
                </button>
              </div>
            </div>

            {/* Status */}
            <div className="setting-item">
              <label>Status</label>
              <div className="sync-status-info">
                <span className={`sync-state-badge sync-state-badge--${syncStore.status.state}`}>
                  {syncStore.isSyncing && <RefreshCw size={12} className="sync-spin" />}
                  {syncStore.stateLabel}
                </span>
                {syncStore.status.lastSyncAt && (
                  <span className="sync-last-sync">
                    <Clock size={12} />
                    Last sync: {formatTime(syncStore.status.lastSyncAt)}
                  </span>
                )}
                {syncStore.status.error && (
                  <span className="sync-error">
                    <AlertTriangle size={12} />
                    {syncStore.status.error}
                  </span>
                )}
              </div>
            </div>

            {/* Sync progress */}
            {syncStore.status.progress && syncStore.isSyncing && (
              <div className="setting-item">
                <label>Progress</label>
                <div className="sync-progress">
                  <div className="sync-progress__bar">
                    <div
                      className="sync-progress__fill"
                      style={{
                        '--progress-width':
                          syncStore.status.progress.totalFiles > 0
                            ? `${(syncStore.status.progress.transferredFiles / syncStore.status.progress.totalFiles) * 100}%`
                            : '0%',
                      } as React.CSSProperties}
                    />
                  </div>
                  <span className="sync-progress__text">
                    {syncStore.status.progress.transferredFiles} / {syncStore.status.progress.totalFiles}
                    {syncStore.status.progress.currentFile
                      ? ` — ${syncStore.status.progress.currentFile}`
                      : ''}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* --- Trusted devices --- */}
          <div className="settings-group">
            <h3>Trusted Devices</h3>

            {syncStore.pairedPeers.length === 0 ? (
              <p className="sync-empty">No trusted devices. Find a device and connect to it.</p>
            ) : (
              <div className="sync-peer-list">
                {//@ts-ignore
                syncStore.pairedPeers.peers.map((peer) => (
                  <div key={peer.id} className="sync-peer-item">
                    <div className="sync-peer-item__icon">
                      {peer.deviceType === 'android' ? (
                        <Smartphone size={18} />
                      ) : (
                        <Monitor size={18} />
                      )}
                    </div>
                    <div className="sync-peer-item__info">
                      <span className="sync-peer-item__name">{peer.name}</span>
                      <span className="sync-peer-item__meta">
                        {peer.isPaired ? 'Connected' : 'Disconnected'}
                        {peer.lastSeenAt ? ` · ${formatTime(peer.lastSeenAt)}` : ''}
                      </span>
                    </div>
                    <div className="sync-peer-item__status">
                      {peer.trustStatus === 'trusted' && (
                        <ShieldCheck size={14} className="sync-peer-item__trusted" />
                      )}
                    </div>
                    <button
                      className="sync-btn sync-btn--danger"
                      onClick={() => handleUnpair(peer.id)}
                      title="Disconnect device"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* --- Available devices --- */}
          <div className="settings-group">
            <h3>Available Devices</h3>

            <button
              className="sync-btn sync-btn--primary sync-discover-btn"
              onClick={handleDiscover}
              disabled={isDiscovering || !syncStore.isEnabled}
            >
              {isDiscovering ? (
                <>
                  <RefreshCw size={14} className="sync-spin" /> Searching...
                </>
              ) : (
                <>
                  <BluetoothSearching size={14} /> Find Devices
                </>
              )}
            </button>

            {syncStore.availablePeers.length === 0 ? (
              <p className="sync-empty">
                {isDiscovering
                  ? 'Searching for devices...'
                  : 'Click "Find Devices" to discover nearby peers.'}
              </p>
            ) : (
              <div className="sync-peer-list">
                {//@ts-ignore
                syncStore.availablePeers.peers.map((peer) => (
                  <div key={peer.id} className="sync-peer-item">
                    <div className="sync-peer-item__icon">
                      {peer.deviceType === 'android' ? (
                        <Smartphone size={18} />
                      ) : (
                        <Monitor size={18} />
                      )}
                    </div>
                    <div className="sync-peer-item__info">
                      <span className="sync-peer-item__name">{peer.name}</span>
                      <span className="sync-peer-item__meta">
                        {peer.macAddress || 'No MAC'}
                      </span>
                    </div>
                    <button
                      className="sync-btn sync-btn--primary"
                      onClick={() => handlePair(peer.id)}
                      disabled={peer.trustStatus === 'trusted'}
                    >
                      {peer.trustStatus === 'trusted' ? (
                        <>Connected</>
                      ) : (
                        <>
                          <Plus size={14} /> Connect
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ========== WebDAV Settings ========== */
        <WebDAVSettings />
      )}

      {/* ========== Conflicts (общий для всех режимов) ========== */}
      <div className="settings-group">
        <h3>Conflicts</h3>

        <div className="setting-item">
          <label>Unresolved Conflicts</label>
          <div className="sync-conflicts-summary">
            <span className={`sync-conflict-count ${syncStore.hasConflicts ? 'sync-conflict-count--has' : ''}`}>
              {syncStore.conflicts.length}
            </span>
            <button
              className="sync-btn sync-btn--secondary"
              onClick={handleOpenConflicts}
              disabled={!syncStore.hasConflicts}
            >
              <AlertTriangle size={14} /> Manage Conflicts
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
