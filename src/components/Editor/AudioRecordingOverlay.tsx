import { FC } from 'react';
import { Square, Pause, Play } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import './AudioRecordingOverlay.css';

interface AudioRecordingOverlayProps {
  seconds: number;
  paused: boolean;
  onTogglePause: () => void;
  onStop: () => void;
}

const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

/**
 * A minimal overlay shown while recording a voice memo: a "recording" label, a
 * timer, and pause/resume + stop controls.
 */
export const AudioRecordingOverlay: FC<AudioRecordingOverlayProps> = ({
  seconds,
  paused,
  onTogglePause,
  onStop,
}) => {
  const { t } = useI18n();

  return (
    <div className="audio-recording-overlay">
      <div className="audio-recording-card">
        <span className={`audio-recording-dot ${paused ? 'paused' : ''}`} />
        <div className="audio-recording-text">{paused ? t.editor.paused : t.editor.recording}</div>
        <div className="audio-recording-timer">{formatTime(seconds)}</div>
        <div className="audio-recording-actions">
          <button
            className="audio-recording-pause"
            onClick={onTogglePause}
            title={paused ? t.editor.resume : t.editor.pause}
          >
            {paused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
          </button>
          <button className="audio-recording-stop" onClick={onStop} title={t.editor.stop}>
            <Square className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
