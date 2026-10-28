import { FC, useEffect, useRef } from 'react';
import { Square, Pause, Play } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import './VideoRecordingOverlay.css';

interface VideoRecordingOverlayProps {
  stream: MediaStream;
  seconds: number;
  paused: boolean;
  onTogglePause: () => void;
  onStop: () => void;
}

/**
 * A full-screen overlay shown while recording a video memo: a live, square,
 * mirror-front camera preview plus a timer and pause/resume + stop controls.
 */
export const VideoRecordingOverlay: FC<VideoRecordingOverlayProps> = ({
  stream,
  seconds,
  paused,
  onTogglePause,
  onStop,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { t } = useI18n();

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    video.play().catch(() => {});
    return () => {
      video.pause();
      video.srcObject = null;
    };
  }, [stream]);

  return (
    <div className="video-recording-overlay">
      <video ref={videoRef} muted playsInline className="video-recording-preview" />
      {paused && <div className="video-recording-paused">{t.editor.paused}</div>}
      <div className="video-recording-controls">
        <span className="video-recording-timer">{seconds}s</span>
        <button
          className="video-recording-pause"
          onClick={onTogglePause}
          title={paused ? t.editor.resume : t.editor.pause}
        >
          {paused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
        </button>
        <button className="video-recording-stop" onClick={onStop} title={t.editor.stop}>
          <Square className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};
