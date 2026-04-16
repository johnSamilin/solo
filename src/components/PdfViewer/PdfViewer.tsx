import { FC, useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

import './PdfViewer.css';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

type PdfViewerProps = {
  base64Data: string;
};

export const PdfViewer: FC<PdfViewerProps> = ({ base64Data }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const renderingRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!base64Data || !container) return;

    setIsLoading(true);
    setError(null);

    let cancelled = false;

    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const loadingTask = pdfjsLib.getDocument({
      data: bytes,
      cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.6.82/cmaps/',
      cMapPacked: true,
    });

    loadingTask.promise
      .then(async (pdfDoc) => {
        if (cancelled) return;
        pdfDocRef.current = pdfDoc;

        if (renderingRef.current) return;
        renderingRef.current = true;

        container.querySelectorAll('.pdf-page-container, .pdf-page-number').forEach(el => el.remove());
        const containerWidth = container.clientWidth - 48;

        for (let i = 1; i <= pdfDoc.numPages; i++) {
          if (cancelled) break;
          const page = await pdfDoc.getPage(i);
          const unscaledViewport = page.getViewport({ scale: 1 });
          const scale = Math.min(containerWidth / unscaledViewport.width, 2);
          const viewport = page.getViewport({ scale });

          const pageContainer = document.createElement('div');
          pageContainer.className = 'pdf-page-container';
          pageContainer.style.width = `${viewport.width}px`;
          pageContainer.style.height = `${viewport.height}px`;

          const canvas = document.createElement('canvas');
          canvas.width = viewport.width * window.devicePixelRatio;
          canvas.height = viewport.height * window.devicePixelRatio;
          canvas.style.width = `${viewport.width}px`;
          canvas.style.height = `${viewport.height}px`;

          const context = canvas.getContext('2d');
          if (context) {
            context.scale(window.devicePixelRatio, window.devicePixelRatio);
            await page.render({
              canvasContext: context,
              viewport,
              annotationMode: pdfjsLib.AnnotationMode.ENABLE_STORAGE,
            }).promise;
          }

          pageContainer.appendChild(canvas);

          const annotationDiv = document.createElement('div');
          annotationDiv.className = 'annotation-layer';
          await renderAnnotationOverlay(page, viewport, annotationDiv);
          pageContainer.appendChild(annotationDiv);

          container.appendChild(pageContainer);

          const pageNum = document.createElement('div');
          pageNum.className = 'pdf-page-number';
          pageNum.textContent = `${i} / ${pdfDoc.numPages}`;
          container.appendChild(pageNum);
        }

        renderingRef.current = false;
        if (!cancelled) setIsLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Failed to load PDF:', err);
        setError('Failed to load PDF document');
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
      loadingTask.destroy();
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy();
        pdfDocRef.current = null;
      }
    };
  }, [base64Data]);

  return (
    <div ref={containerRef} className="pdf-viewer">
      {isLoading && <div className="pdf-viewer-loading">Loading PDF...</div>}
      {error && <div className="pdf-viewer-error">{error}</div>}
    </div>
  );
};

async function renderAnnotationOverlay(
  page: pdfjsLib.PDFPageProxy,
  viewport: pdfjsLib.PageViewport,
  container: HTMLDivElement
): Promise<void> {
  const annotations = await page.getAnnotations();
  if (!annotations || annotations.length === 0) return;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', `${viewport.width}`);
  svg.setAttribute('height', `${viewport.height}`);
  svg.style.position = 'absolute';
  svg.style.top = '0';
  svg.style.left = '0';
  svg.style.width = `${viewport.width}px`;
  svg.style.height = `${viewport.height}px`;

  for (const annotation of annotations) {
    const subtype = annotation.subtype;

    if (subtype === 'Highlight' || subtype === 'Underline' || subtype === 'StrikeOut' || subtype === 'Squiggly') {
      renderMarkupAnnotation(svg, annotation, viewport);
    } else if (subtype === 'Ink') {
      renderInkAnnotation(svg, annotation, viewport);
    } else if (subtype === 'Text' || subtype === 'FreeText') {
      renderTextAnnotation(svg, annotation, viewport, container);
    }
  }

  container.appendChild(svg);
}

function pdfToViewport(rect: number[], viewport: pdfjsLib.PageViewport): { x: number; y: number; width: number; height: number } {
  const [x1, y1, x2, y2] = rect;
  const p1 = viewport.convertToViewportPoint(x1, y1);
  const p2 = viewport.convertToViewportPoint(x2, y2);
  return {
    x: Math.min(p1[0], p2[0]),
    y: Math.min(p1[1], p2[1]),
    width: Math.abs(p2[0] - p1[0]),
    height: Math.abs(p2[1] - p1[1]),
  };
}

function getAnnotationColor(annotation: any): string {
  if (annotation.color) {
    const [r, g, b] = annotation.color;
    return `rgb(${r}, ${g}, ${b})`;
  }
  return 'rgba(255, 255, 0, 0.4)';
}

