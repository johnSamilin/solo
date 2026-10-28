# Voice Memos — Architecture & Design

> Design doc. Implementation is out of scope for this document — design only.

## Goal

Add voice memos to Solo: record an audio note directly inside a text note and
store it alongside the rest of the content. The audio file is saved as `.wav`,
inserted into the note as a dedicated block, and can be transcribed **on-device**
(no cloud). The transcript is written as a regular `<p>` paragraph right after
the memo and participates in search.

## Key Constraints (inherited from the project)

1. **No external runtime.** As with read-later (`plans/read-later-architecture.md`),
   the device has no `go`/`node`/`python`/`rust`/`ffmpeg`. Anything that cannot be
   done with the stock WebView/Chromium or Kotlin must be **pure TypeScript**
   (npm dependencies are allowed — the project already uses `jszip`,
   `pdfjs-dist`, `howler`).
2. **Three platforms, one storage model.** A note is an `.html` file + `.json`
   sidecar inside a user-selected root folder. Assets (currently images) live in
   `<root>/assets/` and are addressed via the custom `image://<fileName>`
   protocol. Voice files live in the `<root>/assets/voice/` subfolder and are
   addressed via `voice://<fileName>`.
3. **Privacy / offline.** Transcription runs **on-device only** — audio and text
   never leave the device. Cloud STT services are not used.

## User Flow

1. The FAB toolbar gets a "Voice memo" button (an `AudioLines` or `Mic2` icon
   from `lucide-react`, next to the `Mic` dictation button).
2. Clicking starts microphone recording; the button switches to a "recording"
   state (timer indicator); clicking again stops it.
3. The recorded chunk is encoded to `.wav` (pure TS) and saved via the
   `uploadAudio` bridge into `<root>/assets/voice/`, returning
   `voice://<fileName>`.
4. An atomic TipTap `voiceMemo` block with the file reference, duration and
   metadata is inserted at the cursor.
5. The block plays back inline (`<audio>` / native player). A context menu offers
   **Transcribe**, **Download/export** and **Delete**.
6. "Transcribe" runs **on-device** transcription and inserts the result as a
   regular `<p>` paragraph immediately after the memo; the text is editable and
   participates in full-text search.

## 1. Storage format: WAV

We record **only to `.wav`** — lossless, encoded by trivial pure TypeScript
(16-bit PCM + a 44-byte header, ~30 lines), with no third-party encoders.

### Capture — PCM in the renderer

Important detail: the stock Web `MediaRecorder` in WebView/Chromium produces
`audio/webm;codecs=opus` / `audio/ogg`, **not** `.wav`. Hence the pipeline:

1. `getUserMedia({ audio: true })` → `MediaStream`.
2. `AudioContext` + `MediaStreamAudioSourceNode` + `AudioWorkletNode`
   (fallback `ScriptProcessorNode`) write raw PCM samples into a buffer.
3. Encode to WAV: 16-bit PCM + WAV header (pure TS).

Recommended capture parameters — mono, 16 kHz (voice): ≈ 1.9 MB/min. To reduce
size, optionally 8 kHz or 24 kHz (only the WAV header sample rate changes).

In parallel, an `AnalyserNode` samples peak amplitudes (50–100 normalized
values) — they are stored in the block attribute so the waveform can be drawn
without re-decoding the file.

### File name and path

- Path: `<root>/assets/voice/` (a `voice` subfolder inside the existing `assets/`).
- Name: `memo-<yyyy-mm-dd-hhmmss>.wav` (e.g. `memo-2026-10-26-093045.wav`). Collisions
  (two memos in the same second) are resolved by the existing
  `buildUniqueAssetName` — `-1`, `-2`, etc. are appended.
- MIME type: `audio/wav`. Link protocol: `voice://memo-<yyyy-mm-dd-hhmmss>.wav`.

## 2. Playback

The renderer uses `<audio src="voice://<fileName>">`; the file is served by the
custom `voice://` protocol, mirroring `image://` but resolving to
`<root>/assets/voice/`.

