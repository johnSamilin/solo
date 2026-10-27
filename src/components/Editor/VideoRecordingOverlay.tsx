import { FC, useEffect, useRef } from 'react';
import { Square } from 'lucide-react';
import './VideoRecordingOverlay.css';

interface VideoRecordingOverlayProps {
  stream: MediaStream;
  seconds: number;
  onStop: () => void;
}

/**
 * A full-screen overlay shown while recording a video memo: a live, square,
 * mirror-front camera preview plus a stop button and timer.
 */
export const VideoRecordingOverlay: FC<VideoRecordingOverlayProps> = ({ stream, seconds, onStop }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

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
      <div className="video-recording-controls">
        <span className="video-recording-timer">{seconds}s</span>
        <button className="video-recording-stop" onClick={onStop} title="Stop recording">
          <Square className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};
