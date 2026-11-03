# Solo — minimalistic private note‑taking app (HTML files, typography-first)

Solo is a privacy‑focused note‑taking app with a strong emphasis on typography and reading/writing experience.
No cloud. No accounts. No AI. Your notes stay on your disk as **plain HTML**.

- **Local-first**: notes are files you own
- **Typography-first**: themes + fine-grained layout controls
- **Timeline + notebooks + tags**
- **Integrations**: Onyx Boox PDF annotations, Digikam tag-based image carousels


[DEMO](https://johnsamilin.github.io/) - see and test the app and it's visual themes.

Solo is a modern, privacy-focused note-taking application with an emphasis on typography and user experience. There's no AI, cloud storage and stuff. Just your thoughts.

I believe that your data is only yours and should not belong to any corporation or even single app. That's why it stays in your file system in plain HTML so that you could have access to it any time without additional instruments.

<img width="1150" height="912" alt="Screenshot1" src="https://github.com/user-attachments/assets/dc6634b1-26bc-4cd1-ac51-24bc72882ad7" />

<img width="1150" height="912" alt="Screenshot2" src="https://github.com/user-attachments/assets/74fe3592-23f3-4c2e-a3c6-3eb50cbb1fdb" />

## Why Solo
Most note apps lock you into a database, a cloud, or a proprietary format.
Solo stores notes as **HTML in your filesystem**, so you can read, backup, sync, and migrate them anytime.

## Download
### Desktop (Linux, Mac)
- Download the latest release: **Releases → Solo-x.y.z** (recommended)
- Or build from source (see below)

### Android
- Download the latest release: **Releases → Solo-x.y.z** (recommended)
- Or build from source (see below)

# Contact
[Contact me](https://t.me/WatasheeBaka) if you have any questions.

## Features
### Writing
- Rich text editor (TipTap)
- Links, images, tasks, headings
- Zen mode, keyboard shortcuts, word/paragraph count

### Organization
- Notebooks (nested), tags (hierarchical)
- Timeline view + date picker navigation

### Typography
- Themes: [Air](https://johnsamilin.github.io/?note=Theme-+air.html), [Typewriter](https://johnsamilin.github.io/?note=Theme-+typewriter.html), [Narrow](https://johnsamilin.github.io/?note=Theme-+narrow.html), [FBI](https://johnsamilin.github.io/?note=Theme-+FBI.html), [Alighieri](https://johnsamilin.github.io/?note=Theme-+Alighieri.html), [Terminal](https://johnsamilin.github.io/?note=Theme-+terminal.html)
- Controls: font, size, line height, margins, paragraph spacing, drop caps, content width

## Integrations
- **Onyx Boox**: import / work with PDF annotations
- **Digikam**: insert image carousels based on tags

## Technical Details

### Development Stack
- React + TypeScript
- MobX for state management
- Vite for development and building
- TipTap for rich text editing
- Electron for desktop builds
- Kotlin for mobile

### Feature Flags

Feature flags live in [`feature-flags.json`](feature-flags.json) at the project root and are read **at compile time** (inlined into the bundle via Vite `define`).

The top-level keys describe the run mode:

- `PACKAGED` — embedded/plugin build (`__IS_PACKAGED__ === true`)
- `DESKTOP` — native Electron client
- `MOBILE` — native Android client

```json
{
  "PACKAGED": { "extended-search": false },
  "DESKTOP":  { "extended-search": true },
  "MOBILE":   { "extended-search": false }
}
```

The build mode is resolved **entirely at compile time** via the `PLATFORM`
environment variable (each platform gets its own bundle):

| Command | PLATFORM | Constants |
| --- | --- | --- |
| `npm run build:desktop` | `desktop` | two Electron packages: light and extended search |
| `npm run build:desktop:web` | `desktop` | web bundle for Electron (used internally) |
| `npm run build:android` | `android` | `__IS_ANDROID__ = true` |
| `npm run build:packaged` | `packaged` | `__IS_PACKAGED__ = true` |
| `npm run build` | — | builds both desktop packages + android |

To build both desktop variants on the current host, install dependencies in the
root and `native-clients/electron`, then run:

```sh
npm run build:desktop
```

Requires Go 1.23+, a C compiler, `curl` and `tar`. It reuses existing
`model.onnx` and `tokenizer.json` in `extended-search-assets/models/` and the
host-compatible ONNX shared library in `extended-search-assets/onnx-runtime/lib/`;
any missing files are downloaded there and cached for the next build. The model
profile `model.json` comes from `instruments/semantic-search/models/`. If the
Vosk resources for voice memos are not already in
`native-clients/electron/{models,libvosk}/`, fetch them separately with
`bash scripts/fetch-vosk-models.sh`. The command builds the Go search binary and produces
`native-clients/electron/out/light/` (without the search
instrument or its model/runtime) and `native-clients/electron/out/extended/`
(with all three under `resources/dist/instruments/semantic-search/`). Set
`SOLO_EXTENDED_SEARCH_ASSETS=/absolute/path` to use a different assets folder.
Desktop packaging of ONNX Runtime currently supports macOS (arm64/x64) and
Linux (x64/arm64); it fails explicitly on other hosts.

`SOLO_EXTENDED_SEARCH=true|false` overrides only the desktop web build's
compile-time flag. The two-package command sets it for each variant automatically.

Each flag is expanded into a compile-time boolean constant `__FF_<NAME>__`
(e.g. `extended-search` → `__FF_EXTENDED_SEARCH__`), so unused branches are
tree-shaken out of the per-platform bundle.

Use the static `flags` object in code (best for tree-shaking):

```ts
import { flags } from './utils/featureFlags';

if (flags.extendedSearch) {
  // compile-time removed from bundles where the flag is false
}
```

A dynamic helper is also available (no tree-shaking, uses the inlined
active flag set):

```ts
import { isFeatureEnabled } from './utils/featureFlags';

if (isFeatureEnabled('extended-search')) { /* ... */ }
```

## Getting Started

```bash
# Install dependencies
npm install
npm --prefix native-clients/electron install

# Development
npm --prefix native-clients/electron run electron:start

# Both desktop packages
npm run build:desktop
```

## License

NO LICENSE

## Star History

<a href="https://www.star-history.com/?type=date&repos=johnSamilin%2Fsolo">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=johnSamilin/solo&type=date&theme=dark&legend=top-left&sealed_token=Af0q_-g4pI1nw3R5Btm8o4MEKhv6hlgqentNeaPUIH3rvJCRLu8yj760L0gTwBu7psQCi5cYOBCJfgNSsAziV20_xKAaW1XWsAvDuv1VUsaHaC9eUmuNvXdIBLVHRd9SjFcB2Ku7Q1eu6OzxuN_Hi85r1CfgIOuAxf8pX_0S_E_fuacRqKLhbXkxR9qC" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=johnSamilin/solo&type=date&legend=top-left&sealed_token=Af0q_-g4pI1nw3R5Btm8o4MEKhv6hlgqentNeaPUIH3rvJCRLu8yj760L0gTwBu7psQCi5cYOBCJfgNSsAziV20_xKAaW1XWsAvDuv1VUsaHaC9eUmuNvXdIBLVHRd9SjFcB2Ku7Q1eu6OzxuN_Hi85r1CfgIOuAxf8pX_0S_E_fuacRqKLhbXkxR9qC" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=johnSamilin/solo&type=date&legend=top-left&sealed_token=Af0q_-g4pI1nw3R5Btm8o4MEKhv6hlgqentNeaPUIH3rvJCRLu8yj760L0gTwBu7psQCi5cYOBCJfgNSsAziV20_xKAaW1XWsAvDuv1VUsaHaC9eUmuNvXdIBLVHRd9SjFcB2Ku7Q1eu6OzxuN_Hi85r1CfgIOuAxf8pX_0S_E_fuacRqKLhbXkxR9qC" />
 </picture>
</a>
