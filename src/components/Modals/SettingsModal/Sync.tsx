import { FC, useState } from "react";
import { observer } from "mobx-react-lite";
import { useStore } from "../../../stores/StoreProvider";
import { isPlugin } from "../../../config";

export const Sync: FC = observer(() => {
  const { settingsStore } = useStore();
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  const handleTestConnection = async () => {
    setTestStatus('testing');
    try {
      if (settingsStore.syncMode === 'webdav' && window.bridge?.testWebDAV) {
        const success = await window.bridge.testWebDAV(JSON.stringify(settingsStore.webDAV));
        setTestStatus(success ? 'success' : 'error');
      } else if (settingsStore.syncMode === 'server' && settingsStore.server.url) {
        const response = await fetch(`${settingsStore.server.url}/api/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username: settingsStore.server.username,
            password: settingsStore.server.password,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          settingsStore.setServerToken(data.token);
          setTestStatus('success');
        } else {
          setTestStatus('error');
        }
      }
    } catch (error) {
      setTestStatus('error');
    }
  };

  const handleSync = async () => {
    if (settingsStore.syncMode === 'webdav' && window.bridge?.syncWebDAV) {
      try {
        const success = await window.bridge.syncWebDAV(JSON.stringify(settingsStore.webDAV));
        settingsStore.setToast(
          success ? 'WebDAV sync completed successfully' : 'WebDAV sync failed',
          success ? 'success' : 'error'
        );
      } catch (error) {
        console.error('Sync failed:', error);
        settingsStore.setToast('WebDAV sync failed', 'error');
      }
    } else if (settingsStore.syncMode === 'server' && settingsStore.server.token) {
      try {
        const response = await fetch(`${settingsStore.server.url}/api/data`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Authorization': `Bearer ${settingsStore.server.token}`,
          },
          body: JSON.stringify({
            notes: settingsStore.notes,
            notebooks: settingsStore.notebooks,
          }),
        });

        if (response.ok) {
          settingsStore.setToast('Server sync completed successfully', 'success');
        } else {
          settingsStore.setToast('Server sync failed', 'error');
        }
      } catch (error) {
        console.error('Sync failed:', error);
        settingsStore.setToast('Server sync failed', 'error');
      }
    }
  };

  return (
    <div className="settings-group">
      <h3>Synchronization</h3>
      <div className="setting-item">
        <label>Sync Method</label>
        <select
          value={settingsStore.syncMode}
          onChange={(e) => {
            const mode = e.target.value as 'none' | 'webdav' | 'server';
            settingsStore.setSyncMode(mode);
          }}
        >
          <option value="none">No Synchronization</option>
          {isPlugin && <option value="webdav">WebDAV</option>}
          <option value="server">Server</option>
        </select>
      </div>

      {settingsStore.syncMode === 'webdav' && (
        <>
          <div className="setting-item">
            <label>WebDAV URL</label>
            <input
              type="text"
              value={settingsStore.webDAV.url}
              onChange={(e) => settingsStore.updateWebDAV({ url: e.target.value })}
              placeholder="https://example.com/webdav/"
            />
          </div>
          <div className="setting-item">
            <label>Username</label>
            <input
              type="text"
              value={settingsStore.webDAV.username}
              onChange={(e) => settingsStore.updateWebDAV({ username: e.target.value })}
            />
          </div>
          <div className="setting-item">
            <label>Password</label>
            <input
              type="password"
              value={settingsStore.webDAV.password}
              onChange={(e) => settingsStore.updateWebDAV({ password: e.target.value })}
            />
          </div>
        </>
      )}

      {settingsStore.syncMode === 'server' && (
        <>
          <div className="setting-item">
            <label>Server URL</label>
            <input
              type="text"
              value={settingsStore.server.url}
              onChange={(e) => settingsStore.updateServer({ url: e.target.value })}
              placeholder="https://example.com"
            />
          </div>
          <div className="setting-item">
            <label>Username</label>
            <input
              type="text"
              value={settingsStore.server.username}
              onChange={(e) => settingsStore.updateServer({ username: e.target.value })}
            />
          </div>
          <div className="setting-item">
            <label>Password</label>
            <input
              type="password"
              value={settingsStore.server.password}
              onChange={(e) => settingsStore.updateServer({ password: e.target.value })}
            />
          </div>
        </>
      )}

      {settingsStore.syncMode !== 'none' && (
        <div className="modal-actions">
          <button
            onClick={handleTestConnection}
            className="button-primary"
            disabled={testStatus === 'testing'}
          >
            Test Connection
          </button>
          <button
            onClick={handleSync}
            className="button-primary"
            disabled={
              (settingsStore.syncMode === 'server' && !settingsStore.server.token) ||
              testStatus !== 'success'
            }
          >
            Sync Now
          </button>
        </div>
      )}

      {testStatus === 'success' && (
        <div className="import-status success">Connection successful!</div>
      )}
      {testStatus === 'error' && (
        <div className="import-status error">Connection failed. Please check your settings.</div>
      )}
    </div>
  );
});