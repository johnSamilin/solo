import { X, FolderOpen } from "lucide-react";
import { FC, useCallback, useState, useEffect } from "react";
import { Typography } from "./Typography";
import { Layout } from "./Layout";
import { Tags } from "./Tags";
import { Statistics } from "./Statistics";
import { observer } from "mobx-react-lite";
import { useStore } from "../../../stores/StoreProvider";
import { useI18n } from "../../../i18n/I18nContext";
import "./SettingsModal.css";

type SettingsModalProps = {
  onClose: () => void;
};

type TabType = 'typography' | 'layout' | 'data' | 'tags' | 'statistics';

export const SettingsModal: FC<SettingsModalProps> = observer(({ onClose}) => {
  const { settingsStore, notesStore } = useStore();
  const { t } = useI18n();

  const handleSelectFolder = async () => {
    if (!window.electronAPI) return;

    const result = await window.electronAPI.selectFolder();
    if (result.success && result.path) {
      settingsStore.setDataFolder(result.path);
      settingsStore.setToast('Data folder updated. Reloading...', 'success');
      await notesStore.loadFromStorage();
    } else {
      settingsStore.setToast(result.error || 'Failed to select folder', 'error');
    }
  };

  const handleSelectDigikamDb = async () => {
    if (!window.electronAPI) return;

    const result = await window.electronAPI.selectFile([
      { name: 'SQLite Database', extensions: ['db', 'sqlite', 'sqlite3'] }
    ]);
    if (result.success && result.path) {
      settingsStore.setDigikamDbPath(result.path);
      settingsStore.setToast('digiKam database path updated', 'success');
    } else if (result.error && !result.error.includes('cancelled')) {
      settingsStore.setToast(result.error || 'Failed to select file', 'error');
    }
  };

  const renderActiveTab = useCallback(() => {
    switch (settingsStore.activeSettingsTab) {
      case 'typography':
        return <Typography settings={settingsStore.settings} setSettings={settingsStore.updateSettings} />;
      case 'layout':
        return <Layout settings={settingsStore.settings} setSettings={settingsStore.updateSettings} />;
      case 'tags':
        return <Tags />;
      case 'statistics':
        return <Statistics />;
      case 'data':
        return (
          <div className="settings-group">
            <h3>Data</h3>
            <div className="setting-item">
              <label>Data Folder</label>
              <div className="data-folder-controls">
                <input
                  type="text"
                  value={settingsStore.dataFolder || 'No folder selected'}
                  readOnly
                  className="data-folder-input"
                />
                <button
                  onClick={handleSelectFolder}
                  className="data-folder-button"
                >
                  <FolderOpen className="h-4 w-4" />
                  Browse
                </button>
              </div>
              <small className="data-folder-help">
                Select the folder where your notes are stored
              </small>
            </div>
            <div className="setting-item">
              <label>digiKam Database (optional)</label>
              <div className="data-folder-controls">
                <input
                  type="text"
                  value={settingsStore.digikamDbPath || 'No database selected'}
                  readOnly
                  className="data-folder-input"
                />
                <button
                  onClick={handleSelectDigikamDb}
                  className="data-folder-button"
                >
                  <FolderOpen className="h-4 w-4" />
                  Browse
                </button>
              </div>
              <small className="data-folder-help">
                Optional: Path to digiKam database file
              </small>
            </div>
          </div>
        );
      default:
        return null;
    }
  }, [settingsStore.activeSettingsTab, settingsStore.settings, settingsStore.dataFolder, settingsStore.digikamDbPath]);

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h2>{t.settings.settings}</h2>
          <button className="button-icon" onClick={() => onClose()}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="modal-tabs">
          <button
            className={`modal-tab ${settingsStore.activeSettingsTab === 'typography' ? 'active' : ''}`}
            onClick={() => settingsStore.setActiveSettingsTab('typography')}
          >
            {t.settings.typography}
          </button>
          <button
            className={`modal-tab ${settingsStore.activeSettingsTab === 'layout' ? 'active' : ''}`}
            onClick={() => settingsStore.setActiveSettingsTab('layout')}
          >
            {t.settings.layout}
          </button>
          <button
            className={`modal-tab ${settingsStore.activeSettingsTab === 'tags' ? 'active' : ''}`}
            onClick={() => settingsStore.setActiveSettingsTab('tags')}
          >
            {t.settings.tags}
          </button>
          <button
            className={`modal-tab ${settingsStore.activeSettingsTab === 'statistics' ? 'active' : ''}`}
            onClick={() => settingsStore.setActiveSettingsTab('statistics')}
          >
            {t.settings.statistics}
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