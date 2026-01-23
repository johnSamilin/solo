# Auto-Update System

This Electron app includes an automatic update system that checks for new versions weekly and allows users to update the app seamlessly.

## Features

- **Weekly Update Checks**: The app automatically checks for updates once per week
- **Manual Update Checks**: Users can manually check for updates via the Help menu
- **Unsigned macOS Builds**: Supports unsigned builds for easy distribution
- **GitHub Releases Integration**: Uses GitHub Releases as the update distribution channel

## How It Works

1. The app checks for updates on GitHub Releases weekly (or manually via the Help menu)
2. When an update is available, a dialog prompts the user to download it
3. Once downloaded, users can choose to install immediately or later
4. Updates are installed on app restart

## Publishing a New Release

### Prerequisites

1. Set up a GitHub Personal Access Token:
   - Go to GitHub Settings > Developer settings > Personal access tokens
   - Create a token with `repo` scope
   - Set it as `GITHUB_TOKEN` in your GitHub Actions secrets

### Creating a Release

1. Update the version in `package.json`
2. Commit and push changes
3. Create and push a git tag:
   ```bash
   git tag v3.1.1
   git push origin v3.1.1
   ```
4. GitHub Actions will automatically build and publish the release

### Manual Publishing

If you need to publish manually:

```bash
cd native-clients/electron
export GITHUB_TOKEN=your_token_here
npm run publish
```

## Configuration

### Update Check Frequency

The update check frequency is configured in `electron/autoUpdater.ts`:

```typescript
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
```

Change this value to adjust the update check interval.

### macOS Unsigned Builds

The forge configuration includes:

```javascript
osxSign: {},
osxNotarize: undefined,
```

This allows building unsigned macOS apps. For signed builds, you'll need to:

1. Obtain an Apple Developer certificate
2. Configure `osxSign` with your certificate details
3. Configure `osxNotarize` for notarization

## User Experience

### Automatic Updates

- App silently checks for updates weekly in the background
- No interruption to the user unless an update is found

### Manual Updates

Users can check for updates via:
- Menu: **Help > Check for Updates...**

### Update Flow

1. **Update Available**: Dialog shows new version details with "Download" and "Later" options
2. **Downloading**: Progress is logged (visible in dev tools if needed)
3. **Update Ready**: Dialog prompts to restart now or later
4. **Installation**: App installs update on next restart

## Development

### Testing Updates

To test the update system in development:

1. Build and publish a release to GitHub
2. Install that version locally
3. Publish a new version with a higher version number
4. The installed app should detect and offer to install the new version

### Disable Auto-Updates in Development

Auto-updates are automatically disabled in development mode:

```typescript
if (process.env.NODE_ENV !== 'development') {
  updateManager.startPeriodicChecks();
}
```

## Troubleshooting

### Updates Not Appearing

1. Check that releases are published on GitHub (not drafts)
2. Verify the version number follows semantic versioning
3. Check the logs for error messages

### macOS Gatekeeper Issues

For unsigned builds, users may need to:
1. Right-click the app and select "Open"
2. Or go to System Preferences > Security & Privacy and allow the app

### Windows SmartScreen

Windows may show a warning for unsigned apps. Users should:
1. Click "More info"
2. Click "Run anyway"

## Future Improvements

- Add delta updates for faster downloads
- Implement signed builds for macOS and Windows
- Add progress bar in UI during download
- Provide release notes in update dialogs
