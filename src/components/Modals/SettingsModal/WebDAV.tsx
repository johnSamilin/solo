import { FC, useState } from "react";
import { observer } from "mobx-react-lite";
import { useStore } from "../../../stores/StoreProvider";
import { isPlugin } from "../../../config";

export const WebDAV: FC = observer(() => {
  const { settingsStore, notesStore } = useStore();
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  if (!isPlugin) {
    return null;
  }

  const handleTestConnection = async () => {
    if (!window.bridge?.testWebDAV) return;
    
    setTestStatus('testing');
    try {
      const success = await window.bridge.testWebDAV(JSON.stringify(settingsStore.webDAV));
      setTestStatus(success ? 'success' : 'error');
    } catch (error) {
      setTestStatus('error');
    }
  };

  const handleSync = async () => {
    if (!window.bridge?.syncWebDAV) return;
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
  };

  return (
    <div className="settings-group">
      <h3>WebDAV Sync</h3>
      <div className="setting-item">
        <label>Enable WebDAV</label>
        <input
          type="checkbox"
          checked={settingsStore.webDAV.enabled}
          onChange={(e) => settingsStore.updateWebDAV({ enabled: e.target.checked })}
        />
      </div>
      {settingsStore.webDAV.enabled && (
        <>
          <div className="setting-item">
            <label>Server URL</label>
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
              disabled={!settingsStore.webDAV.enabled}
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