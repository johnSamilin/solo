# Read Later Architecture

## Goal

Add a "Read later" feature to Solo: extract an article from a URL and save it as
a regular HTML note. The sidebar menu gets a "Read later" item next to "New
Note". Clicking it opens a modal with a URL field (auto-filled from the
clipboard when it contains a URL) and a "Save styles" checkbox. On confirm the
content is extracted, cleaned and saved as a new note; when "Save styles" is
enabled, the page's colors, sizes and typography are written to the note's
custom CSS.

## Key Constraint — Portability

The target device has no `go`, `node`, `python`, `rust` or any other external
runtime. The extraction tool therefore **cannot** be a standalone CLI binary or
a script launched via `child_process`. Extraction must live inside Solo's
existing runtime:

- **Desktop (Electron):** main process (`net.fetch` is already used in
  `native-clients/electron/electron/main.ts`, see lines 201 and 275) + renderer
  (Chromium, `DOMParser` available).
- **Android (WebView + Kotlin):** an HTTP client in `WebViewBridge` /
  `FileSystemManager` for networking + `DOMParser` in the WebView.
- **Packaged web (browser):** `fetch` + `DOMParser` only, with CORS limits.

This imposes two consequences that shape the whole architecture:

1. **The network request runs in the native layer** (Electron main / Android
   HTTP client) to bypass CORS, which would block a renderer `fetch`.
2. **Parsing and cleaning run in the renderer** in pure TypeScript on top of
   `DOMParser` — no external dependencies and no Markdown conversion (Solo
   stores notes as HTML, not Markdown).

## User Flow

1. The user opens the sidebar menu (`SidebarMenu`) and chooses `Read later`.
2. `ReadLaterModal` opens. The URL field is pre-filled from the clipboard if
   `navigator.clipboard.readText()` returned a valid `http(s)` URL; otherwise it
   is empty and auto-focused.
3. The user optionally edits the URL and toggles "Save styles".
4. On confirm the extraction flow runs:
   - native `fetchUrl(url)` returns the raw HTML and the final URL (after
     redirects);
   - the renderer runs the HTML through a Readability-style extractor, producing
     sanitized HTML + metadata (title, byline, image);
   - with "Save styles" enabled, the source page's color/typography tokens are
     extracted and written to the note's `.css`;
   - a note is created via the existing `NotesStore.createNote`, its content is
     overwritten with the extracted HTML, `sourceUrl` is written to the `.json`
     metadata (and optionally a `read-later` tag).
5. The note opens in the editor like any other. A network/parse error is shown
   as a toast via `settingsStore.setToast(...)` and no note is created.

## Content Extraction Tool Comparison

### 1. Self-written extractor (TypeScript Readability port)

A TS extractor running on `DOMParser` in the renderer — essentially a port of the
Mozilla Readability algorithm (the one behind Firefox Reader View).

- **Pros:** full portability (no external binaries), works offline after the
  fetch, privacy (URL/content never leaves the device), no rate limits,
  deterministic, one implementation for all 3 platforms. A ready
  `@mozilla/readability` implementation can be vendored (or `readability` +
  `sanitize-html`).
- **Cons:** quality depends on the algorithm (imperfect on JS-rendered SPAs),
  edge cases need maintenance, no JS execution — pages whose content only
  appears after JS will come back empty.
- **Verdict:** **primary option.** The only one that fully satisfies the
  "no go/node/rust/python" requirement.

### 2. Public content-extraction APIs

Services such as Jina Reader (`https://r.jina.ai/<url>`), the deprecated
Postlight/Mercury, trafilatura-as-a-service, etc.

- **Pros:** best-in-class results (the server runs JS, bypasses protections),
  zero code to write.
- **Cons:** depends on network and a third party, the URL leaks externally
  (privacy), rate limits and quotas, may be blocked, some require API keys, no
  offline operation.
- **Verdict:** only useful as an **optional fallback** for SPAs when the
  self-written extractor returned empty content. Disabled by default.

