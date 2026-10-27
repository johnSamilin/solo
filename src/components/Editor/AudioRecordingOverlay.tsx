import { FC } from 'react';
import { Square } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import './AudioRecordingOverlay.css';

interface AudioRecordingOverlayProps {
  seconds: number;
  onStop: () => void;
}

const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

/**
 * A minimal overlay shown while recording a voice memo: a "recording" label, a
 * timer and a stop button.
 */
export const AudioRecordingOverlay: FC<AudioRecordingOverlayProps> = ({ seconds, onStop }) => {
  const { t } = useI18n();

  return (
    <div className="audio-recording-overlay">
      <div className="audio-recording-card">
        <span className="audio-recording-dot" />
        <div className="audio-recording-text">{t.editor.recording}</div>
        <div className="audio-recording-timer">{formatTime(seconds)}</div>
        <button className="audio-recording-stop" onClick={onStop} title={t.editor.stop}>
          <Square className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};
