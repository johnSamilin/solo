import { getNativeAPI } from '../../../utils/nativeBridge';

/**
 * Runs on-device transcription of an audio file stored in `assets/voice/`.
 * Returns the transcript text, or throws on failure.
 *
 * Both platforms use the native bridge's `transcribeAudio`:
 * - Android: the Vosk AAR in the Kotlin bridge.
 * - Desktop: the Vosk node bindings in the Electron main process.
 *
 * In a plain browser (e.g. `npm run dev` opened in Chrome) there is no bridge,
 * so transcription is reported as unavailable.
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

  const text = result.text?.trim();
  if (!text) {
    throw new Error('Transcription returned no text');
  }

  return text;
}
