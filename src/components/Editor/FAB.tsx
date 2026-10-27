import { Editor } from "@tiptap/react";
import { Undo2, Redo2, ImageIcon, LinkIcon, EyeOff, ListChecks, Minimize2, Maximize2, Leaf, Settings, Tag, Mic, AudioLines, Video, SplitSquareVertical } from "lucide-react";
import { FC, useRef } from "react";
import { flags } from "../../utils/featureFlags";

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