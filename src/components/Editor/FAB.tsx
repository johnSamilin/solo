import { Editor } from "@tiptap/react";
import { Undo2, Redo2, ImageIcon, LinkIcon, ListChecks, Minimize2, Maximize2, Leaf, Settings, Tag, Mic, AudioLines, Video, SplitSquareVertical, Highlighter, Eraser } from "lucide-react";
import { FC, useState } from "react";
import { flags } from "../../utils/featureFlags";
import { HIGHLIGHT_COLORS, type HighlightColor } from '../../extensions/TextHighlight';

type FABProps = {
  editor: Editor | null;
  isZenMode: boolean;
  toggleZenMode: () => void;
  isToolbarExpanded: boolean;
  handleImageClick: () => void;
  handleLinkInsert: () => void;
  insertTaskList: () => void;
  handleParagraphTagging: () => void;
  setIsToolbarExpanded: (val: boolean) => void;
  openNoteSettings: () => void;
  handleDictation: () => void;
  isDictating: boolean;
  handleCutIn: () => void;
  handleVoiceMemo: () => void;
  isRecording: boolean;
  recordingSeconds: number;
  handleVideoMemo: () => void;
  isRecordingVideo: boolean;
  recordingVideoSeconds: number;
};

export const FAB: FC<FABProps> = ({
  editor,
  isZenMode,
  toggleZenMode,
  isToolbarExpanded,
  handleImageClick,
  handleLinkInsert,
  insertTaskList,
  handleParagraphTagging,
  setIsToolbarExpanded,
  openNoteSettings,
  handleDictation,
  isDictating,
  handleCutIn,
  handleVoiceMemo,
  isRecording,
  recordingSeconds,
  handleVideoMemo,
  isRecordingVideo,
  recordingVideoSeconds,
}) => {
  const [isHighlightPickerOpen, setIsHighlightPickerOpen] = useState(false);

  const applyHighlight = (color: HighlightColor) => {
    editor?.chain().focus().setTextHighlight(color).run();
    setIsHighlightPickerOpen(false);
    setIsToolbarExpanded(false);
  };

  const removeHighlight = () => {
    editor?.chain().focus().unsetTextHighlight().run();
    setIsHighlightPickerOpen(false);
    setIsToolbarExpanded(false);
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
            onMouseDown={e => e.preventDefault()}
            onClick={e => {
              e.stopPropagation();
              setIsHighlightPickerOpen(open => !open);
            }}
            className="button-icon"
            title="Highlight text"
            aria-label="Highlight text"
            aria-expanded={isHighlightPickerOpen}
          >
            <Highlighter className="h-4 w-4" />
          </button>
          <button
            onClick={handleDictation}
            className={`button-icon ${isDictating ? 'active' : ''}`}
            title="Toggle Speech-to-Text"
          >
            <Mic className="h-4 w-4" />
          </button>
          {flags.voiceMemos && (
            <button
              onClick={handleVoiceMemo}
              className={`button-icon ${isRecording ? 'active recording' : ''}`}
              title={isRecording ? `Recording… ${recordingSeconds}s` : 'Record Voice Memo'}
            >
              <AudioLines className="h-4 w-4" />
            </button>
          )}
          {flags.videoMemos && (
            <button
              onClick={handleVideoMemo}
              className={`button-icon ${isRecordingVideo ? 'active recording' : ''}`}
              title={isRecordingVideo ? `Recording… ${recordingVideoSeconds}s` : 'Record Video Memo'}
            >
              <Video className="h-4 w-4" />
            </button>
          )}
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
      {isHighlightPickerOpen && (
        <div className="highlight-palette" role="group" aria-label="Highlight color">
          {Object.keys(HIGHLIGHT_COLORS).map(color => (
            <button
              key={color}
              type="button"
              className="highlight-swatch"
              data-color={color}
              title={`Highlight ${color}`}
              aria-label={`Highlight ${color}`}
              onMouseDown={e => e.preventDefault()}
              onClick={() => applyHighlight(color as HighlightColor)}
            />
          ))}
          <button
            type="button"
            className="highlight-remove"
            title="Remove highlight"
            aria-label="Remove highlight"
            onMouseDown={e => e.preventDefault()}
            onClick={removeHighlight}
          >
            <Eraser className="h-4 w-4" />
          </button>
        </div>
      )}
      <button
        onClick={() => {
          setIsHighlightPickerOpen(false);
          setIsToolbarExpanded(!isToolbarExpanded);
        }}
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
