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
            className="editor-toolbar-button"
            disabled={!editor?.can().undo()}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="h-4 w-4" />
            <span>Undo</span>
          </button>
          <button
            onClick={() => editor?.commands.redo()}
            className="editor-toolbar-button"
            disabled={!editor?.can().redo()}
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 className="h-4 w-4" />
            <span>Redo</span>
          </button>
        </div>
        <div className="editor-toolbar-group">
          <button
            onClick={handleImageClick}
            className="editor-toolbar-button"
            title="Insert Image"
          >
            <ImageIcon className="h-4 w-4" />
            <span>Insert Image</span>
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
            className="editor-toolbar-button"
            title="Insert Link"
          >
            <LinkIcon className="h-4 w-4" />
            <span>Insert Link</span>
          </button>
          <button
            onClick={() => editor?.commands.toggleCensored()}
            className="editor-toolbar-button"
            title="Toggle Censored Text (Ctrl+Alt+X)"
          >
            <EyeOff className="h-4 w-4" />
            <span>Censor Text</span>
          </button>
          <button
            onClick={insertTaskList}
            className="editor-toolbar-button"
            title="Insert Task List"
          >
            <ListChecks className="h-4 w-4" />
            <span>Task List</span>
          </button>
          <button
            onClick={handleParagraphTagging}
            className="editor-toolbar-button"
            title="Add Tags to Paragraph"
          >
            <Tag className="h-4 w-4" />
            <span>Tag Paragraph</span>
          </button>
        </div>
        <div className="editor-toolbar-group">
          <button
            onClick={toggleZenMode}
            className="editor-toolbar-button"
            title={isZenMode ? 'Exit Zen Mode' : 'Enter Zen Mode'}
          >
            <Leaf className="h-4 w-4" />
            <span>Zen Mode</span>
          </button>
          <button
            onClick={openNoteSettings}
            className="editor-toolbar-button"
            title="Note Settings"
          >
            <Settings className="h-4 w-4" />
            <span>Settings</span>
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