# Video Memos — Architecture

> Design doc. Design only — implementation is out of scope for this document.

## Goal

Add video memos to Solo: record a short square (1:1) video directly from a note,
analogous to voice memos, but as a **square mini-video** instead of Telegram's
round "circle". The video is inserted into the note as a block, plays back inline,
and can be transcribed (from its audio track) by the same on-device pipeline used
for voice.

## Key Constraints (inherited from voice memos)

1. **No external runtime** (no `ffmpeg`) — capture/encoding only with the stock
   WebView/Chromium or native Kotlin.
2. **Three platforms, one storage model.** Assets already live in `<root>/assets/`
   and are addressed via custom protocols (`image://`, `voice://`). Video goes in
   `<root>/assets/video/` and is addressed via `video://`.
3. **Privacy / offline.** Everything on-device, no cloud.

We reuse what already exists from voice memos: the TipTap node pattern, the
protocol pattern, the record/read bridge methods, on-device transcription, the FAB
toolbar, and the flags.

## User Flow

1. A "Video memo" button appears in the FAB next to "Voice memo".
2. Clicking opens a camera preview (a 1:1 square) with a record button; clicking
   again stops.
3. The recorded clip (`.mp4`, square) is saved via the bridge into
   `<root>/assets/video/`, returning `video://<fileName>`; the first frame is also
   captured as a poster/thumbnail.
4. An atomic TipTap `videoMemo` block is inserted at the cursor.
5. The block plays back inline (`<video>` with a poster); a context menu offers
   **Transcribe** and **Delete**.
6. "Transcribe" runs the audio track through the existing transcriber and inserts
   the result as a `<p data-voice-transcript>` paragraph after the block.

## 1. Recording (square video)

The key difference from audio is camera access and fitting the frame to 1:1.

### Desktop (Electron)

`getUserMedia` + `MediaRecorder` (like audio, but with video):

```ts
const stream = await navigator.mediaDevices.getUserMedia({
  video: { width: { ideal: 640 }, height: { ideal: 640 }, aspectRatio: { ideal: 1 } },
  audio: true,
});
const recorder = new MediaRecorder(stream, { mimeType: pickMime() });
```

- The square is achieved by requesting `width=height=640` + `aspectRatio: 1` — the
  browser crops/fits the frame.
- `pickMime()` selects `video/mp4` (Chromium 126+, available in Electron 39),
  otherwise falls back to `video/webm`.

### Android (native layer)

`getUserMedia` for video in WebView is even more unreliable than for audio, so —
**native capture** (like `AudioRecorder` for audio):

- **CameraX** (`PreviewView` + `VideoCapture` + `Recorder`) with
  `AspectRatio.RATIO_1_1` — the easiest way to get a square and `mp4`. Fallback —
  `Camera2` + `MediaRecorder` (`VideoSource.SURFACE`).
- The preview is shown in an overlay over the WebView (a native `PreviewView`,
  square, centered).
- Permissions: `CAMERA` + `RECORD_AUDIO` (runtime), analogous to the already-added
  `RECORD_AUDIO` in `MainActivity`.

### Encoding and size

- Container: `.mp4` (H.264/AAC) — universal; on desktop, fall back to `webm` if
  `MediaRecorder` doesn't support mp4.
- Square, moderate resolution (480×480 or 640×640), ~1 Mbps → ≈ 7.5 MB/min (video
  is notably "heavier" than audio — see risks).

## 2. Storage format

- Path: `<root>/assets/video/` (a `video` subfolder inside `assets/`).
- Name: `video-<yyyy-mm-dd-hhmmss>.mp4` (de-duplicated via `buildUniqueAssetName`).
- MIME: `video/mp4` (or `video/webm`). Protocol: `video://<fileName>`.
- Poster: a separate `video-<...>.jpg` next to it (or take the first frame from
  `<video preload="metadata">` — then no separate file is needed).

## 3. Preview / poster

To make the block look like a "mini-video", a first frame is needed:

