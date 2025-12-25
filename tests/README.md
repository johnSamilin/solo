# Playwright Tests

This directory contains end-to-end tests for the Solo note-taking application using Playwright.

## Setup

The tests are configured to mock the Electron API, allowing them to run in a standard browser environment without requiring Electron.

## Running Tests

```bash
npm test
npm run test:ui
npm run test:headed
```

- `npm test` - Runs tests in headless mode
- `npm run test:ui` - Opens Playwright's UI mode for interactive testing
- `npm run test:headed` - Runs tests with a visible browser

## Test Structure

### Fresh Start Tests (`fresh-start.spec.ts`)

Tests the basic workflow of creating notebooks and notes:

1. **Fresh start flow**
   - Opens the application
   - Creates a new notebook named "My Test Notebook"
   - Verifies the notebook appears in the sidebar and is selected
   - Creates a note named "1 note" with two Lorem Ipsum paragraphs
   - Verifies the note appears in the sidebar

## Mocks

### Electron API Mock (`mocks/electronAPI.ts`)

Provides a complete mock implementation of the Electron API that:
- Maintains an in-memory file structure
- Supports creating/reading/updating/deleting notebooks and notes
- Manages file metadata
- Simulates all Electron API methods

The mock is injected into the page using `page.addInitScript()` before each test runs.

## Writing New Tests

To create new tests:

1. Create a new `.spec.ts` file in the `tests` directory
2. Use the existing `beforeEach` setup to inject the Electron API mock
3. Write your test scenarios using Playwright's testing API

Example:

```typescript
import { test, expect } from '@playwright/test';

test.describe('My Feature', () => {
  test.beforeEach(async ({ page }) => {
    // Electron API mock is automatically injected
  });

  test('should do something', async ({ page }) => {
    await page.goto('/');
    // Your test code here
  });
});
```

## Configuration

Tests are configured in `playwright.config.ts` at the project root.

Key settings:
- Test directory: `./tests`
- Base URL: `http://localhost:5173`
- Automatic dev server startup
- Screenshots on failure
- Trace on first retry
