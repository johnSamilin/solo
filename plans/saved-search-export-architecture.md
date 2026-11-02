# Saved Search Export Architecture

## Goal

Add an opt-in export feature for a saved search. When a user opens Search from a
saved-search card, an Export Settings button appears. It configures a reusable
PDF or EPUB export profile for that saved search and can run a one-off export.
Only notes matching the saved-search conditions are exported.

## Scope And Assumptions

This document proposes a desktop-first implementation behind a compile-time
`export-notes` feature flag:

- `DESKTOP`: enabled only in development and release builds selected for the
  rollout.
- `MOBILE` and `PACKAGED`: disabled. They must not include the export UI or
  export implementation in their bundles.
- Export content follows the result presentation: a note matched through a
  whole-note tag is exported in full; a paragraph-level tag or text match is
  exported as only the matched paragraphs, separated and bounded by ellipses.
- A matching PDF note is rendered as its original pages and inserted as
  separate pages in the output.
- Auto-export runs when a note that can affect a profile is closed, or during
  application shutdown if such a note is still open. It is not scheduled in the
  background and is off by default.
- The profile is attached to a saved search, rather than being a global export
  preference. This makes manual and automatic output reproducible.

These are proposed product decisions, not current behavior. They should be
validated before implementation if Android, web export, scheduled jobs, or PDF
source notes are required in the first release.

## User Flow

1. The user clicks a saved-search card in `EmptyState`.
2. `App` opens `SearchPage` with that `SavedFilter` as `initialFilters`.
3. When `flags.exportNotes` is true and `initialFilters` is present,
   `SearchPage` displays an `Export settings` button in the header. It is not
   shown for an ad-hoc search or while creating a new saved search.
4. The settings modal shows the saved-search label, the current matched-note
   count, and the profile form.
5. The user selects PDF or EPUB; configures book details; optionally enables
   auto-export; and can save the profile without exporting.
6. `Export now` builds the document from a fresh evaluation of the saved
   filter, prompts for the output path, writes the file, and reports success,
   failure, and any resources that could not be rendered.
7. With auto-export enabled, closing a note after its content, metadata, or
   paragraph tags changed evaluates every profile that the note can affect. If
   its result set or exported content changed, Solo overwrites the profile's
   configured output file without showing a dialog. A failed automatic export
   is surfaced as a non-blocking error and does not disable the profile.

An auto-export profile therefore requires a durable output path. The first
manual export is required before the auto-export toggle can be enabled.

## Data Model

Extend `SavedFilter` in `src/types.tsx`; keep all new properties optional to
read existing `solo-saved-filters` entries safely.

```ts
export type ExportFormat = 'pdf' | 'epub';

export interface ExportHeaderFooter {
  enabled: boolean;
  headerLeft: string;
  headerCenter: string;
  headerRight: string;
  footerLeft: string;
  footerCenter: string;
  footerRight: string;
}

export interface ExportCover {
  enabled: boolean;
  title: string;
  subtitle: string;
  author: string;
  imagePath?: string;
}

export interface SavedSearchExportProfile {
  format: ExportFormat;
  autoExport: boolean;
  outputPath?: string;
  title?: string;
  author?: string;
  language: string;
  includeTableOfContents: boolean;
  includeCover: boolean;
  cover: ExportCover;
  headerFooter: ExportHeaderFooter;
  pageSize: 'A4' | 'Letter';
  pageMarginsMm: { top: number; right: number; bottom: number; left: number };
  pageNumbering: 'none' | 'footer-center' | 'footer-outer';
  generatedAt: string;
}

export interface SavedFilter {
  id: string;
  label: string;
  searchQuery: string;
  tagFilters: { path: string; operator: 'AND' | 'OR' | 'NOT' }[];
  showOnlyEmptyNotes: boolean;
  exportProfile?: SavedSearchExportProfile;
}
```

`SavedFiltersStore` owns the profile and must expose `updateExportProfile` and
`clearExportProfile`. It continues persisting the whole list in
`localStorage` under `solo-saved-filters`; no migration is required because
the profile is optional. `outputPath` is deliberately never copied into note
metadata or global settings.

