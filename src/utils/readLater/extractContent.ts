// Readability-style article extractor that runs on a DOMParser-produced
// document in the renderer. No external dependencies, no network access — the
// raw HTML is provided by the native `fetchUrl` bridge method.

export interface ExtractedArticle {
  title: string;
  byline?: string;
  html: string;
  excerpt?: string;
  siteName?: string;
}

const UNLIKELY_TAGS = new Set([
  'SCRIPT', 'STYLE', 'LINK', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'EMBED',
  'FORM', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'NAV', 'FOOTER',
  'HEADER', 'ASIDE', 'SVG', 'VIDEO', 'AUDIO', 'CANVAS', 'DIALOG', 'TEMPLATE',
]);

const ALLOWED_TAGS = new Set([
  'A', 'ABBR', 'B', 'BLOCKQUOTE', 'BR', 'CITE', 'CODE', 'DEL', 'EM',
  'FIGCAPTION', 'FIGURE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HR', 'I',
  'IMG', 'LI', 'OL', 'P', 'PRE', 'Q', 'S', 'SMALL', 'SPAN', 'STRONG',
  'SUB', 'SUP', 'TABLE', 'TBODY', 'TD', 'TH', 'THEAD', 'TR', 'UL',
]);

const ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  A: ['href', 'title'],
  IMG: ['src', 'alt', 'title'],
};

const POSITIVE_RE = /(article|body|content|entry|hentry|main|page|post|text|blog|story)/i;
const UNLIKELY_RE = /(combx|comment|com-|contact|foot|footer|footnote|masthead|media|meta|outbrain|promo|related|scroll|shoutbox|sidebar|sponsor|shopping|tags|tool|widget|popup|advert|ad-|banner|social|share|newsletter|cookie|subscribe)/i;

const BYLINE_RE = /(byline|author|dateline|writtenby|p-author)/i;

function textLength(node: Element): number {
  return (node.textContent || '').trim().length;
}

function linkDensity(node: Element): number {
  const text = (node.textContent || '').trim();
  if (text.length === 0) return 0;
  let linkLength = 0;
  node.querySelectorAll('a').forEach((a) => {
    linkLength += (a.textContent || '').trim().length;
  });
  return linkLength / text.length;
}

function classWeight(node: Element): number {
  const classAndId = `${node.className || ''} ${node.id || ''}`;
  if (classAndId.trim().length === 0) return 0;
  if (UNLIKELY_RE.test(classAndId)) return -25;
  if (POSITIVE_RE.test(classAndId)) return 25;
  return 0;
}

function nodeScore(node: Element): number {
  const base = textLength(node);
  const commas = (node.textContent || '').split(',').length - 1;
  const density = linkDensity(node);
  return base + commas * 30 + classWeight(node) * (1 - density);
}

function getMeta(doc: Document, selectors: string[]): string | undefined {
  for (const selector of selectors) {
    const node = doc.querySelector(selector);
    if (node) {
      const value = (node.getAttribute('content') || node.getAttribute('value') || '').trim();
      if (value) return value;
    }
  }
  return undefined;
}

function getSiteName(doc: Document): string | undefined {
  return getMeta(doc, [
    'meta[property="og:site_name"]',
    'meta[name="application-name"]',
  ]);
}

function getByline(doc: Document): string | undefined {
  const fromMeta = getMeta(doc, [
    'meta[name="author"]',
    'meta[property="article:author"]',
    'meta[name="byl"]',
    'meta[name="dc.creator"]',
  ]);
  if (fromMeta) return fromMeta;

  for (const node of Array.from(doc.querySelectorAll('a, span, div, p'))) {
    if (BYLINE_RE.test(`${node.className || ''} ${node.getAttribute('rel') || ''}`)) {
      const text = (node.textContent || '').trim().replace(/^by\s+/i, '');
      if (text && text.length < 100) return text;
    }
  }
  return undefined;
}

function getTitle(doc: Document, baseUrl: string): string {
  const candidates = [
    getMeta(doc, ['meta[property="og:title"]', 'meta[name="twitter:title"]']),
    doc.querySelector('title')?.textContent?.trim(),
    doc.querySelector('h1')?.textContent?.trim(),
  ];
  for (const title of candidates) {
    if (title) return title.slice(0, 300);
  }
  try {
    return new URL(baseUrl).hostname;
  } catch {
    return 'Read later';
  }
}

