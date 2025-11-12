import { X, FolderOpen } from "lucide-react";
import { FC, useCallback, useState, useEffect } from "react";
import { Typography } from "./Typography";
import { Layout } from "./Layout";
import { observer } from "mobx-react-lite";
import { useStore } from "../../../stores/StoreProvider";

type SettingsModalProps = {
  onClose: () => void;
};

type TabType = 'typography' | 'layout' | 'data';

export const SettingsModal: FC<SettingsModalProps> = observer(({ onClose}) => {
  const { settingsStore, notesStore } = useStore();
  const [dataFolder, setDataFolder] = useState<string | null>(null);

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getDataFolder().then((result) => {
        if (result.success && result.path) {
          setDataFolder(result.path);
        }
      });
    }
  }, []);

  const handleSelectFolder = async () => {
    if (!window.electronAPI) return;

    const result = await window.electronAPI.selectFolder();
    if (result.success && result.path) {
      setDataFolder(result.path);
      settingsStore.setToast('Data folder updated. Reloading...', 'success');
      await notesStore.loadFromStorage();
    } else {
      settingsStore.setToast(result.error || 'Failed to select folder', 'error');
    }
  };

  const renderActiveTab = useCallback(() => {
    switch (settingsStore.activeSettingsTab) {
      case 'typography':
        return <Typography settings={settingsStore.settings} setSettings={settingsStore.updateSettings} />;
      case 'layout':
        return <Layout settings={settingsStore.settings} setSettings={settingsStore.updateSettings} />;
      case 'data':
        return (
          <div className="settings-group">
            <h3>Data</h3>
            <div className="setting-item">
              <label>Data Folder</label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="text"
                  value={dataFolder || 'No folder selected'}
                  readOnly
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    backgroundColor: '#f5f5f5'
                  }}
                />
                <button
                  onClick={handleSelectFolder}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 1rem',
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  <FolderOpen className="h-4 w-4" />
                  Browse
                </button>
              </div>
              <small style={{ color: '#666', marginTop: '0.5rem', display: 'block' }}>
                Select the folder where your notes are stored
              </small>
            </div>
          </div>
        );
      default:
        return null;
    }
  }, [settingsStore.activeSettingsTab, settingsStore.settings, dataFolder]);

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h2>Settings</h2>
          <button className="button-icon" onClick={() => onClose()}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="modal-tabs">
          <button
            className={`modal-tab ${settingsStore.activeSettingsTab === 'typography' ? 'active' : ''}`}
            onClick={() => settingsStore.setActiveSettingsTab('typography')}
          >
            Typography
          </button>
          <button
            className={`modal-tab ${settingsStore.activeSettingsTab === 'layout' ? 'active' : ''}`}
            onClick={() => settingsStore.setActiveSettingsTab('layout')}
          >
            Layout
          </button>
          <button
            className={`modal-tab ${settingsStore.activeSettingsTab === 'data' ? 'active' : ''}`}
            onClick={() => settingsStore.setActiveSettingsTab('data')}
          >
            Data
          </button>
        </div>
        <div className="modal-content">
          {renderActiveTab()}
        </div>
      </div>
    </div>
  );
});