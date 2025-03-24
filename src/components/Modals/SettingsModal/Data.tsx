import { FC } from "react";
import { useStore } from "../../../stores/StoreProvider";
import { isPlugin } from "../../../config";
import { observer } from "mobx-react-lite";

export const Data: FC = observer(() => {
  const { notesStore, settingsStore } = useStore();

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
      <div>
        {settingsStore.exportPath !== ''
          ? `Exported ${notesStore.notes.length} notes in ${notesStore.notebooks.length} notebooks to ${settingsStore.exportPath}`
          : ''}
      </div>
    </div>
  );
});