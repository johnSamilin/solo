import { Editor } from "@tiptap/react";
import { Undo2, Redo2, ImageIcon, LinkIcon, EyeOff, ListChecks, Minimize2, Maximize2, Leaf, Settings, Tag } from "lucide-react";
import { FC, useRef } from "react";

type FABProps = {
  editor: Editor | null;
  isZenMode: boolean;
  toggleZenMode: () => void;
  isToolbarExpanded: boolean;
  handleImageUpload: (file: File) => void;
  handleLinkInsert: () => void;
  insertTaskList: () => void;
  handleParagraphTagging: () => void;
  setIsToolbarExpanded: (val: boolean) => void;
  openNoteSettings: () => void;
};

export const FAB: FC<FABProps> = ({
  editor,
  isZenMode,
  toggleZenMode,
  isToolbarExpanded,
  handleImageUpload,
  handleLinkInsert,
  insertTaskList,
  handleParagraphTagging,
  setIsToolbarExpanded,
  openNoteSettings,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
    // Reset input value to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={`editor-toolbar ${isToolbarExpanded ? 'expanded' : ''}`}>
      <div className="toolbar-actions" onClick={() => setIsToolbarExpanded(false)}>
        <div className="editor-toolbar-group">
          <button
            onClick={() => editor?.commands.undo()}
            className="button-icon"
            disabled={!editor?.can().undo()}
            title="Undo (Ctrl+Z)"
          >
            <span>Undo</span>
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor?.commands.redo()}
            className="button-icon"
            disabled={!editor?.can().redo()}
            title="Redo (Ctrl+Shift+Z)"
          >
            <span>Redo</span>
            <Redo2 className="h-4 w-4" />
          </button>
        </div>
        <div className="editor-toolbar-group">
          <button
            onClick={handleImageClick}
            className="button-icon"
            title="Insert Image"
          >
            <span>Insert Image</span>
            <ImageIcon className="h-4 w-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <button
            onClick={handleLinkInsert}
            className="button-icon"
            title="Insert Link"
          >
            <span>Insert Link</span>
            <LinkIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor?.commands.toggleCensored()}
            className="button-icon"
            title="Toggle Censored Text (Ctrl+Alt+X)"
          >
            <span>Toggle Censored</span>
            <EyeOff className="h-4 w-4" />
          </button>
          <button
            onClick={insertTaskList}
            className="button-icon"
            title="Insert Task List"
          >
            <span>Task List</span>
            <ListChecks className="h-4 w-4" />
          </button>
          <button
            onClick={handleParagraphTagging}
            className="button-icon"
            title="Add Tags to Paragraph"
          >
            <span>Tag Paragraph</span>
            <Tag className="h-4 w-4" />
          </button>
        </div>
        <div className="editor-toolbar-group">
          <button
            onClick={toggleZenMode}
            className="button-icon"
            title={isZenMode ? 'Exit Zen Mode' : 'Enter Zen Mode'}
          >
            <span>Zen Mode</span>
            <Leaf className="h-4 w-4" />
          </button>
          <button
            onClick={openNoteSettings}
            className="button-icon"
            title="Note Settings"
          >
            <span>Settings</span>
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>
      <button
        onClick={() => setIsToolbarExpanded(!isToolbarExpanded)}
        className="button-icon toggle-button"
        title="Toggle toolbar"
      >
        {isToolbarExpanded ? (
          <Minimize2 className="h-4 w-4" />
        ) : (
          <Maximize2 className="h-4 w-4" />
        )}
      </button>
    </div>
  );
};