#!/usr/bin/env node
/**
 * Generate an RSS 2.0 feed for the packaged Solo build.
 *
 * Scans the content directory (passed as `--content <path>` or via
 * the `SOLO_CONTENT` env variable), reads note metadata from the
 * accompanying `.json` files (or falls back to file mtime), and
 * writes `feed.xml` into the output directory.
 *
 * Usage:
 *   node scripts/generate-rss.mjs --content ./notes --out ./dist
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

// ── Config ────────────────────────────────────────────────────────
const SITE_URL = 'https://johnsamilin.github.io';
const FEED_DESCRIPTION = 'Latest stuff from John Samilin';
const FEED_TITLE = 'Solo Notes';
const MAX_ITEMS = 50;

// ── Helpers ───────────────────────────────────────────────────────

function parseArgs(argv) {
  let content = null;
  let out = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--content') { content = argv[++i] ?? null; }
    else if (arg.startsWith('--content=')) { content = arg.slice('--content='.length); }
    else if (arg === '--out') { out = argv[++i] ?? null; }
    else if (arg.startsWith('--out=')) { out = arg.slice('--out='.length); }
  }
  return { content, out };
}

/** Get the last commit date or mtime of a file. */
function getFileDate(filePath) {
  try {
    const output = execSync(
      'git log -1 --format=%cI -- ' + JSON.stringify(filePath),
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 },
    ).trim();
    if (output) return output;
  } catch { /* fall through */ }
  try {
    return fs.statSync(filePath).mtime.toISOString();
  } catch {
    return new Date(0).toISOString();
  }
}

/** Escape a string for XML text content. */
function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"');
}

// ── Main ──────────────────────────────────────────────────────────

const { content: contentDir, out: outDir } = parseArgs(process.argv.slice(2));

if (!contentDir || !outDir) {
  console.error(
    'Usage: node scripts/generate-rss.mjs --content <notes-dir> --out <output-dir>',
  );
  process.exit(1);
}

if (!fs.existsSync(contentDir)) {
  console.error('Content directory not found: ' + contentDir);
  process.exit(1);
}

// ── Collect all notes with dates ──
const notes = [];

function walk(dir, basePath, notebooks) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(basePath, fullPath).split(path.sep).join('/');

    if (entry.isDirectory() || (entry.isSymbolicLink() && fs.statSync(fullPath).isDirectory())) {
      walk(fullPath, basePath, [...notebooks, entry.name]);
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      const metadataPath = fullPath.replace(/\.html$/, '.json');
      let title = entry.name.replace(/\.html$/, '');
      let createdAt = null;
      let updatedAt = null;
      let tags = [];

      if (fs.existsSync(metadataPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
          title = meta.title ?? title;
          createdAt = meta.createdAt ?? null;
          updatedAt = meta.updatedAt ?? null;
          tags = Array.isArray(meta.tags) ? meta.tags : [];
        } catch { /* ignore */ }
      }

      const date = updatedAt ?? createdAt ?? getFileDate(fullPath);

      notes.push({
        relPath,
        title,
        date,
        created: createdAt ?? date,
        tags,
        notebooks,
      });
    }
  }
}

walk(contentDir, contentDir, []);

// Sort by date descending
notes.sort((a, b) => b.date.localeCompare(a.date));

// Take the most recent N
const recent = notes.slice(0, MAX_ITEMS);

// ── Build RSS XML ──
const now = new Date().toUTCString();
const items = recent.map(n => {
  const link = SITE_URL + '/?note=' + encodeURIComponent(n.relPath);
  const pubDate = new Date(n.date).toUTCString();
  const categories = n.tags
    .map(t => '      <category>' + escapeXml(t) + '</category>')
    .join('\n');
  const notebookPath = n.notebooks.length > 0 ? n.notebooks.join(' / ') : '';

  return [
    '    <item>',
    '      <title>' + escapeXml(n.title) + '</title>',
    '      <link>' + escapeXml(link) + '</link>',
    '      <guid isPermaLink="false">' + escapeXml(n.relPath) + '</guid>',
    '      <pubDate>' + pubDate + '</pubDate>',
    categories,
    '    </item>',
  ].filter(Boolean).join('\n');
}).join('\n');

const feed = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<rss version="2.0"',
  '     xmlns:atom="http://www.w3.org/2005/Atom"',
  '     xmlns:content="http://purl.org/rss/1.0/modules/content/"',
  '     xmlns:dc="http://purl.org/dc/elements/1.1/">',
  '  <channel>',
  '    <title>' + escapeXml(FEED_TITLE) + '</title>',
  '    <link>' + escapeXml(SITE_URL) + '</link>',
  '    <description>' + escapeXml(FEED_DESCRIPTION) + '</description>',
  '    <language>ru</language>',
  '    <lastBuildDate>' + now + '</lastBuildDate>',
  '    <atom:link href="' + escapeXml(SITE_URL) + '/feed.xml" rel="self" type="application/rss+xml"/>',
  '    <image>',
  '      <url>' + escapeXml(SITE_URL) + '/icon.png</url>',
  '      <title>' + escapeXml(FEED_TITLE) + '</title>',
  '      <link>' + escapeXml(SITE_URL) + '</link>',
  '    </image>',
  items,
  '  </channel>',
  '</rss>',
  '',
].join('\n');

// ── Write ──
const outPath = path.resolve(outDir, 'feed.xml');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, feed, 'utf-8');
console.log('RSS feed written to ' + outPath + ' (' + recent.length + ' items)');
