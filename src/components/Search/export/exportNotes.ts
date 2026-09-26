import JSZip from 'jszip';
import * as pdfjsLib from 'pdfjs-dist';
import { ExportFileRequest, Note, SavedFilter, SavedSearchExportProfile, TypographySettings } from '../../../types';
import { defaultSettings, themes } from '../../../constants';
import { loadNoteCss, loadNoteContent, loadPdfContent } from '../../../utils/electron';
import { getNativeAPI } from '../../../utils/nativeBridge';
import { getNoteDisplayContent } from '../noteDisplayContent';
import gnuTypewriterUrl from '../../../assets/fonts/gtw.ttf?url';
import cmTypewriterUrl from '../../../assets/fonts/CMTypewriter/cmunvt.ttf?url';
import cmTypewriterItalicUrl from '../../../assets/fonts/CMTypewriter/cmunvi.ttf?url';
import umTypewriterUrl from '../../../assets/fonts/UMTypewriter/UMTypewriter-Regular.otf?url';
import umTypewriterItalicUrl from '../../../assets/fonts/UMTypewriter/UMTypewriter-Italic.otf?url';
import umTypewriterBoldUrl from '../../../assets/fonts/UMTypewriter/UMTypewriter-Bold.otf?url';
import umTypewriterBoldItalicUrl from '../../../assets/fonts/UMTypewriter/UMTypewriter-BoldItalic.otf?url';
import kaligraficaUrl from '../../../assets/fonts/kaligrafica.ttf?url';
import pixelifyUrl from '../../../assets/fonts/PixelifySans-VariableFont_wght.ttf?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]!));

type ExportChapter = { note: Note; content: string; css: string; className: string };
type ExportFont = { family: string; fileName: string; format: 'truetype' | 'opentype'; style: string; weight: string; url: string; bytes: Uint8Array };

const fontSources = [
  ['GNU Typewriter', 'GNU-Typewriter.ttf', 'truetype', 'normal', '400', gnuTypewriterUrl],
  ['CMTypewriter', 'CMTypewriter.ttf', 'truetype', 'normal', '400', cmTypewriterUrl],
  ['CMTypewriter', 'CMTypewriter-Italic.ttf', 'truetype', 'italic', '400', cmTypewriterItalicUrl],
  ['UMTypewriter', 'UMTypewriter-Regular.otf', 'opentype', 'normal', '400', umTypewriterUrl],
  ['UMTypewriter', 'UMTypewriter-Italic.otf', 'opentype', 'italic', '400', umTypewriterItalicUrl],
  ['UMTypewriter', 'UMTypewriter-Bold.otf', 'opentype', 'normal', '700', umTypewriterBoldUrl],
  ['UMTypewriter', 'UMTypewriter-BoldItalic.otf', 'opentype', 'italic', '700', umTypewriterBoldItalicUrl],
  ['Kaligrafica', 'Kaligrafica.ttf', 'truetype', 'normal', '400', kaligraficaUrl],
  ['Pixelify Sans', 'Pixelify-Sans.ttf', 'truetype', 'normal', '400', pixelifyUrl],
] as const;

const loadExportFonts = async (): Promise<ExportFont[]> => (await Promise.all(fontSources.map(async ([family, fileName, format, style, weight, url]) => {
  try {
    return { family, fileName, format, style, weight, url, bytes: new Uint8Array(await (await fetch(url)).arrayBuffer()) };
  } catch {
    return undefined;
  }
}))).filter((font): font is ExportFont => Boolean(font));

const toXhtml = (html: string) => {
  const root = document.createElement('div');
  root.innerHTML = html;
  return Array.from(root.childNodes).map(node => new XMLSerializer().serializeToString(node)).join('');
};

const scopeCss = (css: string, scope: string) => css.replace(/(^|})(\s*[^@}][^{]*)\{/g, (_match, prefix, selectors) => `${prefix}${selectors.split(',').map((selector: string) => `${scope} ${selector.trim()}`).join(', ')}{`);

