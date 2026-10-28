import { useEffect, useRef, useState } from 'react';
import { Editor } from '@tiptap/react';
import { getNativeAPI, isAndroid } from '../../../utils/nativeBridge';
import { useStore } from '../../../stores/StoreProvider';

/** `video-<yyyy-mm-dd-hhmmss>.<ext>` — collisions are de-duplicated natively. */
function makeVideoFileName(mime: string): string {
  const ext = mime.includes('webm') ? 'webm' : 'mp4';
  const now = new Date();
  const y = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  return `video-${y}-${mo}-${d}-${h}${mi}${s}.${ext}`;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read video blob'));
    reader.readAsDataURL(blob);
  });
}

interface ActiveRecording {
  stream: MediaStream;
  recorder: MediaRecorder;
  chunks: Blob[];
  mime: string;
}

export const useVideoMemo = (editor: Editor | null) => {
  const { settingsStore } = useStore();
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const recordingRef = useRef<ActiveRecording | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      recordingRef.current?.stream.getTracks().forEach(t => t.stop());
    };
  }, []);

  const startRecording = async () => {
    if (!editor) return;

    // Native CameraX recording on Android is not wired up yet.
    if (isAndroid) {
      settingsStore.setToast('Video memos are not available on Android yet', 'error');
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      settingsStore.setToast('Camera is not available', 'error');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 640 }, aspectRatio: { ideal: 1 } },
        audio: true,
      });

      // Use the browser default codec (VP8+Opus on Chromium). Explicit codec
      // strings (VP9 / H.264) can silently produce empty or black output on some
      // platforms even when isTypeSupported() reports them as supported.
      const recorder = new MediaRecorder(stream);
      const mime = recorder.mimeType || 'video/webm';

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      // Emit data periodically so a short/interrupted recording still has content.
      recorder.start(1000);

      recordingRef.current = { stream, recorder, chunks, mime };
      setPreviewStream(stream);
      setIsRecording(true);
      setIsPaused(false);
      setRecordingSeconds(0);
      timerRef.current = window.setInterval(() => setRecordingSeconds(s => s + 1), 1000);
    } catch (error) {
      console.error(error);
      settingsStore.setToast('Failed to start recording', 'error');
    }
  };

  const stopRecording = async () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const rec = recordingRef.current;
    recordingRef.current = null;
    setIsRecording(false);
    setIsPaused(false);
    setPreviewStream(null);
    const duration = recordingSeconds * 1000;
    setRecordingSeconds(0);

    if (!rec || !editor) return;

    // Stop the recorder first and wait for it to flush its buffered data (the
    // `dataavailable` + `onstop` events fire asynchronously). Only then stop the
    // tracks — stopping them synchronously right after `stop()` truncates the
    // recording to an empty container.
    await new Promise<void>((resolve) => {
      rec.recorder.onstop = () => resolve();
      rec.recorder.stop();
    });
    rec.stream.getTracks().forEach(t => t.stop());

    const blob = new Blob(rec.chunks, { type: rec.mime });

    if (blob.size === 0) {
      settingsStore.setToast('Nothing was recorded', 'error');
      return;
    }

    const dataUrl = await blobToDataUrl(blob);
    const fileName = makeVideoFileName(rec.mime);

    const api = getNativeAPI();
    if (!api?.uploadVideo) {
      settingsStore.setToast('Video memos are not available on this platform', 'error');
      return;
    }

    const result = await api.uploadVideo(dataUrl, fileName);
    if (!result.success || !result.url) {
      settingsStore.setToast(result.error || 'Failed to save video memo', 'error');
      return;
    }

    const storedName = result.url.replace(/^video:\/\//, '');
    editor
      .chain()
      .focus()
      .setVideoMemo({
        src: result.url,
        fileName: storedName,
        duration,
        createdAt: new Date().toISOString(),
        variant: 'quote',
      })
      .run();
  };

  const pauseRecording = () => {
    if (!isRecording || isPaused) return;
    // MediaRecorder.pause() stops emitting data but keeps the stream alive; the
    // pause gap is not written into the final container.
    recordingRef.current?.recorder.pause();
    setIsPaused(true);
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const resumeRecording = () => {
    if (!isRecording || !isPaused) return;
    recordingRef.current?.recorder.resume();
    setIsPaused(false);
    timerRef.current = window.setInterval(() => setRecordingSeconds(s => s + 1), 1000);
  };

  const togglePause = () => {
    if (isPaused) {
      resumeRecording();
    } else {
      pauseRecording();
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return { isRecording, isPaused, recordingSeconds, previewStream, toggleRecording, togglePause };
};
