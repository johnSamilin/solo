import { NodeViewWrapper } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import type { Node } from '@tiptap/pm/model';
import { FC, useRef, useState } from 'react';
import { Play, Pause, Trash2, FileText, MoreVertical } from 'lucide-react';
import { VideoMemoAttributes } from '../../extensions/VideoMemo';
import { transcribeVideoMemo } from './hooks/useTranscription';
import { getNativeAPI } from '../../utils/nativeBridge';
import './VideoMemo.css';

interface VideoMemoNodeProps {
  node: Node;
  editor: Editor;
  getPos: () => number;
  deleteNode: () => void;
}

const formatTime = (ms: number): string => {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export const VideoMemoNode: FC<VideoMemoNodeProps> = ({ node, editor, getPos, deleteNode }) => {
  const { src, fileName, duration, poster, variant } = node.attrs as VideoMemoAttributes;

  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState('');

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => setError('Unable to play video'));
    } else {
      video.pause();
    }
  };

  const handleTranscribe = async () => {
    if (isTranscribing) return;
    setIsTranscribing(true);
    setError('');
    try {
      const text = await transcribeVideoMemo(fileName);
      const pos = getPos();
      editor
        .chain()
        .focus()
        .insertContentAt(pos + node.nodeSize, {
          type: 'paragraph',
          attrs: { voiceTranscript: fileName },
          content: [{ type: 'text', text }],
        })
        .run();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsTranscribing(false);
      setIsMenuOpen(false);
    }
  };

  const handleDelete = () => {
    // Remove the file on disk as well (not just the node).
    getNativeAPI()?.deleteAsset?.(`video://${fileName}`).catch(() => {});
    deleteNode();
    setIsMenuOpen(false);
  };

  return (
    <NodeViewWrapper>
      <div className={`video-memo variant-${variant}`}>
        <div className="video-memo-frame">
          <video
            ref={videoRef}
            src={src}
            poster={poster || undefined}
            preload="metadata"
            playsInline
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />
          <button
            className={`video-memo-play ${isPlaying ? 'playing' : ''}`}
            onClick={togglePlay}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </button>
          <span className="video-memo-duration">{formatTime(duration)}</span>
        </div>

        <div className="video-memo-menu-wrap">
          <button className="video-memo-menu-btn" onClick={() => setIsMenuOpen(v => !v)} title="Menu">
            <MoreVertical className="h-4 w-4" />
          </button>
          {isMenuOpen && (
            <div className="video-memo-menu">
              <button onClick={handleTranscribe} disabled={isTranscribing}>
                <FileText className="h-4 w-4" />
                {isTranscribing ? 'Transcribing…' : 'Transcribe'}
              </button>
              <button onClick={handleDelete} className="danger">
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
      {error && <div className="video-memo-error">{error}</div>}
    </NodeViewWrapper>
  );
};
