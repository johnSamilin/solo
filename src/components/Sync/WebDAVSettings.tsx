/**
 * WebDAVSettings — UI для настройки WebDAV синхронизации.
 *
 * Позволяет:
 *   - Ввести URL WebDAV сервера
 *   - Ввести логин/пароль
 *   - Выбрать интервал опроса
 *   - Проверить соединение с сервером
 *   - Управлять синхронизацией
 */

import { FC, useState, useCallback, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '../../stores/StoreProvider';
import {
  Cloud,
  CloudOff,
  Globe,
  Lock,
  User,
  Clock,
  Check,
  X,
  AlertTriangle,
  RefreshCw,
  Activity,
} from 'lucide-react';
import { WebDAVClient } from '../../sync/webdav/WebDAVClient';
import './Sync.css';

export const WebDAVSettings: FC = observer(() => {
  const { syncStore } = useStore();

  const [url, setUrl] = useState(syncStore.webdavUrl);
  const [username, setUsername] = useState(syncStore.webdavUsername);
  const [password, setPassword] = useState(syncStore.webdavPassword);
  const [pollInterval, setPollInterval] = useState(syncStore.webdavPollIntervalMs);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'idle' | 'success' | 'fail'>('idle');
  const [testError, setTestError] = useState('');

  const isWebdavActive = syncStore.syncMode === 'webdav' && syncStore.isEnabled;

  const handleTestConnection = useCallback(async () => {
    if (!url.trim()) return;

    setTesting(true);
    setTestResult('idle');
    setTestError('');

    try {
      const client = new WebDAVClient({
        url: url.trim(),
        username: username.trim(),
        password: password,
      });
      const result = await client.checkConnection();
      setTestResult(result.success ? 'success' : 'fail');
      if (!result.success) setTestError(result.error || 'Server returned unexpected response');
    } catch (err: any) {
      setTestResult('fail');
      setTestError(err?.message || 'Connection failed');
    } finally {
      setTesting(false);
    }
  }, [url, username, password]);

  const handleSave = useCallback(() => {
    syncStore.setWebdavUrl(url.trim());
    syncStore.setWebdavUsername(username.trim());
    syncStore.setWebdavPassword(password);
    syncStore.setWebdavPollInterval(pollInterval);
  }, [syncStore, url, username, password, pollInterval]);

  const handleEnable = useCallback(() => {
    // Сохраняем сначала, потом включаем синхронизацию в WebDAV режиме
    handleSave();
    if (syncStore.syncMode !== 'webdav') {
      syncStore.setSyncMode('webdav');
    }
    syncStore.setEnabled(true);
  }, [syncStore, handleSave]);

  const handleDisable = useCallback(() => {
    syncStore.setEnabled(false);
  }, [syncStore]);

  useEffect(() => {
    setUrl(syncStore.webdavUrl);
    setUsername(syncStore.webdavUsername);
    setPassword(syncStore.webdavPassword);
    setPollInterval(syncStore.webdavPollIntervalMs);
  }, [syncStore.webdavUrl, syncStore.webdavUsername, syncStore.webdavPassword, syncStore.webdavPollIntervalMs]);

  return (
    <div className="sync-settings webdav-settings">
      <div className="settings-group">
        <h3>
          <Cloud size={16} /> WebDAV Sync
        </h3>

        {/* Enable/disable */}
        <div className="setting-item">
          <label>Sync Status</label>
          <div className="sync-toggle-wrapper">
            <button
              className={`sync-toggle ${isWebdavActive ? 'sync-toggle--active' : ''}`}
              onClick={isWebdavActive ? handleDisable : handleEnable}
            >
              {isWebdavActive ? (
                <>
                  <Cloud size={16} /> Enabled
                </>
              ) : (
                <>
                  <CloudOff size={16} /> Disabled
                </>
              )}
            </button>
          </div>
        </div>

        {/* Server URL */}
        <div className="setting-item">
          <label>
            <Globe size={14} /> Server URL
          </label>
          <input
            type="text"
            className="sync-input"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/remote.php/dav/files/user/"
            disabled={syncStore.isEnabled}
          />
        </div>

        {/* Username */}
        <div className="setting-item">
          <label>
            <User size={14} /> Username
          </label>
          <input
            type="text"
            className="sync-input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="username"
            disabled={syncStore.isEnabled}
          />
        </div>

        {/* Password */}
        <div className="setting-item">
          <label>
            <Lock size={14} /> Password
          </label>
          <input
            type="password"
            className="sync-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            disabled={syncStore.isEnabled}
          />
        </div>

        {/* Poll interval */}
        <div className="setting-item">
          <label>
            <Clock size={14} /> Poll Interval
          </label>
          <select
            className="sync-input"
            value={pollInterval}
            onChange={(e) => setPollInterval(Number(e.target.value))}
            disabled={syncStore.isEnabled}
          >
            <option value={5000}>5 seconds</option>
            <option value={10000}>10 seconds</option>
            <option value={15000}>15 seconds</option>
            <option value={30000}>30 seconds</option>
            <option value={60000}>1 minute</option>
            <option value={300000}>5 minutes</option>
          </select>
        </div>

        {/* Action buttons */}
        <div className="setting-item">
          <label>Actions</label>
          <div className="webdav-actions">
            <button
              className="sync-btn sync-btn--secondary"
              onClick={handleTestConnection}
              disabled={testing || !url.trim() || syncStore.isEnabled}
            >
              {testing ? (
                <>
                  <RefreshCw size={14} className="sync-spin" /> Testing...
                </>
              ) : (
                <>
                  <Activity size={14} /> Test Connection
                </>
              )}
            </button>

            <button
              className="sync-btn sync-btn--primary"
              onClick={handleSave}
              disabled={syncStore.isEnabled}
            >
              <Check size={14} /> Save Settings
            </button>
          </div>
        </div>

        {/* Test result */}
        {testResult !== 'idle' && (
          <div className="setting-item">
            <label>Result</label>
            <div className={`webdav-test-result webdav-test-result--${testResult}`}>
              {testResult === 'success' ? (
                <>
                  <Check size={14} /> Connection successful
                </>
              ) : (
                <>
                  <X size={14} /> Connection failed
                  {testError && <span className="webdav-test-error"> — {testError}</span>}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Status section (only visible when WebDAV is active) */}
      {isWebdavActive && (
        <div className="settings-group">
          <h3>Sync Status</h3>

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
                  Last sync: {new Date(syncStore.status.lastSyncAt).toLocaleString()}
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
      )}
    </div>
  );
});