- **Electron** — a new `protocol.handle('voice', ...)` in
  `native-clients/electron/electron/main.ts`, resolving
  `<dataFolder>/assets/voice/<name>` (analogous to the existing `getFile`, lines
  180–204, but with the `voice` subfolder). Returns via `net.fetch` on `file://`;
  **`Range` support is required** for seeking (see risks).
- **Android** — a branch in `shouldInterceptRequest` (`MainActivity.kt`, next to
  `handleImageRequest`), serving bytes from `assets/voice/` via a dedicated
  `readVoiceAsset` (or a parameterized `readAsset(subfolder, name)`) with
  `guessMimeType` extended by `audio/wav`. Seeking in WebView requires `Range`
  support in `WebResourceResponse` (see risks).
- `mediaPlaybackRequiresUserGesture = false` is already set (MainActivity.kt:100),
  so autoplay is allowed. An alternative for accurate seeking is a native
  `MediaPlayer`/`ExoPlayer` via a `playAudio(url)` bridge method (the way
  `playTypewriterSound()` currently goes to `AudioPlayer`/SoundPool — though
  SoundPool is unsuitable for long files, `MediaPlayer` is needed).

## 3. Transcription — on-device only

Requirements: optional, on explicit user action, result inserted as a `<p>`
paragraph after the memo. Cloud services are not used. Language: **Russian**.

### Final architecture (as implemented)

- **Android** — the native **Vosk AAR** (`com.alphacephei:vosk-android`). The
  Russian model ships as a ZIP in `assets/model-ru.zip`; `TranscriptionManager.kt`
  unpacks it to the app's files dir on first use (self-unzip, no `StorageService`),
  extracts the memo's PCM from its WAV and feeds it to `Recognizer`, returning the
  text.
- **Desktop (Electron)** — the native **Vosk library via `koffi` FFI** in the
  main process. `libvosk` is bundled in the app and the Russian model is unpacked
  next to it; `transcribe-audio` reads the WAV, extracts its PCM and runs
  `vosk_recognizer_*` through koffi. This avoids WASM entirely.
- **Language** — Russian (`vosk-model-small-ru-0.22`).

Both paths are fully on-device; audio and text never leave the device. Both use
the same standard Vosk model (`.zip`, extracted) — see the Setup section.

### Where the result is written

The transcript is **not** stored in a block attribute. After successful
recognition, a regular paragraph is inserted immediately after the memo:

```html
<div data-type="voice-memo" ...>…</div>
<p data-voice-transcript="memo-2026-10-26-45.wav">Записать тезисы по дизайн-доку…</p>
```

- The `<p>` is a normal editable paragraph: it participates in
  `doc.body.textContent` (search, word count, `extractParagraphTags`) and
  survives save/load without special logic.
- `data-voice-transcript` only marks "this is the transcript of memo X" — so a
  re-transcription can find and update/replace the right paragraph, and CSS can
  style it paired with the block.

### Punctuation & capitalization restoration

Vosk outputs raw lowercase text. Before inserting the transcript, the renderer
runs a pure post-processor (`src/utils/transcription/punctuate.ts`) that restores
punctuation and capitalization using acoustic cues:

- **Pauses** (silence between words, from Vosk word timings) → sentence boundaries;
- **Pitch (F0)** — a rising pitch at a sentence end → `?`;
- **Energy** — a loud ending → `!`;
- sentence starts and the Russian `я` are capitalized.

The native layer enables word timings (`set_words`) and computes per-word pitch
(autocorrelation) + energy (RMS) from the PCM, returning `words` and `prosody`
alongside `text`.

## 4. Data model

A new TipTap block `voiceMemo` (atomic, `group: 'block'`), implemented after the
`CutIn.ts` pattern (`ReactNodeViewRenderer`) — it already serializes correctly
and survives the `getHTML`/`setContent`/`updateFile` round-trip.

```ts
// src/extensions/VoiceMemo.ts
addAttributes() {
  return {
    src:        { default: '' },                 // voice://memo-....wav
    fileName:   { default: '' },                 // memo-....wav
    duration:   { default: 0 },                  // ms
    createdAt:  { default: null },               // ISO string
    peaks:      { default: [] },                 // number[] for the waveform
    lang:       { default: '' },                 // locale for on-device recognition
  };
}
```