The modal must validate page margins, required cover fields when the cover is
enabled, and that auto-export has an `outputPath`. Header/footer placeholders
are restricted to `{title}`, `{search}`, `{page}`, `{pages}`, and `{date}`.
Unknown placeholders remain literal text so user input never becomes a template
execution mechanism.

## Search And Export Boundary

`SearchPage` currently evaluates filters inline. Extract that predicate into a
pure `src/components/Search/model/filterNotes.ts` function so the screen and
exporter cannot diverge:

```ts
export interface SearchCriteria {
  searchQuery: string;
  tagFilters: SavedFilter['tagFilters'];
  showOnlyEmptyNotes: boolean;
}

export function filterNotes(notes: Note[], criteria: SearchCriteria): Note[];
```

The UI retains its relevance sorting for display. The exporter instead applies
the sidebar/book order (`notesStore.getSidebarNotes()`), filters it with the
same predicate, and uses that stable order for chapters and the table of
contents. This separates a user-facing relevance ranking from a deterministic
book order.

Extract the match-display decision from `SearchResults` into a pure function
used by both the screen and exporter. It returns either `whole-note` or
`paragraphs` with the matching HTML elements. A note matched by a note-level
tag is `whole-note`; paragraph-level tag and text matches are `paragraphs`.
The export renderer wraps each partial fragment with visible leading and
trailing ellipses (`…`) and never includes neighbouring unmatched content.

Before assembling a document, load the current HTML, CSS and PDF bytes for
every matched note. The export run takes a snapshot of note IDs, contents,
metadata, themes, CSS and PDF pages; later edits must not change a running job.

## Export Document Model

Keep document construction independent of PDF, EPUB, and native file APIs in
`src/components/Search/export/`:

```ts
export interface ExportAsset {
  id: string;
  mimeType: string;
  bytes: Uint8Array;
  fileName: string;
}

export interface ExportChapter {
  id: string;
  title: string;
  html: string;
  css: string;
  theme: string;
}

export interface ExportPdfPage {
  sourceNoteId: string;
  pageNumber: number;
  image: ExportAsset;
}

export interface ExportBook {
  title: string;
  author?: string;
  language: string;
  chapters: ExportChapter[];
  pdfPages: ExportPdfPage[];
  assets: ExportAsset[];
  profile: SavedSearchExportProfile;
}
```

Suggested file responsibilities:

- `export/buildExportBook.ts`: evaluates the saved filter, loads note content
  and styles, renders matched PDF notes with `pdfjs-dist`, resolves assets, and
  returns `ExportBook` plus skipped-note diagnostics.
- `export/normalizeNoteHtml.ts`: sanitizes exported HTML, rewrites resource
  URLs, replaces a carousel with a static image grid, and assigns stable IDs to
  headings.
- `export/buildBookStyles.ts`: produces the common print/EPUB stylesheet and
  a CSS scope for each chapter.
- `export/buildPdfHtml.ts`: renders cover, linked table of contents, chapters,
  headers/footers, and print rules to one HTML document.
- `export/buildEpubPackage.ts`: turns `ExportBook` into an EPUB 3 package with
  XHTML chapters, navigation document, OPF manifest, and assets.
- `export/ExportSettingsModal.tsx`: profile form, preview data, export action,
  progress and errors.
- `export/useSavedSearchExport.ts`: coordinates modal state and bridge calls;
  it must not contain HTML transformation logic.

The page-local placement is intentional: export is currently available only
from a saved search. If other entry points are later added, move the pure
builder and platform contract to shared modules, retaining UI wiring in Search.

## Fidelity Rules

### Themes And Custom CSS

Each chapter gets an isolated root:

```html
<article class="export-chapter theme-<theme-name>" data-note-id="<note-id>">
  ...note body...
</article>
```

The effective theme is the note's `theme`; if absent, use the current default
theme. Export theme tokens are emitted under that chapter selector. Note CSS is
parsed and rewritten so every selector is prefixed with the chapter root.
Reject `@import`, external font URLs, `position: fixed`, and selectors that
target `html`, `body`, or another chapter. Do not use the existing
`injectNoteStyles` helper: it only wraps CSS in `#note-editor-content` and
cannot isolate several notes in one book.