// ── Content loading ──

const loadHtmlContent = async (note: Note): Promise<string> => {
  if (note.content) return note.content;
  if (note.filePath) {
    try { return await loadNoteContent(note.filePath); } catch { return ''; }
  }
  return '';
};

const loadPdfBase64 = async (note: Note): Promise<string> => {
  if (note.content) return note.content;
  if (note.filePath) {
    try { return await loadPdfContent(note.filePath); } catch { return ''; }
  }
  return '';
};

// ── Image resolution ──

const resolveImageSrc = async (src: string): Promise<string> => {
  if (!src || src.startsWith('data:')) return src;
  if (/^https?:\/\//i.test(src)) return src;
  const api = getNativeAPI();
  if (api?.readImage) {
    const result = await api.readImage(src);
    if (result.success && result.data) {
      return `data:${result.mediaType || 'image/jpeg'};base64,${result.data}`;
    }
  }
  return src;
};

/**
 * Rewrites `image://` and `file://` sources into inline data URLs and replaces
 * TipTap `.carousel` nodes with a static image grid, so exported documents are
 * self-contained and render outside the app.
 */
const normalizeContent = async (content: string): Promise<string> => {
  const doc = new DOMParser().parseFromString(content, 'text/html');

  const carousels = Array.from(doc.querySelectorAll<HTMLElement>('[data-type="carousel"]'));
  await Promise.all(carousels.map(async carousel => {
    let images: string[] = [];
    try { images = JSON.parse(carousel.getAttribute('data-images') || '[]'); } catch { images = []; }
    if (images.length === 0) {
      images = Array.from(carousel.querySelectorAll<HTMLImageElement>('img')).map(img => img.getAttribute('src') || '');
    }
    const figure = doc.createElement('figure');
    figure.className = 'export-gallery';
    const resolved = await Promise.all(images.map(resolveImageSrc));
    resolved.forEach(src => {
      const img = doc.createElement('img');
      img.src = src;
      img.alt = '';
      figure.appendChild(img);
    });
    carousel.replaceWith(figure);
  }));

  const imgs = Array.from(doc.querySelectorAll<HTMLImageElement>('img'));
  await Promise.all(imgs.map(async img => {
    img.src = await resolveImageSrc(img.getAttribute('src') || '');
  }));

  return doc.body.innerHTML;
};

// ── PDF rendering ──

const PDF_RENDER_SCALE = 2;

const renderPdfPages = async (base64Data: string): Promise<string[]> => {
  let pdf: pdfjsLib.PDFDocumentProxy | null = null;
  try {
    const binary = atob(base64Data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: PDF_RENDER_SCALE });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const context = canvas.getContext('2d');
      if (!context) continue;
      await page.render({ canvasContext: context, viewport }).promise;
      pages.push(canvas.toDataURL('image/png'));
    }
    return pages;
  } catch {
    return [];
  } finally {
    if (pdf) await pdf.destroy();
  }
};

const buildChapterContent = async (note: Note, filter: SavedFilter): Promise<string> => {
  if (note.fileType === 'pdf') {
    const base64 = await loadPdfBase64(note);
    if (!base64) return '';
    const pages = await renderPdfPages(base64);
    if (pages.length === 0) return '';
    return pages.map(src => `<section class="pdf-page"><img src="${src}" alt="" /></section>`).join('');
  }

  const rawContent = await loadHtmlContent(note);
  const { content, isPartial } = getNoteDisplayContent({ ...note, content: rawContent }, filter.searchQuery, filter.tagFilters);
  const selected = isPartial ? `<div class="export-fragment">…${content}…</div>` : content;
  return normalizeContent(selected);
};

