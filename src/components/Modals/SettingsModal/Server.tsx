import { FC, useState } from "react";
import { observer } from "mobx-react-lite";
import { useStore } from "../../../stores/StoreProvider";

export const Server: FC = observer(() => {
  const { settingsStore } = useStore();
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  const handleTestConnection = async () => {
    if (!settingsStore.server.url) return;
    
    setTestStatus('testing');
    try {
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
    } catch (error) {
      setTestStatus('error');
    }
  };

  const handleSync = async () => {
    if (!settingsStore.server.url || !settingsStore.server.token) return;

    try {
      const response = await fetch(`${settingsStore.server.url}/api/data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
  };

  return (
    <div className="settings-group">
      <h3>Server Sync</h3>
      <div className="setting-item">
        <label>Enable Server Sync</label>
        <input
          type="checkbox"
          checked={settingsStore.server.enabled}
          onChange={(e) => settingsStore.updateServer({ enabled: e.target.checked })}
        />
      </div>
      {settingsStore.server.enabled && (
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
              disabled={!settingsStore.server.token}
            >
              Sync Now
            </button>
          </div>
          {testStatus === 'success' && (
            <div className="import-status success">Connection successful!</div>
          )}
          {testStatus === 'error' && (
            <div className="import-status error">Connection failed. Please check your settings.</div>
          )}
        </>
      )}
    </div>
  );
});