HTML serialization (analogous to `data-type="cut-in"`):

```html
<div data-type="voice-memo"
     data-src="voice://memo-2026-10-26-45.wav"
     data-file-name="memo-2026-10-26-45.wav"
     data-duration="42000"
     data-created-at="2026-10-26T09:30:45.000Z"
     data-peaks="[0.1,0.4,0.9,...]"
     data-lang="ru-RU">
  <!-- fallback for static export/render without JS -->
  <audio src="voice://memo-2026-10-26-45.wav" controls></audio>
</div>
```

`renderHTML` outputs a fallback `<audio>` inside the `data-type` wrapper so the
block degrades to a plain player outside the editor (e.g. in export). The node
must **not** be caught by the `.carousel` strip in
`NotesStore.saveNoteContent` — it serializes on its own, no strip needed.

There is no transcript in the block's attributes: it lives in a separate `<p>`
after the memo (see §3), so no special search/statistics handling is required —
it is ordinary note text.

## 5. Platform contract (bridge)

New methods on `ElectronAPI` (`src/types.tsx`) and `AndroidBridgeRaw`:

```ts
// write audio into assets/voice/ (analogous to uploadImage), returns voice://<fileName>
uploadAudio(base64Data: string, fileName: string):
  Promise<{ success: boolean; url?: string; error?: string }>;

// on-device transcription of an audio file in assets/voice/
transcribeAudio(fileName: string):
  Promise<{ success: boolean; text?: string; error?: string }>;

// native microphone recording (Android) — start, then stop which returns the voice:// url
startRecording(): Promise<{ success: boolean; error?: string }>;
stopRecording(): Promise<{ success: boolean; url?: string; duration?: number; error?: string }>;

// (optional) native player with accurate seeking on Android
playAudio?(url: string): Promise<{ success: boolean; error?: string }>;
```

Layer-by-layer:

- `src/utils/nativeBridge.ts` — forward `uploadAudio`/`transcribeAudio` for
  Electron and Android (`wrapAndroidBridge`), stubs in `createStubAPI.ts` for
  PACKAGED.
- `native-clients/electron/electron/preload.ts` — `ipcRenderer.invoke('upload-audio', ...)`.
- `native-clients/electron/electron/main.ts` — `ipcMain.handle('upload-audio')`
  (writes to `assets/voice/`, copy of `upload-image`, lines 1240–1266) +
  `protocol.handle('voice', ...)` (serving `assets/voice/`). On-device STT on
  Desktop goes through the WASM engine in the renderer (bytes read via
  `fetch('voice://…')`), so a separate `transcribe-audio` in main may be absent.
- `native-clients/android/.../WebViewBridge.kt` — `uploadAudio(base64, fileName)`
  (analogous to `uploadImage`, but into `assets/voice/`), `transcribeAudio(fileName)`;
  `FileSystemManager.saveAudio` (shared code with `saveImage`, `voice` subfolder),
  `readVoiceAsset`/parameterized `readAsset`, `guessMimeType` extended by `audio/wav`.
- `native-clients/android/.../MainActivity.kt` — `voice://` branch in
  `shouldInterceptRequest` + `onPermissionRequest` in `WebChromeClient` for
  `RESOURCE_AUDIO_CAPTURE`; `RECORD_AUDIO` in `AndroidManifest.xml`.

Capture is entirely in the renderer (no native calls needed) — native only
stores/serves files and performs on-device recognition.

## 6. Five ways to render a voice memo inside a note

The block is rendered by a React `VoiceMemoNode` component
(`ReactNodeViewRenderer`). Below — 5 rendering variants. Common: all use the
design tokens (`--color-*`, `--editor-font-family`), work across themes
(including `terminal`), and expose a context menu (Transcribe / Delete /
Download). The transcript is **always** a separate `<p>` after the block (see
§3); variants 3 and 5 merely visually group it with the memo via the CSS
sibling selector `.voice-memo + p[data-voice-transcript]`. Switching is a setting
in `SettingsModal → Layout` (`voiceMemoStyle`).

### Variant 1 — "Compact bar"

Classic player row: a round play/pause button, a progress scrubber, current/total
time.