const buildChapters = async (notes: Note[], filter: SavedFilter, currentSettings: TypographySettings) => Promise.all(notes.map(async (note, index) => {
  const settings = note.theme && themes[note.theme] ? themes[note.theme].settings : currentSettings;
  const className = `chapter-${index}`;
  let customCss = '';
  if (note.cssPath) {
    try { customCss = await loadNoteCss(note.cssPath); } catch { customCss = ''; }
  }
  const css = `.${className}{font-family:${settings.editorFontFamily};font-size:${settings.editorFontSize};line-height:${settings.editorLineHeight}}.${className} h1{font-family:${settings.titleFontFamily};font-size:${settings.titleFontSize}}.${className} p{margin-bottom:${settings.paragraphSpacing}}${scopeCss(customCss, `.${className}`)}`;
  return { note, content: await buildChapterContent(note, filter), css, className };
}));

const fontCss = (fonts: ExportFont[], embedded: boolean) => fonts.map(font => `@font-face{font-family:"${font.family}";src:url("${embedded ? `data:font/${font.format === 'opentype' ? 'otf' : 'ttf'};base64,${toBase64(font.bytes)}` : `fonts/${font.fileName}`}") format("${font.format}");font-style:${font.style};font-weight:${font.weight}}`).join('');

const buildHtml = (profile: SavedSearchExportProfile, chapters: ExportChapter[], fonts: ExportFont[]) => {
  const chapterHtml = chapters.map(({ note, content, className }, index) => `<article id="chapter-${index}" class="chapter ${className}"><h1>${escapeHtml(note.title)}</h1>${content}</article>`).join('');
  const styles = chapters.map(chapter => chapter.css).join('');
  const toc = profile.includeTableOfContents
    ? `<nav class="toc"><h1>Содержание</h1><ol>${chapters.map(({ note }, index) => `<li><a href="#chapter-${index}">${escapeHtml(note.title)}</a></li>`).join('')}</ol></nav>`
    : '';
  const coverImage = profile.cover.imageData && profile.cover.imageMediaType ? `<img src="data:${profile.cover.imageMediaType};base64,${profile.cover.imageData}" alt="" />` : '';
  const cover = profile.cover.enabled ? `<section class="cover">${coverImage}<h1>${escapeHtml(profile.cover.title || profile.title)}</h1><p>${escapeHtml(profile.cover.author || profile.author)}</p></section>` : '';
  return `<!doctype html><html><head><meta charset="utf-8"><style>${fontCss(fonts, true)}@page{margin:20mm}@page:first{margin:0}body{font-family:serif;line-height:1.5;color:#111}.cover{position:relative;height:100vh;overflow:hidden;break-after:page;text-align:center;color:#fff;background:#111}.cover img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.cover h1,.cover p{position:relative;z-index:1;margin:0;text-shadow:0 2px 8px #000}.cover h1{padding:72vh 2rem 0;font-size:2.5rem}.cover p{padding:0.75rem 2rem}.toc{break-after:page}.chapter{margin:0 0 2rem}img,figure,.export-gallery,table{break-inside:avoid;page-break-inside:avoid;max-width:100%}.export-gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px}.export-gallery img{width:100%;height:auto}.pdf-page{break-before:page;page-break-before:always}.pdf-page img{width:100%;height:auto}h1,h2,h3{break-after:avoid;page-break-after:avoid}.export-fragment{margin:1.5em 0;font-style:italic}${styles}</style></head><body>${cover}${toc}${chapterHtml}</body></html>`;
};

const toBase64 = (bytes: Uint8Array) => {
  let value = '';
  bytes.forEach(byte => { value += String.fromCharCode(byte); });
  return btoa(value);
};