Unsupported or invalid custom CSS must not fail the entire export. Skip the
rule, retain the default/theme style, and include a warning in the result.

### PDF Source Notes

For every matching PDF note, use the existing `openPdfFile` bridge and
`pdfjs-dist` to render each source page at print resolution. `buildPdfHtml.ts`
emits one fixed-size export page per rendered PDF page, with page breaks before
and after it; it does not combine PDF pages into a text chapter. EPUB receives
the same images as one XHTML page per source PDF page. The generated table of
contents includes the source note title and links to its first page.

If the source PDF cannot be opened or rendered, the export continues and the
result reports that note and the failing page number. This is the only case in
which a matching PDF source is omitted.

### Images And Carousels

The asset resolver converts every internal `image://` image into bytes once and
assigns a package-local asset path. For EPUB, chapters reference that local
path; for PDF, the rendered document uses data URLs or an export-only local
protocol. Remote image URLs must be downloaded only after an explicit user
consent setting; the default is to omit them and report the URL.

`file://` DigiKam images must be copied into the export asset set after
validating that the URL resolves to a regular readable file. If an image cannot
be read, replace it with an accessible placeholder and report it.

Transform every TipTap `.carousel` node to:

```html
<figure class="export-gallery">
  <img src="..." alt="" />
</figure>
```

with one image per carousel item. PDF and EPUB CSS uses a responsive grid;
the media is static and never retains slider controls or scripts.

All images, gallery items, tables, headings and their following paragraph use
break avoidance where the renderer supports it:

```css
img, figure, .export-gallery, table {
  break-inside: avoid;
  page-break-inside: avoid;
}

h1, h2, h3 {
  break-after: avoid;
  page-break-after: avoid;
}
```

An image taller than the printable page is scaled down using `max-height` and
`max-width`; it is never clipped merely to satisfy break avoidance.

### Table Of Contents, Headers, And Page Numbers

Each chapter starts with one `h1` and a stable anchor ID. The PDF HTML table of
contents links to these anchors. EPUB emits the equivalent EPUB 3 `nav.xhtml`
landmark and table-of-contents navigation, so reader applications offer fast
chapter navigation.

On desktop, the PDF renderer owns physical headers, footers, and page numbers.
The hidden Electron print window must render templates populated with validated
profile values. CSS counters are not sufficient for dependable total-page
numbers in Chromium. EPUB does not promise physical page numbering because its
pagination is reader-controlled; it includes the title and author metadata and
the navigation document instead.

## Platform Contract

Renderer code may prepare the export book but must never receive arbitrary
filesystem write access. Add typed request/response APIs to `ElectronAPI` in
`src/types.tsx` and implement them through `nativeBridge`, Electron preload,
and Electron main-process IPC:

```ts
export interface ExportFileRequest {
  format: ExportFormat;
  suggestedFileName: string;
  outputPath?: string;
  html?: string;
  epubBytes?: Uint8Array;
  profile: SavedSearchExportProfile;
}

export interface ExportFileResult {
  success: boolean;
  outputPath?: string;
  error?: string;
}

exportFile(request: ExportFileRequest): Promise<ExportFileResult>;
```

For a manual request, Electron main invokes `dialog.showSaveDialog` with an
extension matching the format. For an automatic request, `outputPath` is used
only after main validates its extension and writes atomically: temporary file
in the same directory, then rename. The preload bridge exposes only
`exportFile`; it never exposes `fs`, a generic write method, or a generic IPC
channel.

PDF uses a hidden, sandboxed `BrowserWindow` with JavaScript disabled and a
dedicated export-only CSP. Main loads generated HTML, waits for local assets
and fonts, then calls `webContents.printToPDF`. It writes the resulting bytes
through the same atomic writer. EPUB is a deterministic ZIP package generated
from `ExportBook` and passed as bytes to the main process. Select a maintained
EPUB/ZIP library after licensing and security review; its adapter must be
isolated in `buildEpubPackage.ts`.

