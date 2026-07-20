#!/usr/bin/env node
/**
 * Build wrapper for the `packaged` mode.
 *
 * Vite's CLI (cac) rejects unknown flags, so we parse `--content <path>` here,
 * expose it to the config via the `SOLO_CONTENT` env variable, and then run
 * `vite build` without the custom flag.
 *
 * Usage:
 *   node scripts/build-packaged.mjs --content ./notes
 *   npm run build:packaged -- --content ./notes
 */
import { spawnSync } from 'node:child_process';

function parseContent(argv) {
  const rest = [];
  let content = process.env.SOLO_CONTENT ?? null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--content') {
      content = argv[i + 1] ?? null;
      i++;
    } else if (arg.startsWith('--content=')) {
      content = arg.slice('--content='.length);
    } else {
      rest.push(arg);
    }
  }

  return { content, rest };
}
console.log(process.argv.slice(2))
const { content, rest } = parseContent(process.argv.slice(2));

if (!content) {
  console.error(
    'Error: packaged build requires a content folder.\n' +
      'Usage: npm run build:packaged -- --content <relative-path-to-notes>',
  );
  process.exit(1);
}

const env = {
  ...process.env,
  PLATFORM: 'packaged',
  SOLO_CONTENT: content,
};

const viteBin = process.platform === 'win32' ? 'vite.cmd' : 'vite';
const result = spawnSync(viteBin, ['build', ...rest], {
  stdio: 'inherit',
  env,
  shell: process.platform === 'win32',
  cwd: process.cwd(),
});

process.exit(result.status ?? 1);