```
┌───────────────────────────────────────────────┐
│  ▶   ━━━━━━━━━━━━━━━━●─────────────────  0:42 │
└───────────────────────────────────────────────┘
```

- **Elements:** play/pause, seekbar, `current/total`, (right) `⋯` menu.
- **Interaction:** button toggles playback; dragging seeks; `⋯` — transcribe/delete/download.
- **Pros:** familiar, minimal, fits any theme, nothing extra.
- **When:** the default variant.
- **CSS:** flex row, `border: 1px solid var(--color-border)`,
  `border-radius: 0.5rem`, `background: var(--color-white)`.

### Variant 2 — "Voice message" (waveform)

Like a Telegram/WhatsApp voice note: play + vertical waveform bars + duration chip.

```
┌────────────────────────────────────────────────┐
│  ▶   ▂▃▅▃▁▂▅▇▅▃▁▂▃▅▇▅▃▁▂▃▅▅▃▂   ┌─────┐  ⋯ │
│                              │ 0:42│           │
└────────────────────────────────────────────────┘
```

- **Elements:** play/pause, waveform from `peaks` (with the played part filled),
  `0:42` chip, `⋯` menu.
- **Interaction:** clicking the waveform seeks; the progress fill is synced with
  playback.
- **Pros:** visually rich, intuitively "this is audio", more compact than a full
  player.
- **When:** a recognizable "voice" look is desired.
- **CSS:** an array of `div` bars (or `canvas`), `--color-text-light` for the
  played part, `--color-checkbox` for progress.

### Variant 3 — "Card"

The memo is wrapped in a card that visually groups the block with the following
transcript `<p>` (CSS: `.voice-memo[data-variant="card"] + p[data-voice-transcript]`
gets the same background/border). The transcript remains an editable paragraph.

```
┌────────────────────────────────────────────────┐
│  ▶ 0:42 · 26 Oct 09:30:45                 [⋯] │
│  ┌──────────────────────────────────────────┐ │
│  │  Записать тезисы по дизайн-доку…         │ │  ← the following <p> (transcript),
│  │  (a normal editable paragraph)            │ │    pinned to the card via CSS
│  └──────────────────────────────────────────┘ │
└────────────────────────────────────────────────┘
```

- **Elements:** top row — play, duration, date/time, `⋯` menu; below — the
  transcript as a separate `<p>`.
- **Interaction:** play starts playback; the transcript is selected/edited as
  ordinary text.
- **Pros:** the transcript reads as one unit with the player, looks "document-like".
- **When:** the text is the main value (interviews, notes, dictation).
- **CSS:** card `background: var(--color-bg)`, `border: 1px solid
  var(--color-border)`; the transcript `<p>` gets the same background via the
  adjacent-sibling selector.

### Variant 4 — "Inline chip"

A minimal "pill" in the text flow, like a footnote/tag.

```
…notes from the meeting.  ▶ 0:42   The text continues further…
                         (inline pill)
```

- **Elements:** a play icon + duration (while playing — a mini progress ring/fill).
- **Interaction:** click plays/pauses inline; the context menu —
  transcribe/delete/download.
- **Pros:** doesn't break the text rhythm, the most compact, an analog of
  `paragraph-tag`.
- **When:** quick notes "in the margins", when audio is secondary.
- **CSS:** like `.paragraph-tag` / `.tag` pills, `inline-flex`,
  `border-radius: 9999px`.

### Variant 5 — "Quote block"

The voice memo is styled as a literary quote with a vertical accent; the following
transcript `<p>` is styled in italics in the theme's typography.

```
┌────────────────────────────────────────────────┐
│ ▍ ▶ 0:42 · waveform  ▂▃▅▃▁     · 26 Oct       │
│ ▍                                              │
│ ▍   (transcript — the following <p>, italic,    │
│ ▍    theme font)                                │
└────────────────────────────────────────────────┘
```

- **Elements:** a vertical accent bar (`border-left`), play, a metadata row
  (date · duration), a thin waveform; the transcript — an italic `<p>` after the
  block.
- **Interaction:** play via the button or the block; `⋯` menu.
- **Pros:** fits Solo's "literary" aesthetic, the transcript reads as part of the
  note.