### 3. Goose

Two different tools share this name, and neither fits:

- **Goose article extractor** (`goose3`, Python; historically Java) — an article
  extraction library. Requires a Python runtime.
- **block/goose** — an AI agent framework in Go. Requires a Go runtime and an
  LLM (API keys); it is not a pure content extractor.

- **Verdict:** both need an external runtime/binary and (for block/goose)
  network + LLM. Violates the portability requirement. Not considered.

### 4. markdowndown

A Python tool converting a web page to Markdown (built on
readability/trafilatura).

- **Pros:** clean Markdown content, a curated pipeline under the hood.
- **Cons:** requires Python, outputs Markdown (Solo stores HTML — conversion is
  an extra lossy step), networking happens outside the app.
- **Verdict:** unsuitable — portability and output format.

### 5. Monolith

A Rust CLI that collapses a page plus all assets (CSS/images/fonts) into a single
self-contained HTML file.

- **Pros:** ideal for "archive as-is" — a complete offline snapshot.
- **Cons:** requires a per-architecture static binary (absent on the device),
  **does not clean content** (keeps navigation, ads, scripts), does not isolate
  the article itself.
- **Verdict:** interesting as a future "full archive" option, but not as the base
  mechanism, because of the binary and the lack of cleaning.

### Summary Table

| Tool | On-device runtime | Third-party network | Output format | Fits? |
| --- | --- | --- | --- | --- |
| Self-written (TS + DOMParser) | none (WebView/Chromium) | no | HTML (cleaned) | **yes — primary** |
| Public APIs (Jina etc.) | none | yes | Markdown | fallback for SPAs |
| Goose (goose3 / block-goose) | Python / Go | (block-goose) yes | — | no |
| markdowndown | Python | yes | Markdown | no |
| Monolith | binary (Rust) | no | HTML (uncleaned) | no (maybe archive) |

## Solution Architecture

Two-phase extraction: **fetch in native** + **parse in renderer**. This preserves
portability and bypasses CORS without external binaries.

### Phase 1 — Fetch (native layer)

A new bridge method `fetchUrl(url)`:

- **Electron main** — `net.fetch` (already in the project), returns `text()`,
  `finalUrl` (after redirects) and `content-type`; `net.fetch` is not CORS-bound.
- **Android** — an HTTP client (e.g. `HttpURLConnection` or OkHttp) behind a new
  `NetworkManager`-style call in `WebViewBridge`, returning the body and final
  URL.
- **Packaged web** — renderer `fetch` (CORS may block it); fallback to a public
  proxy (comparison item 2) or disable the feature. The `createStubAPI` stub
  returns `{ success: false, error: 'Not available in packaged build' }`.

Fetch-phase limits: a timeout (e.g. 15–30 s), a response-size cap (e.g. 5 MB),
`http(s)` only, a bounded redirect chain. No secrets or cookies are forwarded.

### Phase 2 — Parse (renderer, pure TS)

New `src/utils/readLater/` package (independent of MobX/React):

- `readLater/extractContent.ts` — wrapper over the Readability-style port: takes
  raw HTML and the final URL, returns
  ```ts
  interface ExtractedArticle {
    title: string;        // <title> or <h1>, fallback — URL hostname
    byline?: string;
    html: string;         // sanitized body innerHTML
    excerpt?: string;
    siteName?: string;
  }
  ```
