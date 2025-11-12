import { Editor } from "@tiptap/react";
import { Undo2, Redo2, ImageIcon, LinkIcon, EyeOff, ListChecks, Minimize2, Maximize2, Leaf, Settings, Tag, Mic, SplitSquareVertical } from "lucide-react";
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
  handleDictation: () => void;
  isDictating: boolean;
  handleCutIn: () => void;
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
  handleDictation,
  isDictating,
  handleCutIn,
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
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor?.commands.redo()}
            className="button-icon"
            disabled={!editor?.can().redo()}
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 className="h-4 w-4" />
          </button>
        </div>
        <div className="editor-toolbar-group">
          <button
            onClick={handleImageClick}
            className="button-icon"
            title="Insert Image"
          >
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
            <LinkIcon className="h-4 w-4" />
          </button>
          <button
            onClick={insertTaskList}
            className="button-icon"
            title="Insert Task List"
          >
            <ListChecks className="h-4 w-4" />
          </button>
          <button
            onClick={handleParagraphTagging}
            className="button-icon"
            title="Add Tags to Paragraph"
          >
            <Tag className="h-4 w-4" />
          </button>
          <button
            onClick={handleDictation}
            className={`button-icon ${isDictating ? 'active' : ''}`}
            title="Toggle Speech-to-Text"
          >
            <Mic className="h-4 w-4" />
          </button>
          <button
            onClick={handleCutIn}
            className="button-icon"
            title="Insert Cut-in"
          >
            <SplitSquareVertical className="h-4 w-4" />
          </button>
        </div>
        <div className="editor-toolbar-group">
          <button
            onClick={toggleZenMode}
            className="button-icon"
            title={isZenMode ? 'Exit Zen Mode' : 'Enter Zen Mode'}
          >
            <Leaf className="h-4 w-4" />
          </button>
          <button
            onClick={openNoteSettings}
            className="button-icon"
            title="Note Settings"
          >
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