- **When:** themes with distinctive typography (Alighieri, Typewriter), when the
  note is text and the voice is the source.
- **CSS:** `border-left: 3px solid var(--color-text-light)`,
  `font-family: var(--editor-font-family)`; the transcript `<p>` — `font-style: italic`.

### Choice and switching

- Default: **Variant 1** (compact bar) — universal.
- A `voiceMemoStyle` setting (`'compact' | 'waveform' | 'card' | 'chip' | 'quote'`)
  in `SettingsModal → Layout`, persisted in global settings, renders the block
  via `ReactNodeViewRenderer` with the chosen look.
- The transcript is, in every variant, a regular `<p>` after the block; variants
  3 and 5 only differ in visually grouping that paragraph with the memo.

## 7. Integration

- `src/extensions/VoiceMemo.ts` — the node; registered in `App.tsx` next to `CutIn`.
- `src/components/Editor/VoiceMemoNode.tsx` (+ `VoiceMemo.css`) — the 5 variants
  and the context menu.
- `src/components/Editor/hooks/useVoiceMemo.ts` — recording (native `AudioRecord`
  bridge on Android, `getUserMedia` + PCM→WAV on Desktop), node insertion,
  play/pause/seek logic; transcript `<p>` insertion after the memo.
- `src/components/Editor/hooks/useTranscription.ts` — on-device transcription
  orchestration: both platforms call `getNativeAPI().transcribeAudio(fileName)`
  (Android → Vosk AAR, Desktop → native Vosk via koffi in the Electron main).
- `src/components/Editor/FAB.tsx` — an `AudioLines` button next to `Mic` (dictation).
- `src/i18n/translations.ts` — keys `editor.voiceMemo`, `voiceMemo.record`,
  `voiceMemo.transcribe`, `voiceMemo.*`, etc.
- `src/types.tsx` — `ElectronAPI` methods, `AndroidBridgeRaw`, an optional
  `voiceMemoStyle` field on `TypographySettings`.
- Export (`src/components/Search/export/exportNotes.ts`) — transform
  `div[data-type="voice-memo"]` into a static "▶ 0:42" block and **transcribe any
  memo without a transcript** (on-device) so the exported PDF/EPUB always includes
  the text.

## 8. Setup — transcription models

The Vosk models are ~45 MB each and are **not** committed to the repository. To
enable on-device transcription on both platforms, run the fetch script once and
rebuild the native clients.

### 1. Download the models

```bash
bash scripts/fetch-vosk-models.sh
```

This downloads:

| Platform | File | Destination | Engine |
| --- | --- | --- | --- |
| Android | `vosk-model-small-ru-0.22.zip` | `native-clients/android/app/src/main/assets/model-ru.zip` | Vosk AAR |
| Desktop | `vosk-model-small-ru-0.22.zip` (extracted) | `native-clients/electron/models/vosk-model-small-ru-0.22/` | native Vosk via koffi |
| Desktop | `libvosk.dylib` / `libvosk.so` | `native-clients/electron/libvosk/` | native Vosk via koffi |

> Both platforms use the **same** standard Vosk model (`.zip`, extracted): the
> Android AAR unpacks it at runtime, while the desktop `transcribe-audio` handler
> loads the extracted folder directly. They are interchangeable.

> The model is fetched from Hugging Face (`rhasspy/vosk-models`) first, then a
> GitHub mirror, then `alphacephei.com` — the script falls back automatically.
> `libvosk` is extracted from the `vosk` npm package tarball (npm registry).

### 2. Rebuild the clients

- **Android** — the new `com.alphacephei:vosk-android` dependency requires a
  `gradle sync` and a fresh build (`./gradlew assembleGooglePlayDebug` /
  `assembleRuStoreDebug`). The `gradle-wrapper.jar` must be present in
  `native-clients/android/gradle/wrapper/`.
- **Desktop (Electron)** — `npm install` in `native-clients/electron/` (adds the
  `koffi` FFI dependency), then rebuild the main process (`npm run build:electron`).
  For the packaged app, forge bundles `models/` and `libvosk/` via `extraResource`.

### 3. Verify

