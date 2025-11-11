import { X } from "lucide-react";
import { FC, useCallback, useState } from "react";
import { Typography } from "./Typography";
import { Layout } from "./Layout";
import { Censorship } from "./Censorship";
import { Data } from "./Data";
import { observer } from "mobx-react-lite";
import { useStore } from "../../../stores/StoreProvider";

type SettingsModalProps = {
  onClose: () => void;
};

type TabType = 'typography' | 'layout' | 'censorship' | 'data';

export const SettingsModal: FC<SettingsModalProps> = observer(({ onClose}) => {
  const { settingsStore } = useStore();

  const renderActiveTab = useCallback(() => {
    switch (settingsStore.activeSettingsTab) {
      case 'typography':
        return <Typography settings={settingsStore.settings} setSettings={settingsStore.updateSettings} />;
      case 'layout':
        return <Layout settings={settingsStore.settings} setSettings={settingsStore.updateSettings} />;
      case 'censorship':
        return <Censorship />;
      case 'data':
        return <Data />;
      default:
        return null;
    }
  }, [settingsStore.activeSettingsTab, settingsStore.settings]);

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
            className={`modal-tab ${settingsStore.activeSettingsTab === 'censorship' ? 'active' : ''}`}
            onClick={() => settingsStore.setActiveSettingsTab('censorship')}
          >
            Censorship
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