import * as fs from 'fs';
import * as path from 'path';
import type { Plugin } from 'vite';

/**
 * Vite plugin for the `packaged` build mode.
 *
 * Reads a folder of notes (passed via the `--content <relative-path>` build flag
 * or the `SOLO_CONTENT` env variable) and generates a virtual module
 * `virtual:solo-content` that exposes:
 *   - `structure`  — a static `FileNode[]` tree (mirrors the desktop `readStructure`);
 *   - `loadContent(path)` — a function that lazily fetches note HTML content on demand.
 *
 * Note HTML files are emitted as separate build assets, so their content is only
 * downloaded when a note is actually opened (see `openFile` in `createStubAPI`).
 */

const VIRTUAL_ID = 'virtual:solo-content';
const RESOLVED_VIRTUAL_ID = '\0' + VIRTUAL_ID;

interface FileMetadata {
  id: string;
  tags: string[];
  createdAt: string;
  theme?: string;
  paragraphTags?: string[];
}

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  metadata?: FileMetadata;
  cssPath?: string;
}

/** Extract the `--content <path>` flag from process arguments. */
export function resolveContentDir(
  argv: string[] = process.argv,
  env: Record<string, string | undefined> = process.env,
): string | null {
  // The build wrapper forwards `--content` through SOLO_CONTENT.
  if (env.SOLO_CONTENT) return env.SOLO_CONTENT;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--content') {
      return argv[i + 1] ?? null;
    }
    if (arg.startsWith('--content=')) {
      return arg.slice('--content='.length);
    }
  }
  return null;
}

function normalizeMetadata(raw: unknown): FileMetadata | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const meta = raw as Record<string, unknown>;
  const tags = Array.isArray(meta.tags)
    ? meta.tags.map((tag) =>
        typeof tag === 'object' && tag !== null
          ? String((tag as Record<string, unknown>).path ?? '')
          : String(tag),
      )
    : [];
  return {
    id: typeof meta.id === 'string' ? meta.id : String(meta.id ?? ''),
    tags,
    createdAt: typeof meta.createdAt === 'string' ? meta.createdAt : '',
    theme: typeof meta.theme === 'string' ? meta.theme : undefined,
    paragraphTags: Array.isArray(meta.paragraphTags)
      ? meta.paragraphTags.map(String)
      : undefined,
  };
}

/**
 * Recursively scan a directory building a `FileNode[]` tree.
 * Collects the absolute path of every `.html` note into `htmlFiles`
 * (keyed by its relative POSIX path) for later lazy loading.
 */
function readDirectory(
  dirPath: string,
  basePath: string,
  htmlFiles: Map<string, string>,
): FileNode[] {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const nodes: FileNode[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(basePath, fullPath).split(path.sep).join('/');

    let isDirectory = entry.isDirectory();
    let isFile = entry.isFile();

    if (entry.isSymbolicLink()) {
      try {
        const stats = fs.statSync(fullPath);
        isDirectory = stats.isDirectory();
        isFile = stats.isFile();
      } catch {
        continue;
      }
    }

    if (isDirectory) {
      const children = readDirectory(fullPath, basePath, htmlFiles);
      nodes.push({ name: entry.name, path: relativePath, type: 'folder', children });
    } else if (isFile && (entry.name.endsWith('.html') || entry.name.endsWith('.pdf'))) {
      const ext = path.extname(entry.name);
      const metadataPath = fullPath.replace(new RegExp(`\\${ext}$`), '.json');
      const cssPath = fullPath.replace(new RegExp(`\\${ext}$`), '.css');
      let metadata: FileMetadata | undefined;
      let cssRelativePath: string | undefined;

      if (fs.existsSync(metadataPath)) {
        try {
          metadata = normalizeMetadata(JSON.parse(fs.readFileSync(metadataPath, 'utf-8')));
        } catch {
          // ignore malformed metadata
        }
      }

      if (ext === '.html' && fs.existsSync(cssPath)) {
        cssRelativePath = path.relative(basePath, cssPath).split(path.sep).join('/');
      }

      if (entry.name.endsWith('.html')) {
        htmlFiles.set(relativePath, fullPath);
      }

      nodes.push({
        name: entry.name,
        path: relativePath,
        type: 'file',
        metadata,
        cssPath: cssRelativePath,
      });
    } else if (!entry.name.endsWith('.json') && !entry.name.endsWith('.css')) {
      nodes.push({ name: entry.name, path: relativePath, type: 'file' });
    }
  }

  return nodes.sort((a, b) => {
    if (a.type === b.type && a.type === 'file') {
      return (a.metadata?.createdAt ?? '') > (b.metadata?.createdAt ?? '') ? 1 : -1;
    }
    if (a.type === 'folder') return -1;
    return 0;
  });
}

export interface ContentPluginOptions {
  /** When false the virtual module resolves to an empty structure (non-packaged builds). */
  enabled?: boolean;
}

export function contentPlugin(options: ContentPluginOptions = {}): Plugin {
  const enabled = options.enabled ?? true;
  let contentDir: string | null = null;
  let structure: FileNode[] = [];
  let htmlFiles = new Map<string, string>();

  const scan = (root: string) => {
    if (!enabled) {
      contentDir = null;
      structure = [];
      htmlFiles = new Map();
      return;
    }

    const rawDir = resolveContentDir();
    if (!rawDir) {
      contentDir = null;
      structure = [];
      htmlFiles = new Map();
      return;
    }

    contentDir = path.isAbsolute(rawDir) ? rawDir : path.resolve(root, rawDir);
    htmlFiles = new Map();

    if (!fs.existsSync(contentDir)) {
      console.warn(`[solo-content] Content directory not found: ${contentDir}`);
      structure = [];
      return;
    }

    structure = readDirectory(contentDir, contentDir, htmlFiles);
    console.log(
      `[solo-content] Indexed ${htmlFiles.size} note(s) from ${contentDir}`,
    );
  };

  return {
    name: 'solo-content',

    configResolved(config) {
      scan(config.root);
    },

    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_VIRTUAL_ID;
      return null;
    },

    load(id) {
      if (id !== RESOLVED_VIRTUAL_ID) return null;

      // Build a switch of dynamic imports so each note's HTML is a lazy chunk.
      const entries = [...htmlFiles.entries()];
      const cases = entries
        .map(([relPath, absPath]) => {
          const importPath = JSON.stringify(absPath + '?raw');
          return `    case ${JSON.stringify(relPath)}:\n      return (await import(${importPath})).default;`;
        })
        .join('\n');

      return `export const structure = ${JSON.stringify(structure)};

export async function loadContent(relativePath) {
  switch (relativePath) {
${cases}
    default:
      return null;
  }
}
`;
    },
  };
}

export { VIRTUAL_ID as SOLO_CONTENT_MODULE_ID };