- **Android** — `MediaMetadataRetriever.getFrameAtTime(0)` → JPEG in `assets/video/`.
- **Desktop** — `<video>` + `<canvas>` to capture the first frame after metadata
  loads.
- Simpler, without an extra file: `<video preload="metadata" muted playsinline>`
  shows the first frame as the poster on its own. Recommendation — start with this,
  add a dedicated poster only if needed.

## 4. Playback

- `<video src="video://…" poster="…" preload="metadata" playsinline>`.
- The `video://` protocol resolves to `<root>/assets/video/` — mirroring `voice://`:
  - Electron: `protocol.handle('video')` + `registerSchemesAsPrivileged`.
  - Android: a branch in `shouldInterceptRequest` + `readVideoAsset` + mime.
- Seeking has the same `Range` risks as `voice://` (see risks).

## 5. Transcribing the audio track

Reuse the existing on-device transcriber (koffi/AAR). We only need to obtain PCM
from the video. Two options:

- **A. Write a separate WAV in parallel** (like a voice memo) during video
  recording: trivially reuses the existing audio pipeline, but duplicates the audio
  (muxed in the video + a separate WAV). Simple and reliable.
- **B. Extract audio from the mp4 after recording**: Android — `MediaExtractor`
  (easy), Desktop — demux in the renderer (`mp4box.js` / decode via `<audio>` +
  Web Audio). Cleaner storage, but needs a demuxer.

**Recommendation:** A for the first iteration (maximum reuse), B as a storage
optimization later. The result is inserted as the same `<p data-voice-transcript>`.

## 6. Data model (TipTap node)

An atomic `videoMemo` block after the `voiceMemo` pattern (`ReactNodeViewRenderer`):

```ts
addAttributes() {
  return {
    src:       { default: '' },   // video://video-....mp4
    fileName:  { default: '' },   // video-....mp4
    duration:  { default: 0 },    // ms
    createdAt: { default: null }, // ISO
    poster:    { default: '' },   // video://video-....jpg (optional)
    variant:   { default: 'compact' },
  };
}
```

Serialization (analogous to `data-type="voice-memo"`):

```html
<div data-type="video-memo"
     data-src="video://video-2026-10-27-123456.mp4"
     data-file-name="video-2026-10-27-123456.mp4"
     data-duration="4200"
     data-created-at="2026-10-27T12:34:56.000Z"
     data-poster="video://video-2026-10-27-123456.jpg">
  <!-- fallback for static export -->
  <video src="video://video-2026-10-27-123456.mp4" controls></video>
</div>
```

The node must not be caught by the `.carousel` strip in
`NotesStore.saveNoteContent` (it serializes on its own). The transcript is a
separate `<p>` after the block (as with voice memos).

## 7. Platform contract (bridge)

New methods on `ElectronAPI` / `AndroidBridgeRaw` (after the audio pattern):

```ts
// write a (square) video file into assets/video/, returns video://<fileName>
uploadVideo(base64Data: string, fileName: string):
  Promise<{ success: boolean; url?: string; error?: string }>;

// native video capture (Android): start/stop, stop returns url + duration
startVideoRecording(): Promise<{ success: boolean; error?: string }>;
stopVideoRecording(): Promise<{ success: boolean; url?: string; duration?: number; error?: string }>;

// (optional) capture a poster on Android
captureVideoPoster?(fileName: string):
  Promise<{ success: boolean; posterUrl?: string; error?: string }>;
```

- Desktop: `uploadVideo` (main + preload, writes to `assets/video/`); capture is
  entirely in the renderer via `getUserMedia` + `MediaRecorder` (like audio).
- Android: `startVideoRecording`/`stopVideoRecording` via CameraX in Kotlin,
  `FileSystemManager.saveVideo`, `readVideoAsset`, mime `video/mp4`.
- Audio-track transcription — the existing `transcribeAudio`.

## 8. Rendering variants

The base is a **square mini-video** with a poster and a play button. Variants only
differ in the surrounding chrome (the transcript is always a separate `<p>` after
the block):

