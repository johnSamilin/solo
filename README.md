# Solo - Minimalistic Private Note-Taking App

Solo is a modern, privacy-focused note-taking application with an emphasis on typography and user experience. It's designed for users who value both aesthetics and security in their writing environment.

# Try it
[deploy](https://ros-plata.ru) - sorry for confusing domain. I use my old one for now, just too lazy to register new one.

# Contact
[Contact me](https://t.me/WatasheeBaka) if you have any questions.

## Key Features

### 📝 Rich Text Editing
- Full-featured Markdown-style editor
- Support for headings, lists, and task lists
- Image and link embedding
- Clean, distraction-free interface

### 🔒 Privacy & Security
- Built-in censorship system for sensitive content
- PIN-protected content hiding
- Note-level privacy controls
- Quick censorship toggle with keyboard shortcuts (Ctrl+.)
- Fake "disabled" state for enhanced security

### 📚 Organization
- Hierarchical notebook structure
- Nested notebooks support
- Tag system with hierarchical organization
- Flexible note categorization

### 🎨 Typography & Layout
- Multiple predefined themes:
  - Air: Spacious layout with drop caps
  - Typewriter: Monospace font with classic spacing
  - Narrow: Compact layout with minimal margins
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

### 📱 Cross-Platform Support
- Desktop application (Windows, macOS, Linux)
- Web version
- Consistent experience across all platforms

### 💾 Data Management
- Local storage for privacy
- Data export functionality
- No cloud dependency
- Complete data ownership

## Technical Details

### Platforms
- **Desktop**: Electron-based application
- **Web**: Standalone web application

### Development Stack
- React + TypeScript
- MobX for state management
- Vite for development and building
- TipTap for rich text editing
- Electron for desktop builds

### Build Modes
- Standalone (Web)
- Plugin (Electron)

## Getting Started

```bash
# Install dependencies
npm install

# Development
npm run dev              # Web version
npm run electron:dev     # Desktop version

# Production builds
npm run build           # Web version
npm run electron:build  # Desktop version
```

## License

MIT License - See LICENSE file for details