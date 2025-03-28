import { X } from "lucide-react";
import { FC, useCallback, useState } from "react";
import { Typography } from "./Typography";
import { Layout } from "./Layout";
import { Censorship } from "./Censorship";
import { Data } from "./Data";
import { WebDAV } from "./WebDAV";
import { observer } from "mobx-react-lite";
import { useStore } from "../../../stores/StoreProvider";
import { isPlugin } from "../../../config";

type SettingsModalProps = {
  onClose: () => void;
};

type TabType = 'typography' | 'layout' | 'censorship' | 'data' | 'webdav';

export const SettingsModal: FC<SettingsModalProps> = observer(({ onClose}) => {
  const [activeTab, setActiveTab] = useState<TabType>('typography');
  const { settingsStore } = useStore();

  const renderActiveTab = useCallback(() => {
    switch (activeTab) {
      case 'typography':
        return <Typography settings={settingsStore.settings} setSettings={settingsStore.updateSettings} />;
      case 'layout':
        return <Layout settings={settingsStore.settings} setSettings={settingsStore.updateSettings} />;
      case 'censorship':
        return <Censorship />;
      case 'data':
        return <Data />;
      case 'webdav':
        return <WebDAV />;
      default:
        return null;
    }
  }, [activeTab, settingsStore.settings]);

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
            className={`modal-tab ${activeTab === 'typography' ? 'active' : ''}`}
            onClick={() => setActiveTab('typography')}
          >
            Typography
          </button>
          <button
            className={`modal-tab ${activeTab === 'layout' ? 'active' : ''}`}
            onClick={() => setActiveTab('layout')}
          >
            Layout
          </button>
          <button
            className={`modal-tab ${activeTab === 'censorship' ? 'active' : ''}`}
            onClick={() => setActiveTab('censorship')}
          >
            Censorship
          </button>
          <button
            className={`modal-tab ${activeTab === 'data' ? 'active' : ''}`}
            onClick={() => setActiveTab('data')}
          >
            Data
          </button>
          {isPlugin && (
            <button
              className={`modal-tab ${activeTab === 'webdav' ? 'active' : ''}`}
              onClick={() => setActiveTab('webdav')}
            >
              WebDAV
            </button>
          )}
        </div>
        <div className="modal-content">
          {renderActiveTab()}
        </div>
      </div>
    </div>
  );
});