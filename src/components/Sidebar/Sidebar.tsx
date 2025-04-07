import { Plus, FolderPlus, MoreVertical, Settings, Upload, Download, Menu } from "lucide-react";
import { FC, useState, useEffect, useRef } from "react";
import { observer } from "mobx-react-lite";
import { NotebookItem } from "./NotebookItem";
import { useStore } from "../../stores/StoreProvider";
import { Editor } from "@tiptap/react";
import { isPlugin } from "../../config";

import './Sidebar.css';

type SidebarProps = {
  editor: Editor | null;
};

export const Sidebar: FC<SidebarProps> = observer(({ editor }) => {
  const { notesStore, settingsStore } = useStore();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const toggleButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Handle menu clicks
      if (
        menuRef.current &&
        buttonRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsMenuOpen(false);
      }

      // Handle sidebar clicks when unpinned
      if (
        !settingsStore.settings.sidebarPinned &&
        isSidebarVisible &&
        sidebarRef.current &&
        toggleButtonRef.current &&
        !sidebarRef.current.contains(event.target as Node) &&
        !toggleButtonRef.current.contains(event.target as Node)
      ) {
        setIsSidebarVisible(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSidebarVisible, settingsStore.settings.sidebarPinned]);

  const handleCreateNote = () => {
    notesStore.createNote();
    if (editor) {
      editor.commands.setContent('');
    }
    setIsMenuOpen(false);
  };

  const handleCreateNotebook = () => {
    settingsStore.setNewNotebookModalOpen(true);
    setIsMenuOpen(false);
  };

  const handleOpenSettings = () => {
    settingsStore.setSettingsOpen(true);
    setIsMenuOpen(false);
  };

  const handleBackup = async () => {
    if (!window.bridge?.syncWebDAV) return;
    try {
      const success = await window.bridge.syncWebDAV(JSON.stringify(settingsStore.webDAV));
      settingsStore.setToast(
        success ? 'WebDAV backup completed successfully' : 'WebDAV backup failed',
        success ? 'success' : 'error'
      );
    } catch (error) {
      console.error('Backup failed:', error);
      settingsStore.setToast('WebDAV backup failed', 'error');
    }
    setIsMenuOpen(false);
  };

  const handleRestore = async () => {
    if (!window.bridge?.restoreWebDAV) return;
    try {
      if (!confirm('This will replace all your current data with the latest backup. Are you sure?')) {
        return;
      }

      const success = await window.bridge.restoreWebDAV(JSON.stringify(settingsStore.webDAV));
      if (success) {
        settingsStore.setToast('WebDAV restore completed successfully', 'success');
        notesStore.loadFromStorage();
      } else {
        settingsStore.setToast('WebDAV restore failed - no backups found', 'error');
      }
    } catch (error) {
      alert('Restore failed: ' + error);
      settingsStore.setToast('WebDAV restore failed', 'error');
    }
    setIsMenuOpen(false);
  };

  const toggleSidebar = () => {
    setIsSidebarVisible(!isSidebarVisible);
  };

  const sidebarClasses = [
    'sidebar',
    settingsStore.isZenMode ? 'hidden' : '',
    !settingsStore.settings.sidebarPinned ? 'unpinned' : '',
    isSidebarVisible ? 'visible' : ''
  ].filter(Boolean).join(' ');

  return (
    <>
      {!settingsStore.settings.sidebarPinned && !settingsStore.isZenMode && (
        <button 
          ref={toggleButtonRef}
          className="sidebar-toggle" 
          onClick={toggleSidebar}
        >
          <Menu className="h-4 w-4" />
        </button>
      )}
      <div ref={sidebarRef} className={sidebarClasses}>
        <div className="sidebar-header">
          <div className="relative">
            <button
              ref={buttonRef}
              className="sidebar-menu-button"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Menu"
              aria-expanded={isMenuOpen}
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            {isMenuOpen && (
              <div
                ref={menuRef}
                className="sidebar-dropdown"
                role="menu"
              >
                <button
                  className="sidebar-dropdown-item"
                  onClick={handleCreateNote}
                  role="menuitem"
                >
                  <Plus className="h-4 w-4" />
                  New Note
                </button>
                <button
                  className="sidebar-dropdown-item"
                  onClick={handleCreateNotebook}
                  role="menuitem"
                >
                  <FolderPlus className="h-4 w-4" />
                  New Notebook
                </button>
                {isPlugin && settingsStore.webDAV.enabled && (
                  <>
                    <button
                      className="sidebar-dropdown-item"
                      onClick={handleBackup}
                      role="menuitem"
                    >
                      <Upload className="h-4 w-4" />
                      Backup to WebDAV
                    </button>
                    <button
                      className="sidebar-dropdown-item"
                      onClick={handleRestore}
                      role="menuitem"
                    >
                      <Download className="h-4 w-4" />
                      Restore from WebDAV
                    </button>
                  </>
                )}
                <button
                  className="sidebar-dropdown-item"
                  onClick={handleOpenSettings}
                  role="menuitem"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="notebooks-list">
          {notesStore.notebooks
            .filter(notebook => notebook.parentId === null)
            .map(notebook => (
              <NotebookItem
                key={notebook.id}
                notebook={notebook}
                editor={editor}
              />
            ))}
        </div>
      </div>
    </>
  );
});