function isUnlikelyCandidate(node: Element): boolean {
  const tag = node.tagName;
  if (UNLIKELY_TAGS.has(tag)) return true;
  if (node.hasAttribute('hidden') || node.getAttribute('aria-hidden') === 'true') return true;
  const classAndId = `${node.className || ''} ${node.id || ''}`;
  return UNLIKELY_RE.test(classAndId);
}

/** Remove script/style/etc subtrees in place. */
function stripUnwanted(root: Element) {
  root.querySelectorAll('script, style, link, noscript, iframe, object, embed, form, button, input, select, textarea, nav, footer, header, aside, svg, video, audio, canvas, dialog, template')
    .forEach((node) => node.remove());
  root.querySelectorAll('[hidden], [aria-hidden="true"]').forEach((node) => node.remove());
}

/** Keep only allowed tags and attributes; strip dangerous inline styles. */
function sanitizeNode(node: Element): string {
  const tag = node.tagName;
  if (!ALLOWED_TAGS.has(tag)) {
    return sanitizeChildren(node);
  }

  const attributes: string[] = [];
  const allowed = ALLOWED_ATTRIBUTES[tag] || [];

  if (allowed.length > 0) {
    for (const attr of allowed) {
      const value = node.getAttribute(attr);
      if (value == null) continue;
      if (attr === 'href' || attr === 'src') {
        const trimmed = value.trim();
        if (/^\s*(javascript|data|vbscript):/i.test(trimmed)) continue;
      }
      attributes.push(`${attr}="${escapeAttribute(value)}"`);
    }
  }

  // Preserve inline styles (used by the "Save styles" feature) unless they are
  // dangerous.
  const style = node.getAttribute('style');
  if (style) {
    if (!/(javascript:|expression\(|url\s*\(|@import|position\s*:\s*fixed)/i.test(style)) {
      attributes.push(`style="${escapeAttribute(style)}"`);
    }
  }

  const open = `<${tag.toLowerCase()}${attributes.length ? ' ' + attributes.join(' ') : ''}>`;
  const inner = sanitizeChildren(node);
  return `${open}${inner}</${tag.toLowerCase()}>`;
}

function sanitizeChildren(node: Element): string {
  let out = '';
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      out += escapeText(child.textContent || '');
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as Element;
      if (isUnlikelyCandidate(el)) continue;
      out += sanitizeNode(el);
    }
  }
  return out;
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function extractArticle(rawHtml: string, baseUrl: string): ExtractedArticle {
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml, 'text/html');

  const title = getTitle(doc, baseUrl);
  const byline = getByline(doc);
  const siteName = getSiteName(doc);

  stripUnwanted(doc.body);

  // Score paragraphs and aggregate their score onto parent candidates.
  const candidates = new Map<Element, number>();
  const paragraphs = doc.body.querySelectorAll('p, pre, td, blockquote');

  for (const paragraph of Array.from(paragraphs)) {
    if (isUnlikelyCandidate(paragraph)) continue;
    const score = nodeScore(paragraph);
    if (score < 20) continue;

    let parent = paragraph.parentElement;
    let depth = 0;
    while (parent && parent !== doc.body && parent !== doc.documentElement && depth < 5) {
      const accumulated = (candidates.get(parent) || 0) + score;
      candidates.set(parent, accumulated);
      parent = parent.parentElement;
      depth++;
    }
  }

  let best: Element | null = null;
  let bestScore = 0;
  for (const [candidate, score] of candidates.entries()) {
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  let container = best;
  if (!container) {
    // Fallback: the largest text block outside obviously unwanted sections.
    let maxText = 0;
    doc.body.querySelectorAll('div, article, section, main').forEach((node) => {
      if (isUnlikelyCandidate(node)) return;
      const len = textLength(node);
      if (len > maxText) {
        maxText = len;
        container = node;
      }
    });
  }

  let html = '';
  let excerpt: string | undefined;
  if (container) {
    html = sanitizeChildren(container).trim();
    const tmp = parser.parseFromString(`<div>${html}</div>`, 'text/html');
    excerpt = (tmp.body.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 300);
  }

  return { title, byline, html, excerpt, siteName };
}
