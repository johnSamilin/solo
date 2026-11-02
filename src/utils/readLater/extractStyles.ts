// Extracts base typography tokens (colors, fonts, sizes) from a raw HTML page
// and returns them as flat CSS declarations compatible with `injectNoteStyles`
// (which wraps them in `#note-editor-content { ... }`).
//
// The extracted tokens go into the note's `.css` sidecar; per-element colors and
// sizes are already carried by inline `style` attributes in the extracted HTML.

const TYPO_PROPS = [
  'font-family',
  'font-size',
  'line-height',
  'color',
  'background-color',
  'letter-spacing',
  'word-spacing',
  'font-weight',
  'font-style',
];

const BASE_SELECTOR_RE = /(html|body|:root|article|main|\.article|\.content|\.post|\.entry|\.story|\.blog)\b/i;

function parseDeclarations(styleText: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of styleText.split(';')) {
    const idx = part.indexOf(':');
    if (idx === -1) continue;
    const prop = part.slice(0, idx).trim().toLowerCase();
    const value = part.slice(idx + 1).trim();
    if (prop && value) result[prop] = value;
  }
  return result;
}

function collectStyleBlockCss(cssText: string): Record<string, string> {
  const result: Record<string, string> = {};
  const withoutComments = cssText.replace(/\/\*[\s\S]*?\*\//g, '');
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = ruleRe.exec(withoutComments)) !== null) {
    const selector = match[1].trim();
    if (BASE_SELECTOR_RE.test(selector)) {
      const decls = parseDeclarations(match[2]);
      for (const [prop, value] of Object.entries(decls)) {
        if (TYPO_PROPS.includes(prop)) result[prop] = value;
      }
    }
  }
  return result;
}

function extractInlineStyles(doc: Document): Record<string, string> {
  const result: Record<string, string> = {};
  const BASE_TAGS = new Set(['HTML', 'BODY', 'ARTICLE', 'MAIN']);

  doc.querySelectorAll('html, body, article, main, section, div, p').forEach((node) => {
    const classAndId = `${node.className || ''} ${node.id || ''}`;
    const isBaseTag = BASE_TAGS.has(node.tagName);
    const isContentContainer = /article|content|post|entry|story|blog|main|body/i.test(classAndId);
    if (!isBaseTag && !isContentContainer) return;

    const style = node.getAttribute('style');
    if (!style) return;
    const decls = parseDeclarations(style);
    for (const [prop, value] of Object.entries(decls)) {
      if (TYPO_PROPS.includes(prop)) result[prop] = value;
    }
  });

  return result;
}

export function extractArticleStyles(rawHtml: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml, 'text/html');

  const tokens: Record<string, string> = {};

  // Inline styles are more specific, so they win over stylesheet rules.
  Object.assign(tokens, extractInlineStyles(doc));

  doc.querySelectorAll('style').forEach((styleEl) => {
    const css = collectStyleBlockCss(styleEl.textContent || '');
    for (const [prop, value] of Object.entries(css)) {
      if (!tokens[prop]) tokens[prop] = value;
    }
  });

  const ordered = TYPO_PROPS.filter((prop) => {
    const value = tokens[prop];
    return value !== undefined && String(value).trim().length > 0;
  });

  if (ordered.length === 0) return '';

  return ordered.map((prop) => `${prop}: ${tokens[prop]};`).join(' ');
}