function renderMarkupAnnotation(
  svg: SVGSVGElement,
  annotation: any,
  viewport: pdfjsLib.PageViewport
): void {
  const color = getAnnotationColor(annotation);
  const quads = annotation.quadPoints;
  const subtype = annotation.subtype;

  if (quads && quads.length > 0) {
    for (let i = 0; i < quads.length; i += 8) {
      const points = [];
      for (let j = 0; j < 8; j += 2) {
        const vp = viewport.convertToViewportPoint(quads[i + j], quads[i + j + 1]);
        points.push(vp);
      }

      const minX = Math.min(points[0][0], points[1][0], points[2][0], points[3][0]);
      const maxX = Math.max(points[0][0], points[1][0], points[2][0], points[3][0]);
      const minY = Math.min(points[0][1], points[1][1], points[2][1], points[3][1]);
      const maxY = Math.max(points[0][1], points[1][1], points[2][1], points[3][1]);

      if (subtype === 'Highlight') {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', `${minX}`);
        rect.setAttribute('y', `${minY}`);
        rect.setAttribute('width', `${maxX - minX}`);
        rect.setAttribute('height', `${maxY - minY}`);
        rect.setAttribute('fill', color);
        rect.setAttribute('opacity', '0.35');
        svg.appendChild(rect);
      } else if (subtype === 'Underline') {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', `${minX}`);
        line.setAttribute('y1', `${maxY}`);
        line.setAttribute('x2', `${maxX}`);
        line.setAttribute('y2', `${maxY}`);
        line.setAttribute('stroke', color);
        line.setAttribute('stroke-width', '1.5');
        svg.appendChild(line);
      } else if (subtype === 'StrikeOut') {
        const midY = (minY + maxY) / 2;
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', `${minX}`);
        line.setAttribute('y1', `${midY}`);
        line.setAttribute('x2', `${maxX}`);
        line.setAttribute('y2', `${midY}`);
        line.setAttribute('stroke', color);
        line.setAttribute('stroke-width', '1');
        svg.appendChild(line);
      }
    }
  } else {
    const { x, y, width, height } = pdfToViewport(annotation.rect, viewport);
    if (subtype === 'Highlight') {
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', `${x}`);
      rect.setAttribute('y', `${y}`);
      rect.setAttribute('width', `${width}`);
      rect.setAttribute('height', `${height}`);
      rect.setAttribute('fill', color);
      rect.setAttribute('opacity', '0.35');
      svg.appendChild(rect);
    } else if (subtype === 'Underline') {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', `${x}`);
      line.setAttribute('y1', `${y + height}`);
      line.setAttribute('x2', `${x + width}`);
      line.setAttribute('y2', `${y + height}`);
      line.setAttribute('stroke', color);
      line.setAttribute('stroke-width', '1.5');
      svg.appendChild(line);
    }
  }
}

function renderInkAnnotation(
  svg: SVGSVGElement,
  annotation: any,
  viewport: pdfjsLib.PageViewport
): void {
  const color = getAnnotationColor(annotation);
  const inkLists = annotation.inkLists;
  if (!inkLists) return;

  for (const inkList of inkLists) {
    if (!inkList || inkList.length === 0) continue;

    let pathData = '';
    for (let i = 0; i < inkList.length; i++) {
      const point = inkList[i];
      const vp = viewport.convertToViewportPoint(point.x, point.y);
      if (i === 0) {
        pathData += `M ${vp[0]} ${vp[1]}`;
      } else {
        pathData += ` L ${vp[0]} ${vp[1]}`;
      }
    }

    const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathEl.setAttribute('d', pathData);
    pathEl.setAttribute('stroke', color);
    pathEl.setAttribute('stroke-width', `${annotation.borderStyle?.width || 2}`);
    pathEl.setAttribute('fill', 'none');
    pathEl.setAttribute('stroke-linecap', 'round');
    pathEl.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(pathEl);
  }
}

function renderTextAnnotation(
  svg: SVGSVGElement,
  annotation: any,
  viewport: pdfjsLib.PageViewport,
  container: HTMLDivElement
): void {
  if (!annotation.contents && !annotation.richText) return;

  const { x, y } = pdfToViewport(annotation.rect, viewport);

  const marker = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  marker.setAttribute('cx', `${x + 8}`);
  marker.setAttribute('cy', `${y + 8}`);
  marker.setAttribute('r', '8');
  marker.setAttribute('fill', getAnnotationColor(annotation));
  marker.setAttribute('opacity', '0.7');
  marker.setAttribute('cursor', 'pointer');
  svg.appendChild(marker);

  const noteIcon = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  noteIcon.setAttribute('x', `${x + 8}`);
  noteIcon.setAttribute('y', `${y + 12}`);
  noteIcon.setAttribute('text-anchor', 'middle');
  noteIcon.setAttribute('font-size', '10');
  noteIcon.setAttribute('fill', 'white');
  noteIcon.textContent = 'N';
  svg.appendChild(noteIcon);

  if (annotation.contents) {
    const tooltip = document.createElement('div');
    tooltip.className = 'pdf-annotation-tooltip';
    tooltip.textContent = annotation.contents;
    tooltip.style.cssText = `
      position: absolute;
      left: ${x + 20}px;
      top: ${y}px;
      background: #fff9c4;
      border: 1px solid #e0d68a;
      border-radius: 4px;
      padding: 6px 10px;
      font-size: 12px;
      max-width: 250px;
      display: none;
      z-index: 10;
      color: #333;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      pointer-events: none;
    `;
    container.appendChild(tooltip);

    marker.addEventListener('mouseenter', () => {
      tooltip.style.display = 'block';
    });
    marker.addEventListener('mouseleave', () => {
      tooltip.style.display = 'none';
    });
  }
}