1. **"Square" (compact)** — square poster, a centered play button, a duration chip
   in the corner. Default.
2. **"Card"** — square + a metadata row (date · duration) + a menu, visually grouped
   with the transcript via CSS.
3. **"Film"** — square with a light frame/shadow "like a slide", a progress bar
   underneath.

Switching — a `videoMemoStyle` setting (or a shared `memoStyle` for audio+video).

## 9. Integration

- `src/extensions/VideoMemo.ts` — the node; registered in `App.tsx` next to `VoiceMemo`.
- `src/components/Editor/VideoMemoNode.tsx` (+ `.css`) — variants, play/pause, menu.
- `src/components/Editor/hooks/useVideoMemo.ts` — recording (getUserMedia+MediaRecorder
  on desktop / native bridge on Android), `uploadVideo`, node insertion.
- `src/components/Editor/FAB.tsx` — a `Video` button next to `AudioLines`.
- `src/types.tsx`, `src/utils/nativeBridge.ts`, `createStubAPI.ts`, preload/main,
  `FileSystemManager.kt`, `WebViewBridge.kt`, `MainActivity.kt` (CameraX + `video://`).
- PDF/EPUB export — the block becomes a static "▶ 0:07" + (if present) the
  transcript; video doesn't play in PDF.

## Feature flag

`video-memos` in `feature-flags.json`: `true` for `DESKTOP` and `MOBILE`, `false`
for `PACKAGED` (like `voice-memos`). The button is gated by `flags.videoMemos`.

## Delivery plan

1. Flag, types (`uploadVideo`, `startVideoRecording`/`stopVideoRecording`), the
   `VideoMemo` node with `data-type` serialization and a fallback `<video>`.
2. Desktop: `getUserMedia`(video+audio) + `MediaRecorder` → `uploadVideo`; the
   `video://` protocol in the Electron main.
3. Android: CameraX capture (1:1 square) → `saveVideo`; `video://` in
   `shouldInterceptRequest`; `CAMERA` permission.
4. Playback + poster (`<video preload=metadata>` → a dedicated poster if needed);
   the 3 rendering variants.
5. Transcription: a parallel WAV (option A) → `transcribeAudio` → `<p>` after the
   block; (later) audio extraction from mp4 (option B).
6. PDF/EPUB export: a static "▶ duration" block + transcript.

## Acceptance criteria

- A "Video memo" button in the FAB (gated by the flag).
- Recording a square (1:1) video → `video-<timestamp>.mp4` in `<root>/assets/video/`,
  a `videoMemo` block survives save/load correctly.
- Playback and the poster work on Desktop and Android.
- "Transcribe" produces the audio-track text as a paragraph after the block
  (reusing the on-device transcriber).
- Deleting the block deletes the file (or marks it orphaned — see risks).
- Export doesn't break and shows "▶ duration" + transcript.

## Open questions / risks

1. **Desktop format.** `MediaRecorder` in Chromium produces `webm` by default;
   `mp4` is available from Chromium 126+. Verify the actual mime in Electron 39 and
   decide: `mp4` everywhere (more universal) or `webm` on desktop + `mp4` on Android.
2. **Size.** Video ≈ 7.5 MB/min — notably more than audio. Cap duration/bitrate,
   warn about size, GC orphans in `assets/video/` (as with voice).
3. **Square.** 1:1 is cropped from the sensor (centered); on some devices CameraX
   `RATIO_1_1` is unavailable — fall back to cropping the finished frame.
4. **Permissions.** `CAMERA` is a new runtime request on Android (add to the
   existing `RECORD_AUDIO`); on desktop — the Chromium webcam permission.
5. **Camera preview.** A native `PreviewView` over the WebView needs a careful
   overlay (square centered, a record button).
6. **Transcription.** Option A (parallel WAV) duplicates audio; option B (extraction
   from mp4) needs a demuxer on desktop — defer.
7. **`Range` seeking** for video — the same risks as `voice://`; negligible for a
   square mini-video but needed for long clips.