const buildEpub = async (profile: SavedSearchExportProfile, chapters: ExportChapter[], fonts: ExportFont[]) => {
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file('META-INF/container.xml', '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
  const manifest = chapters.map((_, index) => `<item id="chapter-${index}" href="chapter-${index}.xhtml" media-type="application/xhtml+xml"/>`).join('');
  const spine = chapters.map((_, index) => `<itemref idref="chapter-${index}"/>`).join('');
  const fontManifest = fonts.map((font, index) => `<item id="font-${index}" href="fonts/${font.fileName}" media-type="application/font-sfnt"/>`).join('');
  const coverExtension = profile.cover.imageMediaType === 'image/png' ? 'png' : profile.cover.imageMediaType === 'image/webp' ? 'webp' : 'jpg';
  const coverManifest = profile.cover.enabled && profile.cover.imageData && profile.cover.imageMediaType ? `<item id="cover" href="images/cover.${coverExtension}" media-type="${profile.cover.imageMediaType}" properties="cover-image"/><item id="cover-page" href="cover.xhtml" media-type="application/xhtml+xml"/>` : '';
  const coverSpine = coverManifest ? '<itemref idref="cover-page"/>' : '';
  zip.file('OEBPS/content.opf', `<?xml version="1.0" encoding="utf-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book">solo-export</dc:identifier><dc:title>${escapeHtml(profile.title)}</dc:title><dc:creator>${escapeHtml(profile.author)}</dc:creator><dc:language>ru</dc:language></metadata><manifest>${manifest}${fontManifest}${coverManifest}<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="styles" href="styles.css" media-type="text/css"/></manifest><spine>${coverSpine}${spine}</spine></package>`);
  zip.file('OEBPS/nav.xhtml', `<html xmlns="http://www.w3.org/1999/xhtml"><body><nav epub:type="toc" xmlns:epub="http://www.idpf.org/2007/ops"><ol>${chapters.map(({ note }, index) => `<li><a href="chapter-${index}.xhtml">${escapeHtml(note.title)}</a></li>`).join('')}</ol></nav></body></html>`);
  zip.file('OEBPS/styles.css', `${fontCss(fonts, false)}.cover{position:relative;height:100vh;overflow:hidden;background:#111}.cover img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.export-gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px}.export-gallery img{width:100%;height:auto}.pdf-page img{width:100%;height:auto}${chapters.map(chapter => chapter.css).join('')}`);
  fonts.forEach(font => zip.file(`OEBPS/fonts/${font.fileName}`, font.bytes));
  if (coverManifest && profile.cover.imageData) zip.file(`OEBPS/images/cover.${coverExtension}`, Uint8Array.from(atob(profile.cover.imageData), character => character.charCodeAt(0)));
  if (coverManifest) zip.file('OEBPS/cover.xhtml', `<html xmlns="http://www.w3.org/1999/xhtml"><head><link rel="stylesheet" type="text/css" href="styles.css" /></head><body><section class="cover"><img src="images/cover.${coverExtension}" alt="" /></section></body></html>`);
  chapters.forEach(({ note, content, className }, index) => zip.file(`OEBPS/chapter-${index}.xhtml`, `<html xmlns="http://www.w3.org/1999/xhtml"><head><link rel="stylesheet" type="text/css" href="styles.css" /></head><body><article class="${className}"><h1>${escapeHtml(note.title)}</h1>${toXhtml(content)}</article></body></html>`));
  return toBase64(await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' }));
};

export const createExportFileRequest = async (
  profile: SavedSearchExportProfile,
  filter: SavedFilter,
  notes: Note[],
  currentSettings: TypographySettings = defaultSettings,
  outputPath?: string,
): Promise<ExportFileRequest> => {
  const chapters = await buildChapters(notes, filter, currentSettings);
  const fonts = await loadExportFonts();
  return {
  format: profile.format,
  suggestedFileName: `${profile.title || filter.label}.${profile.format}`,
  outputPath,
  html: profile.format === 'pdf' ? buildHtml(profile, chapters, fonts) : undefined,
  epubBase64: profile.format === 'epub' ? await buildEpub(profile, chapters, fonts) : undefined,
  pageSize: profile.pageSize,
  pageNumberPosition: profile.headerFooter.pageNumberPosition || 'bottom-center',
  showPageNumbers: profile.headerFooter.enabled,
  };
};
