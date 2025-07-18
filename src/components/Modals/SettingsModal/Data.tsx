import { FC, useRef, useState } from "react";
import { FolderOpen } from "lucide-react";
import { useStore } from "../../../stores/StoreProvider";
import { isPlugin } from "../../../config";
import { observer } from "mobx-react-lite";
import { ImportMode } from "../../../types";
import { analytics } from "../../../utils/analytics";
import { isFilesystemStoringAvailable } from "../../../Features";

export const Data: FC = observer(() => {
  const { notesStore, settingsStore } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMode, setImportMode] = useState<ImportMode>('merge');
  
  // Check if filesystem storing is available
  const filesystemStoringAvailable = isFilesystemStoringAvailable();

  const handleExport = async () => {
    const data = {
      notes: notesStore.notes,
      notebooks: notesStore.notebooks
    };
    if (isPlugin) {
      const folder = await window.bridge?.pickExportFolder() ?? '';
      settingsStore.exportPath = folder ?? '';
      if (folder !== '')  {
        window.bridge?.exportData(JSON.stringify(data), folder);
      }
      analytics.dataExported();
      return;
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `solo-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    analytics.dataExported();
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleJoplinImport = async () => {
    try {
      const data = await window.bridge?.importFromJoplin(JSON.stringify(settingsStore.webDAV));
      if (data) {
        notesStore.importData(data, importMode);
        settingsStore.setImportStatus('success');
      }
    } catch (error) {
      console.error('Error importing Joplin data:', error);
      settingsStore.setImportStatus('error');
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (!data.notes || !data.notebooks) {
        throw new Error('Invalid file format');
      }

      notesStore.importData(data, importMode);
      settingsStore.setImportStatus('success');
    } catch (error) {
      console.error('Error importing data:', error);
      settingsStore.setImportStatus('error');
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFreshStart = () => {
    if (confirm('Are you sure you want to erase all data? This action cannot be undone!')) {
      notesStore.freshStart();
      settingsStore.setSettingsOpen(false);
    }
  };

  const handlePickFolder = async () => {
    try {
      // @ts-ignore - File System API types might not be available
      const directoryHandle = await window.showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'documents'
      });
      
      settingsStore.updateSettings({
        localImageStoragePath: directoryHandle.name
      });
      
      settingsStore.setToast('Folder selected successfully', 'success');
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error picking folder:', error);
        settingsStore.setToast('Failed to select folder', 'error');
      }
    }
  };

  return (
    <div className="settings-group">
      <h3>Data Management</h3>
      {filesystemStoringAvailable && (
        <>
          <div className="setting-item">
            <label>Store Images Locally</label>
            <input
              type="checkbox"
              checked={settingsStore.settings.storeImagesLocally}
              onChange={(e) => settingsStore.updateSettings({ 
                storeImagesLocally: e.target.checked 
              })}
            />
          </div>
          {settingsStore.settings.storeImagesLocally && (
            <div className="setting-item">
              <label>Storage Folder</label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="text"
                  value={settingsStore.settings.localImageStoragePath || 'No folder selected'}
                  readOnly
                  style={{ 
                    flex: 1, 
                    backgroundColor: '#f5f5f5',
                    color: settingsStore.settings.localImageStoragePath ? '#333' : '#999'
                  }}
                />
                <button 
                  onClick={handlePickFolder}
                  className="button-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <FolderOpen className="h-4 w-4" />
                  Pick Folder
                </button>
              </div>
            </div>
          )}
        </>
      )}
      {!filesystemStoringAvailable && (
        <div className="import-status error">
          File System API is not supported in this browser. Local image storage is only available in Chrome, Edge, and other Chromium-based browsers.
        </div>
      )}
      <div className="setting-item">
        <label>Export Data</label>
        <button onClick={handleExport} className="button-primary">
          Export
        </button>
      </div>
      <div className="setting-item">
        <label>Import Mode</label>
        <select 
          value={importMode} 
          onChange={(e) => setImportMode(e.target.value as ImportMode)}
          className="import-mode-select"
        >
          <option value="merge">Merge with existing data</option>
          <option value="replace">Replace existing data</option>
        </select>
      </div>
      <div className="setting-item">
        <label>Import Solo Data</label>
        <button onClick={handleImport} className="button-primary">
          Import Solo File
        </button>
      </div>
      {isPlugin && (
        <div className="setting-item">
          <label>Import from Joplin</label>
          <button onClick={handleJoplinImport} className="button-primary">
            Import Joplin Database
          </button>
        </div>
      )}
      <div className="setting-item">
        <label>Fresh Start</label>
        <button onClick={handleFreshStart} className="button-danger">
          Erase All Data
        </button>
      </div>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept=".json"
        style={{ display: 'none' }}
      />
      {settingsStore.importStatus === 'success' && (
        <div className="import-status success">Data imported successfully!</div>
      )}
      {settingsStore.importStatus === 'error' && (
        <div className="import-status error">Error importing data. Please check the file format.</div>
      )}
      <div>
        {settingsStore.exportPath !== ''
          ? `Exported ${notesStore.notes.length} notes in ${notesStore.notebooks.length} notebooks to ${settingsStore.exportPath}`
          : ''}
      </div>
    </div>
  );
});