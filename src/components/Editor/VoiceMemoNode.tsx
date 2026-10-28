import { NodeViewWrapper } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import type { Node } from '@tiptap/pm/model';
import { FC, useEffect, useRef, useState } from 'react';
import { Play, Pause, Trash2, FileText, MoreVertical } from 'lucide-react';
import { VoiceMemoAttributes } from '../../extensions/VoiceMemo';
import { transcribeVoiceMemo } from './hooks/useTranscription';
import { getNativeAPI } from '../../utils/nativeBridge';
import './VoiceMemo.css';

interface VoiceMemoNodeProps {
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

const formatDate = (iso: string | null): string => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const VoiceMemoNode: FC<VoiceMemoNodeProps> = ({ node, editor, getPos, deleteNode }) => {
  const { src, duration, fileName, createdAt, peaks, variant } = node.attrs as VoiceMemoAttributes;

  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(duration || 0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => setCurrentTime(audio.currentTime * 1000);
    const onMeta = () => {
      if (audio.duration && Number.isFinite(audio.duration)) {
        setAudioDuration(audio.duration * 1000);
      }
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnd = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnd);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnd);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().catch(() => {
        setError('Unable to play audio');
      });
    } else {
      audio.pause();
    }
  };

  const seekTo = (ratio: number) => {
    const audio = audioRef.current;
    if (!audio || !audioDuration) return;
    const clamped = Math.min(1, Math.max(0, ratio));
    audio.currentTime = clamped * (audioDuration / 1000);
    setCurrentTime(audio.currentTime * 1000);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    seekTo(ratio);
  };

  const handleTranscribe = async () => {
    if (isTranscribing) return;
    setIsTranscribing(true);
    setError('');
    try {
      const text = await transcribeVoiceMemo(fileName);
      const pos = getPos();
      editor
        .chain()
        .focus()
        .insertContentAt(pos + node.nodeSize, {
          type: 'blockquote',
          attrs: { voiceTranscript: fileName },
          content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
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
    getNativeAPI()?.deleteAsset?.(`voice://${fileName}`).catch(() => {});
    deleteNode();
    setIsMenuOpen(false);
  };

  const progress = audioDuration > 0 ? Math.min(1, currentTime / audioDuration) : 0;

  const PlayButton = () => (
    <button
      className={`voice-memo-play ${isPlaying ? 'playing' : ''}`}
      onClick={togglePlay}
      title={isPlaying ? 'Pause' : 'Play'}
    >
      {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
    </button>
  );

  const Menu = () => (
    <div className="voice-memo-menu-wrap">
      <button
        className="voice-memo-menu-btn"
        onClick={() => setIsMenuOpen(v => !v)}
        title="Menu"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {isMenuOpen && (
        <div className="voice-memo-menu">
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
  );

  const Waveform = ({ interactive = false }: { interactive?: boolean }) => {
    const bars = peaks && peaks.length ? peaks : Array.from({ length: 40 }, () => 0.3);
    const playedCount = Math.floor(progress * bars.length);
    return (
      <div
        className={`voice-memo-waveform ${interactive ? 'interactive' : ''}`}
        onClick={interactive ? handleSeek : undefined}
      >
        {bars.map((peak, i) => (
          <span
            key={i}
            className={`voice-memo-bar ${i < playedCount ? 'played' : ''}`}
            style={{ height: `${Math.max(8, Math.round(peak * 100))}%` }}
          />
        ))}
      </div>
    );
  };

  const renderVariant = () => {
    switch (variant) {
      case 'waveform':
        return (
          <>
            <PlayButton />
            <Waveform interactive />
            <span className="voice-memo-time">{formatTime(audioDuration)}</span>
            <Menu />
          </>
        );
      case 'chip':
        return (
          <>
            <PlayButton />
            <span className="voice-memo-time">{formatTime(currentTime)} / {formatTime(audioDuration)}</span>
            <Menu />
          </>
        );
      case 'quote':
        return (
          <>
            <PlayButton />
            <div className="voice-memo-quote-body">
              <Waveform />
              <div className="voice-memo-meta">
                {formatDate(createdAt) && <span>{formatDate(createdAt)}</span>}
                <span>{formatTime(audioDuration)}</span>
              </div>
            </div>
            <Menu />
          </>
        );
      case 'card':
        return (
          <>
            <PlayButton />
            <div className="voice-memo-card-body">
              <div className="voice-memo-meta">
                <span>{formatTime(audioDuration)}</span>
                {formatDate(createdAt) && <span>{formatDate(createdAt)}</span>}
              </div>
              <div className="voice-memo-progress" onClick={handleSeek}>
                <div className="voice-memo-progress-fill" style={{ width: `${progress * 100}%` }} />
              </div>
            </div>
            <Menu />
          </>
        );
      case 'compact':
      default:
        return (
          <>
            <PlayButton />
            <div className="voice-memo-progress" onClick={handleSeek}>
              <div className="voice-memo-progress-fill" style={{ width: `${progress * 100}%` }} />
            </div>
            <span className="voice-memo-time">
              {formatTime(currentTime)} / {formatTime(audioDuration)}
            </span>
            <Menu />
          </>
        );
    }
  };

  return (
    <NodeViewWrapper>
      <div className={`voice-memo variant-${variant}`}>
        <audio ref={audioRef} src={src} preload="metadata" />
        {renderVariant()}
      </div>
      {error && <div className="voice-memo-error">{error}</div>}
    </NodeViewWrapper>
  );
};
