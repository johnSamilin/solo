import { FC, useRef, useState } from "react";
import { useStore } from "../../../stores/StoreProvider";
import { isPlugin } from "../../../config";
import { observer } from "mobx-react-lite";
import { ImportMode } from "../../../types";
import { analytics } from "../../../utils/analytics";

export const Data: FC = observer(() => {
  const { notesStore, settingsStore } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMode, setImportMode] = useState<ImportMode>('merge');

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
      const data = await window.bridge?.importFromJoplin(JSON.stringify({}));
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
    if (confirm('Are you sure you want to erase all data? This will clear everything from IndexedDB and cannot be undone!')) {
      try {
        notesStore.freshStart();
        settingsStore.setSettingsOpen(false);
        settingsStore.setToast('All data has been erased successfully', 'success');
      } catch (error) {
        console.error('Error erasing data:', error);
        settingsStore.setToast('Failed to erase all data', 'error');
      }
    }
  };

  return (
    <div className="settings-group">
      <h3>Data Management</h3>
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