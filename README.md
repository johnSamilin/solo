# Solo - Minimalistic Private Note-Taking App

Solo is a modern, privacy-focused note-taking application with an emphasis on typography and user experience. There's no AI, cloud storage and stuff. Just your thoughts.

I believe that your data is only yours and should not belong to any corporation or even single app. That's why it stays in your file system in plain HTML so that you could have access to it any time without additional instruments.

<img width="1150" height="912" alt="Screenshot1" src="https://github.com/user-attachments/assets/dc6634b1-26bc-4cd1-ac51-24bc72882ad7" />

<img width="1150" height="912" alt="Screenshot2" src="https://github.com/user-attachments/assets/74fe3592-23f3-4c2e-a3c6-3eb50cbb1fdb" />

[![Demo](docs/demo.png)](https://youtu.be/-xA6Gce_e0M)

# Contact
[Contact me](https://t.me/WatasheeBaka) if you have any questions.

## Key Features

### Integrations
- Supports Onyx Boox PDF annotations
- Supports Digikam so that you could insert image carousels based on tags

### 📝 Rich Text Editing
- Full-featured Markdown-style editor
- Support for headings, lists, and task lists
- Image and link embedding
- Clean, distraction-free interface

### 📚 Organization
- Hierarchical notebook structure
- Nested notebooks support
- Tag system with hierarchical organization
- Flexible note categorization
- Timeline view for chronological event visualization
- Date picker navigation for quick timeline browsing

### 🎨 Typography & Layout
- Multiple predefined themes:
  - Air: Spacious layout with drop caps
  - Typewriter: Monospace font with classic spacing
  - Narrow: Compact layout with minimal margins
  - FBI: typewriter-inspired
  - Alighieri
- Customizable typography settings:
  - Font family selection
  - Font size options
  - Line height adjustment
  - Page margins
  - Paragraph spacing
- Drop caps support with size customization
- Adjustable content width

### 💫 User Experience
- Zen mode for distraction-free writing
- Word and paragraph count
- Floating action button with quick access to tools
- Keyboard shortcuts for common actions
- Responsive sidebar with collapsible sections
- Smart sync notifications for unsynced changes
- Timeline view with callout-style note connections
- Date picker for quick timeline navigation

### 📱 Cross-Platform Support
- Desktop application (Linux)
- Mobile application (Android) - DIY

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
| `npm run build:desktop` | `desktop` | `__IS_DESKTOP__ = true` |
| `npm run build:android` | `android` | `__IS_ANDROID__ = true` |
| `npm run build:packaged` | `packaged` | `__IS_PACKAGED__ = true` |
| `npm run build` | — | builds desktop + android |

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

# Development
npm run electron:dev     # Desktop version

# Production builds
npm run electron:build  # Desktop version
```

## License

NO LICENSE
