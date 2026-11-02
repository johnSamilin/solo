import { useEffect, useRef, useState } from 'react';
import { Editor } from '@tiptap/react';
import { getNativeAPI, isAndroid } from '../../../utils/nativeBridge';
import { useStore } from '../../../stores/StoreProvider';

const WAV_PEAK_COUNT = 64;

/** Encode a mono Float32 PCM buffer into a 16-bit WAV file. */
function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Uint8Array(buffer);
}

/** Downsample raw samples into `count` normalized peaks (0..1) for the waveform. */
function computePeaks(samples: Float32Array, count: number): number[] {
  const bucket = Math.max(1, Math.floor(samples.length / count));
  const peaks: number[] = [];
  let max = 0;

  for (let i = 0; i < samples.length; i += bucket) {
    let peak = 0;
    for (let j = i; j < Math.min(i + bucket, samples.length); j++) {
      const v = Math.abs(samples[j]);
      if (v > peak) peak = v;
    }
    peaks.push(peak);
    if (peak > max) max = peak;
  }

  if (max === 0) return peaks.map(() => 0);
  return peaks.map(p => p / max);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}

/** `memo-<yyyy-mm-dd-hhmmss>.wav` — collisions are de-duplicated natively. */
function makeFileName(): string {
  const now = new Date();
  const y = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  return `memo-${y}-${mo}-${d}-${h}${mi}${s}.wav`;
}

interface ActiveRecording {
  stop: () => Promise<{ samples: Float32Array; sampleRate: number }>;
}

export const useVoiceMemo = (editor: Editor | null) => {
  const { settingsStore } = useStore();
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingRef = useRef<ActiveRecording | null>(null);
  const timerRef = useRef<number | null>(null);
  const pausedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      recordingRef.current?.stop();
    };
  }, []);

  const startRecording = async () => {
    if (!editor) return;

    // Android: record natively via AudioRecord (WebView getUserMedia is unreliable).
    if (isAndroid) {
      const api = getNativeAPI();
      if (!api?.startRecording) {
        settingsStore.setToast('Voice memos are not available on this platform', 'error');
        return;
      }
      const result = await api.startRecording();
      if (!result.success) {
        settingsStore.setToast(result.error || 'Failed to start recording', 'error');
        return;
      }
      setIsRecording(true);
      setIsPaused(false);
      pausedRef.current = false;
      setRecordingSeconds(0);
      timerRef.current = window.setInterval(() => setRecordingSeconds(s => s + 1), 1000);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      settingsStore.setToast('Microphone is not available', 'error');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Force 16 kHz so the recording matches the Vosk model's native sample
      // rate (the AudioContext resamples the hardware stream internally).
      const ctx = new AudioContext({ sampleRate: 16000 });
      const source = ctx.createMediaStreamSource(stream);
      // ScriptProcessorNode is deprecated but is the most broadly supported way to
      // capture raw PCM in both Chromium (Electron) and Android WebView.
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      const chunks: Float32Array[] = [];

      processor.onaudioprocess = (e) => {
        // Skip frames while paused so the gap is not recorded.
        if (pausedRef.current) return;
        chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
      };

      source.connect(processor);
      processor.connect(ctx.destination);

      const sampleRate = ctx.sampleRate;

      recordingRef.current = {
        stop: async () => {
          processor.onaudioprocess = null;
          try {
            source.disconnect();
            processor.disconnect();
          } catch {
            // already disconnected
          }
          try {
            await ctx.close();
          } catch {
            // already closed
          }
          stream.getTracks().forEach(track => track.stop());

          const length = chunks.reduce((n, c) => n + c.length, 0);
          const samples = new Float32Array(length);
          let offset = 0;
          for (const c of chunks) {
            samples.set(c, offset);
            offset += c.length;
          }
          return { samples, sampleRate };
        },
      };

      setIsRecording(true);
      setIsPaused(false);
      pausedRef.current = false;
      setRecordingSeconds(0);
      timerRef.current = window.setInterval(() => setRecordingSeconds(s => s + 1), 1000);
    } catch {
      settingsStore.setToast('Failed to start recording', 'error');
    }
  };

  const stopRecording = async () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    pausedRef.current = false;
    setIsPaused(false);

    // Android: stop the native recorder, which already writes the WAV file.
    if (isAndroid) {
      setIsRecording(false);
      setRecordingSeconds(0);

      const api = getNativeAPI();
      if (!api?.stopRecording || !editor) return;

      const result = await api.stopRecording();
      if (!result.success || !result.url) {
        settingsStore.setToast(result.error || 'Failed to save voice memo', 'error');
        return;
      }

      const storedName = result.url.replace(/^voice:\/\//, '');
      editor
        .chain()
        .focus()
        .setVoiceMemo({
          src: result.url,
          fileName: storedName,
          duration: result.duration ?? 0,
          createdAt: new Date().toISOString(),
          peaks: [],
          variant: 'quote',
        })
        .run();
      return;
    }

    const rec = recordingRef.current;
    recordingRef.current = null;
    setIsRecording(false);
    setRecordingSeconds(0);

    if (!rec || !editor) return;

    const { samples, sampleRate } = await rec.stop();

    if (samples.length === 0) {
      settingsStore.setToast('Nothing was recorded', 'error');
      return;
    }

    const peaks = computePeaks(samples, WAV_PEAK_COUNT);
    const wav = encodeWav(samples, sampleRate);
    const base64 = bytesToBase64(wav);
    const fileName = makeFileName();

    const api = getNativeAPI();
    if (!api?.uploadAudio) {
      settingsStore.setToast('Voice memos are not available on this platform', 'error');
      return;
    }

    const result = await api.uploadAudio(base64, fileName);
    if (!result.success || !result.url) {
      settingsStore.setToast(result.error || 'Failed to save voice memo', 'error');
      return;
    }

    const duration = Math.round((samples.length / sampleRate) * 1000);
    const storedName = result.url.replace(/^voice:\/\//, '') || fileName;

    editor
      .chain()
      .focus()
      .setVoiceMemo({
        src: result.url,
        fileName: storedName,
        duration,
        createdAt: new Date().toISOString(),
        peaks,
        variant: 'quote',
      })
      .run();
  };

  const pauseRecording = () => {
    if (!isRecording || isPaused) return;
    // Desktop skips frames in the processor (see onaudioprocess) so the pause gap
    // is not recorded. Android pauses the native capture thread via the bridge.
    pausedRef.current = true;
    setIsPaused(true);
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (isAndroid) {
      getNativeAPI()?.pauseRecording?.().catch(() => {});
    }
  };

  const resumeRecording = () => {
    if (!isRecording || !isPaused) return;
    pausedRef.current = false;
    setIsPaused(false);
    timerRef.current = window.setInterval(() => setRecordingSeconds(s => s + 1), 1000);
    if (isAndroid) {
      getNativeAPI()?.resumeRecording?.().catch(() => {});
    }
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

  return { isRecording, isPaused, recordingSeconds, toggleRecording, togglePause };
};