- `readLater/readability.ts` — the vendored/ported Readability algorithm,
  operating on a `DOMParser`-produced `document` (not `window.document`, to keep
  the app's live DOM untouched).
- `readLater/sanitize.ts` — removes scripts, `on*` attributes, `javascript:`
  URLs, tracking iframes; reduces markup to the subset TipTap accepts (`p, h1–h6,
  ul, ol, li, blockquote, pre, code, img, figure, a, em, strong, table`).
  Mirrors the export sanitizer
  (`src/components/Search/export/normalizeNoteHtml.ts`).
- `readLater/extractStyles.ts` — see "Save Styles" below.

The phase output is the note's HTML content. No Markdown conversion is needed.

### Files And Integration Points

- `src/components/Modals/ReadLaterModal.tsx` — dialog (modeled on
  `SaveFilterModal.tsx`): URL field (clipboard auto-fill), "Save styles"
  checkbox, loading/error states.
- `src/components/Modals/Modals.css` — dialog styles.
- `src/stores/ReadLaterStore.ts` — orchestration: `open()`, `submit(url,
  saveStyles)`, calls `getNativeAPI().fetchUrl`, runs the parse phase, then
  `NotesStore.createNote` + content/CSS/metadata writes; progress and errors.
- `src/components/Sidebar/SidebarMenu.tsx` — a new menu item (icon
  `BookmarkPlus`/`Download` from `lucide-react`) after "New Note".
- `src/i18n/translations.ts` — keys `sidebar.readLater`, `readLater.title`,
  `readLater.urlPlaceholder`, `readLater.saveStyles`, `readLater.error.*`.
- `src/App.tsx` — renders `ReadLaterModal` (store-flag driven), like other
  modals.

### Note Creation (reusing the existing bridge)

To avoid duplicating `create-note` across three platforms, reuse existing
methods:

1. `notesStore.createNote(targetNotebookId)` → creates an empty note (`.html`
   + `.json`), returns `htmlPath`.
2. `api.updateFile(htmlPath, article.html)` — overwrites the boilerplate with the
   extracted HTML. `update-file` in Electron main writes any relative path
   regardless of extension (line 578), so it also works for `.css`.
3. If `saveStyles` — `api.updateFile(cssPath, extractedCss)`, where
   `cssPath = htmlPath.replace('.html', '.css')`. The file is picked up by
   `read-structure` (lines 672–674) and loaded via the existing
   `cssPath` → `loadNoteCss` → `injectNoteStyles` path (see `App.tsx:248–261`).
4. `api.updateMetadata(htmlPath, { ...meta, sourceUrl, tags: [..., 'read-later'] })`.

The only **new** bridge method is `fetchUrl`. Everything else already exists.

## Data Model

Extend `FileMetadata` in `src/types.tsx` with an optional field (so existing
`.json` files read without migration):

```ts
export interface FileMetadata {
  id: string;
  tags: string[];
  createdAt: string;
  updatedAt?: string;
  theme?: string;
  paragraphTags?: string[];
  sourceUrl?: string;   // original URL for read-later notes
}
```

`sourceUrl` lands in the `.json` sidecar, survives `read-structure`, and is
available in the UI (e.g. an "Open original" action in `NoteHeader` — optional).
The field is not copied into global settings and does not participate in search
or export without a separate decision.

New fetch result interface:

```ts
export interface ReadLaterFetchResult {
  success: boolean;
  content?: string;       // raw HTML
  finalUrl?: string;      // URL after redirects
  contentType?: string;
  error?: string;
}
```

## Platform Contract

The single `ElectronAPI` extension in `src/types.tsx`:

```ts
fetchUrl(url: string): Promise<ReadLaterFetchResult>;
```

Layer-by-layer implementation:

- `src/utils/nativeBridge.ts` — forwards to `window.electronAPI.fetchUrl` /
  `window.SoloBridge` (Android) / stub.
- `native-clients/electron/electron/preload.ts` —
  `fetchUrl: (url) => ipcRenderer.invoke('fetch-url', url)`.
- `native-clients/electron/electron/main.ts` — `ipcMain.handle('fetch-url', ...)`
  on `net.fetch`, URL validation (`http/https`), timeout and size cap.
- `native-clients/android/.../WebViewBridge.kt` — a `fetchUrl(url)` interface
  method backed by an HTTP client (the manifest already declares `INTERNET`).
- `src/utils/createStubAPI.ts` — a `{ success: false, error: ... }` stub.

The renderer **does not** get direct network or arbitrary filesystem access: it
only sees `fetchUrl` (read) and the existing `updateFile`/`updateMetadata`
(writes by relativePath inside the data folder).

## Save Styles (custom CSS)

When the checkbox is enabled, "colors, sizes and typography" must be preserved.
A portable implementation without rendering a hidden page:

1. `extractStyles.ts` parses the source HTML: collects the article's inline
   `style` attributes plus the relevant `<style>`-block rules.
2. From those it extracts **typography tokens**: `font-family`, `font-size`
   (base and per `h1–h6`, `p`, `blockquote`, `pre`), `line-height`, `color`,
   `background-color`, `letter-spacing`.
3. The result lands in two places:
   - **Inline `style` attributes** on key elements of the extracted HTML
     (a specific block's color/font) — require no scoping and survive TipTap
     editing.
   - **A `.css` sidecar** with flat base-typography declarations
     (`font-family`, `font-size`, `line-height`, `color`, `background-color`),
     compatible with the current `injectNoteStyles` (it wraps the CSS in
     `#note-editor-content { ... }`, so the file holds declarations only, no
     selectors).

Limitation: the current `injectNoteStyles` does not support selectors. If `h1`
and `p` ever need to be styled differently via the sidecar (rather than inline),
add a scoping utility to `cssUtils.ts`:

```ts
export function scopeCss(css: string, scope: string): string;
// prefixes every selector with `scope`; drops @import, position:fixed,
// html/body selectors and external font URLs.
```

The inline approach is primary (simpler and more portable); `scopeCss` is an
optional enhancement if inline proves insufficient.

Optional (Desktop/Android only, higher fidelity): render the page in a hidden
window and read `getComputedStyle`. This yields exact computed styles but is
heavier and platform-specific; it is out of scope for the first iteration.

## Feature Flag

Add `read-later` to `feature-flags.json` and expose it as `__FF_READ_LATER__` /
`flags.readLater` (following `export-notes` in `src/utils/featureFlags.ts`).
Recommended default: `true` for `DESKTOP` and `MOBILE`, `false` for `PACKAGED`
(because of CORS). The menu item and modal are gated by the static flag so the
PACKAGED build never ships the code.

## Delivery Plan

1. Add the flag, `ReadLaterFetchResult` and `sourceUrl` in `FileMetadata`; test
   backward-compatible reading of `.json` without `sourceUrl`.
2. Implement `fetchUrl` in Electron main (net.fetch + validation/timeout) and
   preload; stubs in the Android bridge and stub API.
3. Vendor/port Readability + sanitizer in `src/utils/readLater/`; cover with HTML
   fixtures (an article with navigation/scripts, an SPA empty shell, a page with
   no readable content).
4. Build `ReadLaterStore` and `ReadLaterModal` (clipboard URL auto-fill, checkbox,
   loading/error states); wire the menu item and i18n.
5. Implement `extractStyles.ts` and the `.css` write; verify the custom CSS is
   picked up by the existing `loadNoteCss`/`injectNoteStyles` flow.
6. Implement `fetchUrl` on Android (HTTP client; `INTERNET` already declared).
7. End-to-end manual verification on Desktop and Android: clipboard URL →
   extraction → note → open → (with "Save styles") applied custom CSS.

## Acceptance Criteria

- The sidebar menu has a "Read later" item after "New Note", gated by the
  `read-later` flag and absent from the PACKAGED build.
- The modal auto-fills the URL from the clipboard when it holds a valid
  `http(s)` URL, and focuses the field otherwise.
- Confirming a valid URL creates a note with cleaned HTML content (no scripts or
  tracking) and metadata (`sourceUrl`, `read-later` tag).
- Network error/timeout/empty content is shown as a toast; no note is created.
- With "Save styles" enabled, a `.css` file with colors/typography is created
  next to the `.html` and applied through the existing
  `loadNoteCss`/`injectNoteStyles`.
- Extraction requires no `go`/`node`/`python`/`rust`: all parsing runs in
  TypeScript in the renderer, networking only through the native bridge.
