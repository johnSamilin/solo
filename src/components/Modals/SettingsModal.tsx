import { X } from "lucide-react";
import { FC, useState } from "react";
import { TypographySettings } from "../../types";
import { useStore } from "../../stores/StoreProvider";

type SettingsModalProps = {
  onClose: () => void;
  settings: TypographySettings;
  setSettings: React.Dispatch<React.SetStateAction<TypographySettings>>;
};

export const SettingsModal: FC<SettingsModalProps> = ({ onClose, settings, setSettings }) => {
  const { settingsStore } = useStore();
  const [activeTab, setActiveTab] = useState<'typography' | 'censorship'>('typography');
  const [pin, setPin] = useState('');
  const [currentPin, setCurrentPin] = useState('');

  const handleSetPin = () => {
    if (pin.length < 4) return;
    settingsStore.setCensorshipPin(pin);
    setPin('');
  };

  const handleDisableCensorship = () => {
    if (!settingsStore.censorship.pin) return;
    settingsStore.disableCensorship(currentPin);
    setCurrentPin('');
  };

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
            className={`modal-tab ${activeTab === 'censorship' ? 'active' : ''}`}
            onClick={() => setActiveTab('censorship')}
          >
            Censorship
          </button>
        </div>
        <div className="modal-content">
          {activeTab === 'typography' ? (
            <>
              <div className="settings-group">
                <h3>Editor</h3>
                <div className="setting-item">
                  <label>Font Family</label>
                  <select
                    value={settings.editorFontFamily}
                    onChange={(e) => setSettings({ ...settings, editorFontFamily: e.target.value })}
                  >
                    <option value="Byron Mark 2">Byron Mark II</option>
                    <option value="Crimson Pro">Crimson Pro</option>
                    <option value="Inter">Inter</option>
                    <option value="Georgia">Georgia</option>
                    <option value="Times New Roman">Times New Roman</option>
                  </select>
                </div>
                <div className="setting-item">
                  <label>Font Size</label>
                  <select
                    value={settings.editorFontSize}
                    onChange={(e) => setSettings({ ...settings, editorFontSize: e.target.value })}
                  >
                    <option value="1rem">Small</option>
                    <option value="1.125rem">Medium</option>
                    <option value="1.25rem">Large</option>
                  </select>
                </div>
                <div className="setting-item">
                  <label>Line Height</label>
                  <select
                    value={settings.editorLineHeight}
                    onChange={(e) => setSettings({ ...settings, editorLineHeight: e.target.value })}
                  >
                    <option value="1.5">Compact</option>
                    <option value="1.75">Comfortable</option>
                    <option value="2">Spacious</option>
                  </select>
                </div>
              </div>
              <div className="settings-group">
                <h3>Title</h3>
                <div className="setting-item">
                  <label>Font Family</label>
                  <select
                    value={settings.titleFontFamily}
                    onChange={(e) => setSettings({ ...settings, titleFontFamily: e.target.value })}
                  >
                    <option value="Byron Mark 2">Byron Mark II</option>
                    <option value="Crimson Pro">Crimson Pro</option>
                    <option value="Inter">Inter</option>
                    <option value="Georgia">Georgia</option>
                  </select>
                </div>
                <div className="setting-item">
                  <label>Font Size</label>
                  <select
                    value={settings.titleFontSize}
                    onChange={(e) => setSettings({ ...settings, titleFontSize: e.target.value })}
                  >
                    <option value="1.5rem">Small</option>
                    <option value="2rem">Medium</option>
                    <option value="2.5rem">Large</option>
                  </select>
                </div>
              </div>
              <div className="settings-group">
                <h3>Sidebar</h3>
                <div className="setting-item">
                  <label>Font Family</label>
                  <select
                    value={settings.sidebarFontFamily}
                    onChange={(e) => setSettings({ ...settings, sidebarFontFamily: e.target.value })}
                  >
                    <option value="Byron Mark 2">Byron Mark II</option>
                    <option value="Crimson Pro">Crimson Pro</option>
                    <option value="Inter">Inter</option>
                    <option value="Georgia">Georgia</option>
                  </select>
                </div>
                <div className="setting-item">
                  <label>Font Size</label>
                  <select
                    value={settings.sidebarFontSize}
                    onChange={(e) => setSettings({ ...settings, sidebarFontSize: e.target.value })}
                  >
                    <option value="0.875rem">Small</option>
                    <option value="1rem">Medium</option>
                    <option value="1.125rem">Large</option>
                  </select>
                </div>
              </div>
            </>
          ) : (
            <div className="settings-group">
              <h3>Censorship Settings</h3>
              {!settingsStore.censorship.pin ? (
                <div className="setting-item">
                  <label>Set PIN Code</label>
                  <div className="pin-input-group">
                    <input
                      type="password"
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      className="pin-input"
                      placeholder="Enter PIN"
                    />
                    <button onClick={handleSetPin} className="button-primary">
                      Set PIN
                    </button>
                  </div>
                </div>
              ) : (
                <div className="setting-item">
                  <label>Disable Censorship</label>
                  <div className="pin-input-group">
                    <input
                      type="password"
                      value={currentPin}
                      onChange={(e) => setCurrentPin(e.target.value)}
                      className="pin-input"
                      placeholder="Enter PIN"
                    />
                    <button onClick={handleDisableCensorship} className="button-primary">
                      Turn Off
                    </button>
                  </div>
                </div>
              )}
              <div className="censorship-status">
                Status: {(settingsStore.fakeCensorshipDisabled || !settingsStore.censorship.enabled) ? 'Disabled' : 'Enabled'}
              </div>
              {(settingsStore.fakeCensorshipDisabled || !settingsStore.censorship.enabled) && <div className="setting-item">
                <button
                  onClick={() => settingsStore.enableCensorship()}
                  className="button-primary"
                >
                  Enable Censorship
                </button>
              </div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};