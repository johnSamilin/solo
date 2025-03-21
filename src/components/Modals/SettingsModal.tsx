import { X } from "lucide-react";
import { FC, useState } from "react";
import { TypographySettings } from "../../types";
import { useStore } from "../../stores/StoreProvider";
import { themes } from "../../constants";

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

  const handleThemeChange = (themeKey: string) => {
    const theme = themes[themeKey];
    if (theme) {
      setSettings(theme.settings);
    }
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
                <h3>Theme</h3>
                <div className="setting-item">
                  <label>Select Theme</label>
                  <select
                    onChange={(e) => handleThemeChange(e.target.value)}
                    className="theme-select"
                  >
                    <option key="Air" value="Air">Custom</option>
                    {Object.entries(themes).map(([key, theme]) => (
                      <option key={key} value={key}>
                        {theme.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="settings-group">
                <h3>Editor</h3>
                <div className="setting-item">
                  <label>Font Family</label>
                  <select
                    value={settings.editorFontFamily}
                    onChange={(e) => setSettings({ ...settings, editorFontFamily: e.target.value })}
                  >
                    <option value="GNU Typewriter">GNU Typewriter</option>
                    <option value="Crimson Pro">Crimson Pro</option>
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
                <h3>Layout</h3>
                <div className="setting-item">
                  <label>Page Margins</label>
                  <select
                    value={settings.pageMargins}
                    onChange={(e) => setSettings({ ...settings, pageMargins: e.target.value })}
                  >
                    <option value="1rem">Narrow</option>
                    <option value="2rem">Medium</option>
                    <option value="3rem">Wide</option>
                  </select>
                </div>
                <div className="setting-item">
                  <label>Maximum Width</label>
                  <select
                    value={settings.maxEditorWidth}
                    onChange={(e) => setSettings({ ...settings, maxEditorWidth: e.target.value })}
                  >
                    <option value="50%">Narrow</option>
                    <option value="60%">Medium</option>
                    <option value="75%">Wide</option>
                    <option value="90%">Very Wide</option>
                  </select>
                </div>
                <div className="setting-item">
                  <label>Paragraph Spacing</label>
                  <select
                    value={settings.paragraphSpacing}
                    onChange={(e) => setSettings({ ...settings, paragraphSpacing: e.target.value })}
                  >
                    <option value="0.5em">Tight</option>
                    <option value="1em">Normal</option>
                    <option value="1.5em">Relaxed</option>
                  </select>
                </div>
                <div className="setting-item">
                  <label>Enable Drop Caps</label>
                  <input
                    type="checkbox"
                    checked={settings.enableDropCaps}
                    onChange={(e) => setSettings({ ...settings, enableDropCaps: e.target.checked })}
                  />
                </div>
                {settings.enableDropCaps && (
                  <>
                    <div className="setting-item">
                      <label>Drop Cap Size</label>
                      <select
                        value={settings.dropCapSize}
                        onChange={(e) => setSettings({ ...settings, dropCapSize: e.target.value })}
                      >
                        <option value="2.5em">Small</option>
                        <option value="3.5em">Medium</option>
                        <option value="4.5em">Large</option>
                      </select>
                    </div>
                    <div className="setting-item">
                      <label>Drop Cap Line Height</label>
                      <select
                        value={settings.dropCapLineHeight}
                        onChange={(e) => setSettings({ ...settings, dropCapLineHeight: e.target.value })}
                      >
                        <option value="2.5">Compact</option>
                        <option value="3.5">Normal</option>
                        <option value="4.5">Spacious</option>
                      </select>
                    </div>
                  </>
                )}
              </div>
              <div className="settings-group">
                <h3>Title</h3>
                <div className="setting-item">
                  <label>Font Family</label>
                  <select
                    value={settings.titleFontFamily}
                    onChange={(e) => setSettings({ ...settings, titleFontFamily: e.target.value })}
                  >
                    <option value="GNU Typewriter">GNU Typewriter</option>
                    <option value="Crimson Pro">Crimson Pro</option>
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
                    <option value="GNU Typewriter">GNU Typewriter</option>
                    <option value="Crimson Pro">Crimson Pro</option>
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