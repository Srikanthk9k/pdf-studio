import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

// ─── Worker setup ──────────────────────────────────────────────────────────────
// Use the locally-served worker that exactly matches the installed pdfjs-dist version.
// Vite serves everything in /public at the root path.
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

// ─── Load PDF ─────────────────────────────────────────────────────────────────
export async function loadPDF(
  source: string | ArrayBuffer
): Promise<PDFDocumentProxy> {
  if (typeof source === 'string') {
    // URL load
    const task = pdfjsLib.getDocument({
      url: source,
      cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
      cMapPacked: true,
    });
    return task.promise;
  } else {
    // ArrayBuffer load — copy the buffer so the original is NOT neutered/detached
    // when PDF.js transfers it to the worker thread.
    const copy = source.slice(0);
    const task = pdfjsLib.getDocument({
      data: new Uint8Array(copy),
      cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
      cMapPacked: true,
    });
    return task.promise;
  }
}

// ─── Render page to canvas ────────────────────────────────────────────────────
export async function renderPageToCanvas(
  pdf: PDFDocumentProxy,
  pageNum: number,
  canvas: HTMLCanvasElement,
  scale: number = 1.5
): Promise<{ width: number; height: number }> {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Failed to get canvas 2D context');

  // Handle devicePixelRatio for sharp rendering on HiDPI screens
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(viewport.width * dpr);
  canvas.height = Math.floor(viewport.height * dpr);
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;

  // Reset transform before scaling for DPR
  context.setTransform(dpr, 0, 0, dpr, 0, 0);

  await page.render({ canvasContext: context, viewport }).promise;
  page.cleanup();

  return { width: viewport.width, height: viewport.height };
}

// ─── Generate thumbnail ────────────────────────────────────────────────────────
export async function generateThumbnail(
  pdf: PDFDocumentProxy,
  pageNum: number,
  maxWidth: number = 150
): Promise<string> {
  const page = await pdf.getPage(pageNum);
  const naturalViewport = page.getViewport({ scale: 1 });
  const scale = maxWidth / naturalViewport.width;
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Failed to get canvas 2D context');

  await page.render({ canvasContext: context, viewport }).promise;
  page.cleanup();
  return canvas.toDataURL('image/jpeg', 0.75);
}

// ─── Get page dimensions ──────────────────────────────────────────────────────
export function getPageDimensions(
  page: PDFPageProxy,
  scale: number = 1
): { width: number; height: number } {
  const viewport = page.getViewport({ scale });
  return { width: viewport.width, height: viewport.height };
}

// ─── Get page count ───────────────────────────────────────────────────────────
export function getPageCount(pdf: PDFDocumentProxy): number {
  return pdf.numPages;
}

// ─── Convert page to PNG data URL ─────────────────────────────────────────────
export async function pageToDataURL(
  pdf: PDFDocumentProxy,
  pageNum: number,
  scale: number = 2
): Promise<string> {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Failed to get canvas 2D context');

  await page.render({ canvasContext: context, viewport }).promise;
  page.cleanup();
  return canvas.toDataURL('image/png');
}

export type { PDFDocumentProxy, PDFPageProxy };