- **Android:** record a memo → "Transcribe" → the transcript `<p>` appears. On
  the very first transcription the model is unpacked to the app files dir (a
  one-time delay).
- **Desktop:** record a memo → "Transcribe" → the transcript appears with no
  network access (the model is bundled).
- **Export:** export a notebook to PDF/EPUB containing a memo without a
  transcript → the document includes the on-device-generated transcript.

## Feature flag

Add `voice-memos` to `feature-flags.json`: `true` for `DESKTOP` and `MOBILE`,
`false` for `PACKAGED` (like `read-later` — due to browser-build limitations: no
`getUserMedia` under `file://` and no bridge). The button is gated by the static
flag `__FF_VOICE_MEMOS__` / `flags.voiceMemos`.

## Delivery plan

1. Flag, types (`uploadAudio`, `transcribeAudio`, `voiceMemoStyle`), the
   `VoiceMemo` node with `data-type` serialization and a fallback `<audio>`; an
   HTML round-trip test.
2. `uploadAudio` in Electron (main + preload) and `protocol.handle('voice')`
   (resolving `assets/voice/`); stubs in the Android bridge and `createStubAPI`.
3. Recording: native `AudioRecord` on Android (via `startRecording`/`stopRecording`
   bridge) and `getUserMedia` + PCM → WAV on Desktop; node insertion, `useVoiceMemo`,
   the FAB button, i18n.
4. Playback: `<audio>` + `voice://` on Android (`shouldInterceptRequest` for
   `assets/voice/`, `onPermissionRequest`, `RECORD_AUDIO`) and Electron
   (`Range` support).
5. The 5 rendering variants + the `voiceMemoStyle` setting; the context menu
   (deleting the block + deleting the file from `assets/voice/`).
6. On-device transcription: Android Vosk AAR (bridge `transcribeAudio`) and the
   WASM engine for Desktop; inserting the result as a `<p>` after the memo.
7. PDF/EPUB export: a static "▶ duration" block, transcribing memos without a
   transcript on-device and including the text.

## Acceptance criteria

- A "Voice memo" button in the FAB (gated by the flag, absent from PACKAGED).
- Recording → a `memo-<yyyy-mm-dd-hhmmss>.wav` file in `<root>/assets/voice/`, a
  `voice://...` reference in the block, a correct save/load round-trip.
- Playback and seeking work on Desktop and Android.
- "Transcribe" works on-device (without network/cloud) and inserts the result as
  a `<p>` right after the memo; the text is editable and searchable.
- Deleting the block deletes the audio file (or marks it orphaned — see risks).
- Export doesn't break and shows "▶ duration" + the transcript as plain text.
- The whole scenario (record/play/transcribe) works offline.

## Open questions / risks

1. **`Range` requests.** Seeking via `<audio>` requires `Range`-header support: on
   Android `shouldInterceptRequest` returns the whole file — seek may break; on
   Electron `net.fetch('file://')` may also not support partial delivery. Plan B —
   native `MediaPlayer`/`ExoPlayer` (Android) and a `Range` stream (Electron).
2. **Model size / first-use delay.** The Russian model is ~45 MB per platform. On
   Android it inflates the APK and is unpacked to the app files dir on the first
   transcription (a one-time delay); on Desktop it inflates the installer bundle.
3. **WASM memory.** Vosk-WASM holds the ~45 MB model in memory and runs inference
   in a Web Worker — on low-memory machines the Electron renderer may be
   constrained. The model is loaded lazily on the first "Transcribe".
4. **Orphan assets.** Currently `deleteNote` removes only `.html`/`.json`/`.css`,
   leaving `assets/` untouched (already true for images). For voice files (larger),
   propose a GC pass: on note deletion remove its `voice://` assets from
   `assets/voice/`, or periodically reconcile `assets/voice/` against HTML content.
5. **Attachment size.** `.wav` is larger than compressed formats — a size warning
   for long recordings and (optionally) a lower sample rate.
6. **Microphone permission.** Android records natively via `AudioRecord`, which
   still requires the runtime `RECORD_AUDIO` permission (requested at startup);
   the PACKAGED build has no native bridge and the feature is disabled there.
