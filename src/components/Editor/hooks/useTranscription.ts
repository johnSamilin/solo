import { getNativeAPI } from '../../../utils/nativeBridge';
import { punctuate } from '../../../utils/transcription/punctuate';

/**
 * Runs on-device transcription of an audio file stored in `assets/voice/`,
 * then restores punctuation & capitalization from word timings + prosody.
 * Returns the final text, or throws on failure.
 */
export async function transcribeVoiceMemo(fileName: string): Promise<string> {
  const api = getNativeAPI();
  if (!api?.transcribeAudio) {
    throw new Error('Transcription is not available on this platform');
  }

  const result = await api.transcribeAudio(fileName);
  if (!result.success) {
    throw new Error(result.error || 'Transcription failed');
  }

  const raw = result.text?.trim();
  if (!raw) {
    throw new Error('Transcription returned no text');
  }

  return punctuate(raw, result.words, result.prosody);
}

/**
 * Transcribes a video memo by first extracting its audio track (option B: no
 * separate audio file is kept — the audio is pulled from the video on demand).
 * Returns the final, punctuated text.
 */
export async function transcribeVideoMemo(fileName: string): Promise<string> {
  const api = getNativeAPI();
  if (!api?.transcribeAudio || !api?.uploadAudio) {
    throw new Error('Transcription is not available on this platform');
  }

  const { samples, sampleRate } = await extractVideoAudioPcm(`video://${fileName}`);
  if (samples.length === 0) {
    throw new Error('Video has no audio track');
  }

  const wav = encodeWav(samples, sampleRate);
  const base64 = bytesToBase64(wav);
  const tempName = `video-transcript-${Date.now()}.wav`;

  const uploadResult = await api.uploadAudio(base64, tempName);
  if (!uploadResult.success || !uploadResult.url) {
    throw new Error(uploadResult.error || 'Failed to save extracted audio');
  }
  const tempFileName = uploadResult.url.replace(/^voice:\/\//, '');

  // Reuse the existing voice transcription path.
  return transcribeVoiceMemo(tempFileName);
}

/**
 * Extracts the audio track of a video (served by `video://`) into raw PCM by
 * playing it through the Web Audio API (real-time, fine for short memos).
 */
async function extractVideoAudioPcm(
  src: string,
): Promise<{ samples: Float32Array; sampleRate: number }> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let ctx: AudioContext | null = null;
    let source: MediaElementAudioSourceNode | null = null;
    let processor: ScriptProcessorNode | null = null;
    const chunks: Float32Array[] = [];

    const cleanup = () => {
      if (processor) {
        processor.onaudioprocess = null;
        try {
          processor.disconnect();
        } catch {
          // already disconnected
        }
      }
      if (source) {
        try {
          source.disconnect();
        } catch {
          // already disconnected
        }
      }
      if (ctx) {
        ctx.close().catch(() => {});
      }
    };

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      if (error) {
        cleanup();
        reject(error);
        return;
      }
      let length = 0;
      for (const c of chunks) length += c.length;
      const samples = new Float32Array(length);
      let offset = 0;
      for (const c of chunks) {
        samples.set(c, offset);
        offset += c.length;
      }
      const sampleRate = ctx?.sampleRate || 16000;
      cleanup();
      resolve({ samples, sampleRate });
    };

    const audio = new Audio();
    audio.preload = 'auto';
    audio.src = src;

    audio.onerror = () => finish(new Error('Failed to load video audio'));
    audio.oncanplay = () => {
      ctx = new AudioContext({ sampleRate: 16000 });
      source = ctx.createMediaElementSource(audio);
      processor = ctx.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = (e) => {
        chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
        e.outputBuffer.getChannelData(0).fill(0);
      };
      source.connect(processor);
      processor.connect(ctx.destination);

      audio.onended = () => finish();
      audio.play().catch((err) => finish(err as Error));
    };

    setTimeout(() => finish(new Error('Timed out extracting video audio')), 60000);
  });
}

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
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Uint8Array(buffer);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}
