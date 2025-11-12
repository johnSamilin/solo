# Solo - Development History

## Initial Setup
- Created a basic Electron application with Vite and React
- Set up the project structure with TypeScript support
- Configured electron-builder for packaging
- Added basic styling and layout components

## Feature: Note Settings Modal
Added a button to FAB (Floating Action Button) that opens Note Settings modal with:
- Move to another notebook functionality
- Delete note button (styled in red)
- Integrated with existing notebook management system

## Feature: Note-level Censorship
- Added ability to mark entire notes as censored
- Censored notes are completely hidden when censorship is enabled
- Added lock icon indicator for censored notes in the sidebar
- Integrated with existing censorship system

## Feature: Notebook-level Censorship
- Added ability to mark entire notebooks as censored
- Censored notebooks are completely hidden when censorship is enabled
- Added lock icon indicator for censored notebooks
- Recursive censorship for nested notebooks (parent censorship affects children)
- Added notebook censorship toggle to notebook context menu
- Added notebook edit modal for managing notebook settings
- Improved notebook context menu to only appear on right-click

## Feature: Enhanced Typography
- Added customizable page margins (narrow, medium, wide)
- Added adjustable paragraph spacing (tight, normal, relaxed)
- Added support for drop caps with customizable size and line height
- Added toggle for enabling/disabling drop caps
- Added customizable horizontal margins and maximum editor width
- Improved overall text layout and readability
- Added theme selector with predefined themes:
  - Air: Spacious layout with drop caps
  - Typewriter: Monospace font with classic spacing
  - Narrow: Compact layout with minimal margins

## Feature: Sidebar Enhancements
- Added option to pin/unpin sidebar
- When unpinned, sidebar is hidden with a toggle button
- Added subtle button in top-left corner for unpinned sidebar
- Smooth transitions for sidebar visibility

## Feature: Auto Zen Mode
- Added automatic zen mode trigger when typing more than 5 words
- Seamless transition to focused writing environment

## Feature: Logging System
- Added comprehensive logging system for both Electron and mobile apps
- Implemented log rotation with 5MB file size limit
- Added daily log rotation for Electron app
- Added compressed log archives for Electron app
- Added maximum 5 log files limit for mobile app
- Implemented JSON-formatted log entries with timestamps
- Added error stack traces and context preservation
- Logs stored in app-specific directories

## Feature: Secure Settings Storage
- Implemented secure local storage for sensitive settings
- Separated regular and secure settings storage
- Prevented sensitive data from being synced to WebDAV
- Enhanced security for censorship and WebDAV credentials

## Feature: Timeline View (v2.3.0)
- Added chronological timeline visualization for important events
- Notes tagged with "Main events" or "Главные события" appear in timeline
- Beautiful callout-style connections between notes and timeline markers
- Smooth curved connector lines for visual appeal
- Date picker in header for quick navigation to any month/year
- Automatic scrolling to current month on timeline open
- Virtual scrolling for performance with large date ranges
- Year separators for better visual organization

## Feature: Smart Sync Notifications (v2.3.0)
- Intelligent detection of unsynced local changes
- Automatic notifications when server data is older than local changes
- Quick sync button in notification toast
- Ctrl+S keyboard shortcut for instant sync
- Non-intrusive reminder system that auto-dismisses
- Server timestamp comparison for accurate sync status

## Bug Fixes
### Editor Improvements
- Fixed cursor jumping issue when typing in the editor
- Added proper whitespace handling with `white-space: pre-wrap`
- Improved content update logic to prevent unnecessary re-renders
- Fixed space handling after the last word in notes

## Deployment
- Successfully deployed to Netlify
- Site available at: https://comforting-starlight-b74676.netlify.app
- Provided claim URL for transferring to personal Netlify account

## Technical Details

### Components Added
- NoteSettingsModal
- Enhanced SettingsModal with Censorship tab
- Updated FAB with settings button
- Added lock icons for censored notes and notebooks
- Added EditNotebookModal for notebook management
- Added notebook context menu
- Added sidebar toggle button for unpinned state

### State Management
- Added censorship settings to SettingsStore
- Implemented PIN verification logic
- Added fake disabled state for security
- Added note-level censorship state
- Added notebook-level censorship state
- Added typography customization settings
- Added theme management system
- Added notebook editing functionality
- Added sidebar pinning state
- Added secure settings storage

### Security Features
- Censorship enabled by default
- No visual indication of incorrect PIN
- Quick enable shortcut
- Fake disabled state for enhanced security
- Note-level censorship support
- Notebook-level censorship support
- Recursive notebook censorship
- Secure local storage for sensitive settings

### UI/UX Improvements
- Red styling for dangerous actions
- Modal system for settings
- Intuitive PIN management
- Keyboard shortcuts for quick actions
- Visual indicators for censored notes and notebooks
- Improved editor responsiveness and reliability
- Enhanced typography controls for better readability
- Customizable page layout options
- Theme presets for quick style changes
- Context menu for notebook management
- Automatic zen mode for focused writing
- Pinnable sidebar with smooth transitions

### Logging System
- Implemented rotating log files
- Added size-based log rotation
- Added timestamp and context to log entries
- Separated info and error level logging
- Added stack trace preservation
- Implemented platform-specific storage locations