The bridge should return progress events for `preparing`, `resolving-assets`,
`rendering`, and `writing`. These are job-scoped IDs, not a global singleton,
so manual and automatic exports cannot overwrite each other's UI state.

## Auto-Export Coordination

`SavedSearchExportCoordinator` is instantiated by the root store only when
`flags.exportNotes` is enabled. It receives an explicit `noteClosed(noteId)`
event after `NotesStore.setSelectedNote` has saved the current note and before
the next selected note is activated. It also receives this event when Escape or
deep-link navigation closes a note. Metadata and paragraph-tag changes mark a
note dirty; they do not export immediately.

For each enabled profile, the coordinator first determines whether the closed
note could affect the saved filter. It then evaluates the saved filter and
compares a content fingerprint of the export snapshot with the profile's last
successful fingerprint. If unchanged, it does not write a file. This handles a
note entering or leaving a result set as well as changes inside an already
matching note.

Electron must delay window destruction for a bounded export flush. In the
`BrowserWindow` `close` handler, main prevents the first close, asks preload to
dispatch an `export:prepare-close` event, and waits for the renderer to save
the selected note and call `noteClosed`. The renderer replies through a
dedicated IPC acknowledgement after pending auto-export jobs finish or fail;
main then closes the window. A visible timeout and explicit cancellation path
avoid trapping the user if rendering fails. `window-all-closed` remains only
the platform quit policy, not the flush trigger.

The coordinator allows only one export per saved filter at a time. A second
close event during a job queues exactly one new run after completion. It skips
profiles without an output path and reports failures through the existing
toast/error channel. It does not schedule work while Solo is closed.

## Feature Flag

Add `export-notes` to `feature-flags.json` and expose it from
`src/utils/featureFlags.ts` as `flags.exportNotes`, with a matching ambient
`__FF_EXPORT_NOTES__` declaration. Gate every UI entry point and coordinator
creation with that static flag. Keep it `false` for `MOBILE` and `PACKAGED`.
The desktop default should remain `false` until the export flow is ready for a
controlled rollout.

## Delivery Plan

1. Add the flag, export profile types, SavedFiltersStore profile methods, and
   unit tests for profile persistence and validation.
2. Extract the pure saved-search predicate from `SearchPage`; cover text,
   tag, empty-note and combined filters, then make SearchPage use it.
3. Add the flag-gated saved-search-only button and settings modal; test that it
   is absent for ad-hoc searches and disabled without an output file when
   auto-export is selected.
4. Build and test the snapshot, whole-note/paragraph-fragment selection,
   ellipsis rendering, HTML normalization, theme/CSS scoping, gallery
   conversion, asset resolution, PDF-page rendering and skip diagnostics with
   fixture notes.
5. Implement EPUB package generation and validate its manifest, navigation,
   image assets and table of contents using an EPUB validator in CI.
6. Implement Electron PDF rendering, save dialog, atomic output write and IPC
   validation. Add an end-to-end desktop test using a fixture search.
7. Add the close-triggered coordinator, application-close IPC flush and
   fingerprint tests, then activate the desktop feature flag only after manual
   exports are verified.

## Acceptance Criteria

- The export settings entry point appears only after opening a saved search and
  only while `export-notes` is enabled.
- Exported HTML follows the search-result representation at export time and in
  sidebar order: whole notes for note-level matches, matched paragraphs with
  ellipses for paragraph-level and text matches.
- PDF contains a linked table of contents, configured title page, headers,
  footers, and physical page numbers.
- EPUB contains valid metadata, a navigation document, all resolved assets, and
  an equivalent table of contents.
- Every chapter retains its note theme and allowed custom styles without
  leaking styling into another chapter.
- Every carousel becomes a static image grid; all exportable images are kept
  intact on a page whenever their scaled dimensions allow it.
- Each matching source PDF is included as separate rendered pages. A PDF that
  cannot be rendered and unavailable/unsafe image resources do not crash the
  export; the user receives actionable skipped-item diagnostics.
- Automatic export is disabled by default, never prompts, writes atomically,
  runs at most once per saved filter at a time, and is triggered only when an
  influencing note closes or when the app closes with such a note open.
