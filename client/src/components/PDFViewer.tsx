import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Upload, FileText } from 'lucide-react';
import { useEditorStore } from '../store/editorStore';
import AnnotationLayer from './AnnotationLayer';
import type { PDFDocumentProxy } from '../utils/pdfUtils';

interface PDFViewerProps {
  pdfDoc: PDFDocumentProxy | null;
  renderPage: (pageNum: number, canvas: HTMLCanvasElement, scale?: number) => Promise<void>;
}

interface PageRenderer {
  pageNum: number;
  rendered: boolean;
  width: number;
  height: number;
}

export default function PDFViewer({ pdfDoc, renderPage }: PDFViewerProps) {
  const { document: doc, isLoading, loadingMessage, setCurrentPage } = useEditorStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const [pageStates, setPageStates] = useState<PageRenderer[]>([]);

  // ── Build page state list when PDF loads ──────────────────────────────────────
  useEffect(() => {
    if (!pdfDoc) {
      setPageStates([]);
      return;
    }
    const states: PageRenderer[] = [];
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = doc.pages[i - 1];
      states.push({
        pageNum: i,
        rendered: false,
        width: page?.width ?? 612,
        height: page?.height ?? 792,
      });
    }
    setPageStates(states);
  }, [pdfDoc, doc.pages]);

  // ── IntersectionObserver for lazy rendering ───────────────────────────────────
  useEffect(() => {
    if (!pdfDoc || pageStates.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const pageNum = parseInt(
              (entry.target as HTMLElement).getAttribute('data-page') || '0',
              10
            );
            if (!pageNum) return;

            const canvas = canvasRefs.current.get(pageNum);
            if (canvas && !pageStates.find((p) => p.pageNum === pageNum)?.rendered) {
              renderPage(pageNum, canvas, doc.zoom).then(() => {
                setPageStates((prev) =>
                  prev.map((p) =>
                    p.pageNum === pageNum ? { ...p, rendered: true } : p
                  )
                );
              });
            }
          }
        });
      },
      { root: containerRef.current, rootMargin: '400px', threshold: 0.01 }
    );

    pageRefs.current.forEach((div) => observer.observe(div));

    return () => observer.disconnect();
  }, [pdfDoc, pageStates.length, doc.zoom, renderPage]);

  // ── Re-render all visible pages on zoom change ────────────────────────────────
  useEffect(() => {
    if (!pdfDoc) return;
    // Mark all as unrendered
    setPageStates((prev) => prev.map((p) => ({ ...p, rendered: false })));

    // Re-render all canvases
    setTimeout(() => {
      pageRefs.current.forEach((div, pageNum) => {
        const canvas = canvasRefs.current.get(pageNum);
        if (canvas) {
          renderPage(pageNum, canvas, doc.zoom);
        }
      });
    }, 50);
  }, [doc.zoom, pdfDoc, renderPage]);

  // ── Scroll to current page ────────────────────────────────────────────────────
  useEffect(() => {
    const div = pageRefs.current.get(doc.currentPage);
    if (div) {
      div.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [doc.currentPage]);

  // ── Observe which page is most visible ───────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        let maxRatio = 0;
        let mostVisible = doc.currentPage;
        entries.forEach((entry) => {
          if (entry.intersectionRatio > maxRatio) {
            maxRatio = entry.intersectionRatio;
            const pn = parseInt(
              (entry.target as HTMLElement).getAttribute('data-page') || '0',
              10
            );
            if (pn) mostVisible = pn;
          }
        });
        if (mostVisible !== doc.currentPage) {
          setCurrentPage(mostVisible);
        }
      },
      { root: containerRef.current, threshold: [0.3, 0.5, 0.8] }
    );

    pageRefs.current.forEach((div) => observer.observe(div));
    return () => observer.disconnect();
  }, [pageStates.length, doc.currentPage, setCurrentPage]);

  // ── Assign refs ───────────────────────────────────────────────────────────────
  const assignPageRef = useCallback((pageNum: number) => (el: HTMLDivElement | null) => {
    if (el) pageRefs.current.set(pageNum, el);
    else pageRefs.current.delete(pageNum);
  }, []);

  const assignCanvasRef = useCallback((pageNum: number) => (el: HTMLCanvasElement | null) => {
    if (el) canvasRefs.current.set(pageNum, el);
    else canvasRefs.current.delete(pageNum);
  }, []);

  const scale = doc.zoom;

  // ── Drag-over visual state for empty state ─────────────────────────────
  const [isDragOver, setIsDragOver] = useState(false);

  // ── Empty state ─────────────────────────────────────────────────────────────────
  if (!pdfDoc && !isLoading) {
    return (
      <div
        className={`flex-1 flex items-center justify-center bg-slate-950 overflow-auto transition-all duration-200 ${
          isDragOver ? 'bg-indigo-950/40' : ''
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragEnter={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragOver(false); }}
      >
        <div className="empty-state text-center">
          <div
            className={`empty-state-icon mb-6 mx-auto transition-all duration-200 ${
              isDragOver
                ? 'border-indigo-500 bg-indigo-500/10 scale-110'
                : ''
            }`}
          >
            <FileText
              className={`w-10 h-10 transition-colors duration-200 ${
                isDragOver ? 'text-indigo-400' : 'text-slate-600'
              }`}
            />
          </div>
          <h3 className={`text-xl font-semibold mb-2 transition-colors duration-200 ${
            isDragOver ? 'text-indigo-300' : 'text-slate-400'
          }`}>
            {isDragOver ? 'Release to open PDF' : 'No PDF Open'}
          </h3>
          <p className="text-sm text-slate-600 mb-6 max-w-sm">
            Open a PDF file to start editing. Drag &amp; drop anywhere or press{' '}
            <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-xs font-mono border border-slate-700">
              Ctrl+O
            </kbd>
          </p>
          <div
            className={`drop-zone p-10 cursor-pointer transition-all duration-200 rounded-2xl ${
              isDragOver
                ? 'border-indigo-500 bg-indigo-500/10 scale-105'
                : 'hover:border-indigo-500 hover:bg-indigo-500/5'
            }`}
          >
            <Upload
              className={`w-8 h-8 mx-auto mb-2 transition-colors duration-200 ${
                isDragOver ? 'text-indigo-400' : 'text-slate-600'
              }`}
            />
            <p className={`text-sm transition-colors duration-200 ${
              isDragOver ? 'text-indigo-400' : 'text-slate-600'
            }`}>
              {isDragOver ? 'Drop your PDF here!' : 'Drop PDF here'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Loading state ─────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="spinner w-10 h-10" />
          <p className="text-slate-400 text-sm">{loadingMessage || 'Loading…'}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-auto bg-slate-950 relative"
      style={{ scrollBehavior: 'smooth' }}
    >
      <div className="flex flex-col items-center py-8 pb-24 min-h-full">
        {pageStates.map((ps) => {
          const scaledWidth = ps.width * scale * 1.5;
          const scaledHeight = ps.height * scale * 1.5;
          const isActive = ps.pageNum === doc.currentPage;

          return (
            <div
              key={ps.pageNum}
              ref={assignPageRef(ps.pageNum)}
              data-page={ps.pageNum}
              onClick={() => setCurrentPage(ps.pageNum)}
              className={`pdf-page-wrapper mb-10 cursor-pointer ${isActive ? 'active-page' : ''}`}
              style={{ width: scaledWidth, height: scaledHeight }}
            >
              {/* Loading skeleton */}
              {!ps.rendered && (
                <div
                  className="skeleton absolute inset-0 rounded-sm"
                  style={{ width: scaledWidth, height: scaledHeight }}
                />
              )}

              {/* PDF.js render canvas */}
              <canvas
                ref={assignCanvasRef(ps.pageNum)}
                className="pdf-canvas block"
                style={{ display: ps.rendered ? 'block' : 'none' }}
              />

              {/* Annotation layer (Fabric.js) */}
              {ps.rendered && (
                <AnnotationLayer
                  pageIndex={ps.pageNum - 1}
                  width={scaledWidth}
                  height={scaledHeight}
                />
              )}

              {/* Page badge */}
              <div className="page-badge">Page {ps.pageNum}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
