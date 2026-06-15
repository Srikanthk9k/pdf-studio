import { useState, useCallback, useRef } from 'react';
import { useEditorStore } from '../store/editorStore';
import { loadPDF, renderPageToCanvas } from '../utils/pdfUtils';
import type { PDFDocumentProxy } from '../utils/pdfUtils';
import type { Page } from '../types';

interface UsePDFEditorReturn {
  pdfDoc: PDFDocumentProxy | null;
  isLoading: boolean;
  error: string | null;
  loadFromArrayBuffer: (buffer: ArrayBuffer, fileName?: string) => Promise<void>;
  loadFromUrl: (url: string, fileName?: string) => Promise<void>;
  renderPage: (pageNum: number, canvas: HTMLCanvasElement, scale?: number) => Promise<void>;
  goToPage: (page: number) => void;
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  fitToPage: (containerHeight: number, pageHeight: number) => void;
  fitToWidth: (containerWidth: number, pageWidth: number) => void;
}

export function usePDFEditor(): UsePDFEditorReturn {
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const renderQueueRef = useRef<Map<number, AbortController>>(new Map());

  const store = useEditorStore();

  // ── Internal load helper ─────────────────────────────────────────────────────
  const finishLoad = useCallback(
    async (
      doc: PDFDocumentProxy,
      fileName: string,
      extra?: Partial<{ fileBytes: ArrayBuffer; fileUrl: string }>
    ) => {
      const pages: Page[] = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const vp = page.getViewport({ scale: 1 });
        pages.push({ index: i, rotation: 0, width: vp.width, height: vp.height });
      }

      store.setDocument({
        id: `${Date.now()}`,
        name: fileName,
        pages,
        totalPages: doc.numPages,
        currentPage: 1,
        zoom: 1,
        rotation: 0,
        fileBytes: extra?.fileBytes ?? null,
        fileUrl: extra?.fileUrl ?? null,
      });

      setPdfDoc(doc);
      setIsLoading(false);
      setError(null);
    },
    [store]
  );

  // ── Load from ArrayBuffer ─────────────────────────────────────────────────────
  const loadFromArrayBuffer = useCallback(
    async (buffer: ArrayBuffer, fileName: string = 'document.pdf') => {
      try {
        setIsLoading(true);
        setError(null);
        store.setLoading(true, 'Loading PDF…');

        const doc = await loadPDF(buffer);
        await finishLoad(doc, fileName, { fileBytes: buffer });
        store.setLoading(false);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to load PDF';
        setError(msg);
        setIsLoading(false);
        store.setLoading(false);
      }
    },
    [finishLoad, store]
  );

  // ── Load from URL ─────────────────────────────────────────────────────────────
  const loadFromUrl = useCallback(
    async (url: string, fileName: string = 'document.pdf') => {
      try {
        setIsLoading(true);
        setError(null);
        store.setLoading(true, 'Fetching PDF…');

        const doc = await loadPDF(url);
        await finishLoad(doc, fileName, { fileUrl: url });
        store.setLoading(false);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to load PDF';
        setError(msg);
        setIsLoading(false);
        store.setLoading(false);
      }
    },
    [finishLoad, store]
  );

  // ── Render a specific page ────────────────────────────────────────────────────
  const renderPage = useCallback(
    async (pageNum: number, canvas: HTMLCanvasElement, scale?: number) => {
      if (!pdfDoc) return;

      // Cancel any existing render for this page
      const existing = renderQueueRef.current.get(pageNum);
      if (existing) existing.abort();
      const controller = new AbortController();
      renderQueueRef.current.set(pageNum, controller);

      try {
        const zoom = scale ?? store.document.zoom;
        await renderPageToCanvas(pdfDoc, pageNum, canvas, zoom * 1.5);
      } catch {
        // Aborted or error — ignore
      } finally {
        renderQueueRef.current.delete(pageNum);
      }
    },
    [pdfDoc, store.document.zoom]
  );

  // ── Navigation ────────────────────────────────────────────────────────────────
  const goToPage = useCallback(
    (page: number) => {
      if (!pdfDoc) return;
      const clamped = Math.max(1, Math.min(page, pdfDoc.numPages));
      store.setCurrentPage(clamped);
    },
    [pdfDoc, store]
  );

  // ── Zoom ──────────────────────────────────────────────────────────────────────
  const setZoom = useCallback(
    (zoom: number) => store.setZoom(zoom),
    [store]
  );

  const zoomIn = useCallback(() => {
    store.setZoom(Math.min(store.document.zoom + 0.25, 5));
  }, [store]);

  const zoomOut = useCallback(() => {
    store.setZoom(Math.max(store.document.zoom - 0.25, 0.25));
  }, [store]);

  const fitToPage = useCallback(
    (containerHeight: number, pageHeight: number) => {
      if (pageHeight === 0) return;
      store.setZoom(containerHeight / pageHeight);
    },
    [store]
  );

  const fitToWidth = useCallback(
    (containerWidth: number, pageWidth: number) => {
      if (pageWidth === 0) return;
      store.setZoom(containerWidth / pageWidth);
    },
    [store]
  );

  return {
    pdfDoc,
    isLoading,
    error,
    loadFromArrayBuffer,
    loadFromUrl,
    renderPage,
    goToPage,
    setZoom,
    zoomIn,
    zoomOut,
    fitToPage,
    fitToWidth,
  };
}
