/**
 * PDFEditor — The core editor component.
 *
 * Features:
 * - Renders all PDF pages via PDF.js
 * - Click anywhere on a page to place a text annotation
 * - Font-matching: samples nearby PDF text items to suggest font size
 * - Floating text input popup with font controls
 * - Export: embeds all text annotations into a real PDF using pdf-lib
 * - Undo last annotation (Ctrl+Z)
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import toast from 'react-hot-toast';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { renderPageToCanvas } from '../utils/pdfUtils';
import type { PDFDocumentProxy } from '../utils/pdfUtils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TextAnnotation {
  id: string;
  pageIndex: number;  // 0-based
  // Position as fraction of rendered page dimensions (0–1), so it's zoom-independent
  xFrac: number;
  yFrac: number;
  text: string;
  fontSize: number;   // points, at zoom=1
  color: string;      // hex
  fontFamily: 'Helvetica' | 'Times-Roman' | 'Courier';
}

interface PendingText {
  pageIndex: number;
  xFrac: number;
  yFrac: number;
  // pixel position for the popup
  popupLeft: number;
  popupTop: number;
  suggestedFontSize: number;
}

interface PDFEditorProps {
  pdfDoc: PDFDocumentProxy;
  pdfBytes: ArrayBuffer;
  fileName: string;
  onOpenNew: () => void;
  onFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

// ─── Page dimensions cache ────────────────────────────────────────────────────

interface PageInfo {
  width: number;   // natural width at scale 1
  height: number;  // natural height at scale 1
}

// ─── Font-sample helper ────────────────────────────────────────────────────────
// Samples nearby PDF text to suggest a matching font size.
async function sampleFontSize(
  pdfDoc: PDFDocumentProxy,
  pageIndex: number,
  xFrac: number,
  yFrac: number
): Promise<number> {
  try {
    const page = await pdfDoc.getPage(pageIndex + 1);
    const vp = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();

    // Click in natural PDF coords (y flipped: PDF origin is bottom-left)
    const pdfX = xFrac * vp.width;
    const pdfY = (1 - yFrac) * vp.height;

    let bestSize = 14; // default
    let bestDist = Infinity;

    for (const item of content.items) {
      if (!('transform' in item)) continue;
      const [a, , , d, e, f] = item.transform as number[];
      const itemX = e;
      const itemY = f;
      const fs = Math.abs(d) || Math.abs(a) || 14;
      const dx = pdfX - itemX;
      const dy = pdfY - itemY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < bestDist) {
        bestDist = dist;
        bestSize = Math.round(fs);
      }
    }
    // Only suggest if reasonably close
    return bestDist < 200 ? Math.max(8, Math.min(72, bestSize)) : 14;
  } catch {
    return 14;
  }
}

// ─── Single rendered page ─────────────────────────────────────────────────────

interface PageProps {
  pdfDoc: PDFDocumentProxy;
  pageIndex: number;
  zoom: number;
  annotations: TextAnnotation[];
  onPageClick: (pageIndex: number, xFrac: number, yFrac: number, popupLeft: number, popupTop: number) => void;
  onPageInfo: (pageIndex: number, info: PageInfo) => void;
}

function PDFPage({ pdfDoc, pageIndex, zoom, annotations, onPageClick, onPageInfo }: PageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 612, h: 792 });

  // Render the page whenever pdfDoc or zoom changes
  useEffect(() => {
    if (!canvasRef.current) return;
    let cancelled = false;

    (async () => {
      try {
        const page = await pdfDoc.getPage(pageIndex + 1);
        const vp = page.getViewport({ scale: 1 });
        if (cancelled) return;

        const info = { width: vp.width, height: vp.height };
        onPageInfo(pageIndex, info);

        const scaledW = vp.width * zoom;
        const scaledH = vp.height * zoom;
        setDims({ w: scaledW, h: scaledH });

        if (canvasRef.current) {
          await renderPageToCanvas(pdfDoc, pageIndex + 1, canvasRef.current, zoom);
        }
      } catch (e) {
        if (!cancelled) console.error('render error', e);
      }
    })();

    return () => { cancelled = true; };
  }, [pdfDoc, pageIndex, zoom, onPageInfo]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const xPx = e.clientX - rect.left;
    const yPx = e.clientY - rect.top;
    const xFrac = xPx / rect.width;
    const yFrac = yPx / rect.height;
    // Popup position: absolute in viewport
    onPageClick(pageIndex, xFrac, yFrac, e.clientX, e.clientY);
  }, [pageIndex, onPageClick]);

  const pageAnnotations = annotations.filter(a => a.pageIndex === pageIndex);

  return (
    <div className="relative inline-block shadow-2xl mb-10" ref={wrapRef} style={{ width: dims.w, height: dims.h }}>
      {/* Rendered PDF canvas */}
      <canvas ref={canvasRef} className="block" style={{ width: dims.w, height: dims.h }} />

      {/* Click overlay */}
      <div
        className="absolute inset-0 cursor-text"
        onClick={handleClick}
        title="Click to add text"
      />

      {/* Text annotations overlay */}
      {pageAnnotations.map((ann) => (
        <div
          key={ann.id}
          className="absolute pointer-events-none select-none"
          style={{
            left: `${ann.xFrac * 100}%`,
            top: `${ann.yFrac * 100}%`,
            fontSize: ann.fontSize * zoom,
            color: ann.color,
            fontFamily: ann.fontFamily === 'Times-Roman'
              ? '"Times New Roman", Times, serif'
              : ann.fontFamily === 'Courier'
                ? '"Courier New", Courier, monospace'
                : 'Helvetica, Arial, sans-serif',
            whiteSpace: 'pre',
            lineHeight: 1.2,
            transform: 'translateY(-50%)',
            textShadow: 'none',
          }}
        >
          {ann.text}
        </div>
      ))}

      {/* Page number badge */}
      <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 text-xs text-slate-500 bg-slate-900 px-3 py-0.5 rounded-full border border-slate-700 whitespace-nowrap">
        Page {pageIndex + 1}
      </div>
    </div>
  );
}

// ─── Text placement popup ─────────────────────────────────────────────────────

interface TextPopupProps {
  pending: PendingText;
  onConfirm: (text: string, fontSize: number, color: string, fontFamily: TextAnnotation['fontFamily']) => void;
  onCancel: () => void;
}

function TextPopup({ pending, onConfirm, onCancel }: TextPopupProps) {
  const [text, setText] = useState('');
  const [fontSize, setFontSize] = useState(pending.suggestedFontSize);
  const [color, setColor] = useState('#000000');
  const [fontFamily, setFontFamily] = useState<TextAnnotation['fontFamily']>('Helvetica');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFontSize(pending.suggestedFontSize);
    setText('');
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [pending]);

  const confirm = () => {
    const trimmed = text.trim();
    if (!trimmed) { onCancel(); return; }
    onConfirm(trimmed, fontSize, color, fontFamily);
    setText('');
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); confirm(); }
    if (e.key === 'Escape') onCancel();
  };

  // Position popup near click but keep on screen
  const POPUP_W = 340;
  const POPUP_H = 180;
  const left = Math.min(pending.popupLeft + 8, window.innerWidth - POPUP_W - 16);
  const top = Math.min(pending.popupTop + 8, window.innerHeight - POPUP_H - 16);

  return (
    <>
      {/* Click-away backdrop */}
      <div className="fixed inset-0 z-40" onClick={onCancel} />

      <div
        className="fixed z-50 bg-slate-800 border border-slate-600 rounded-2xl shadow-2xl p-4 w-[340px]"
        style={{ left, top }}
        onClick={e => e.stopPropagation()}
      >
        <p className="text-xs text-slate-400 mb-2 font-medium">Add Text</p>

        {/* Text input */}
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Type here…"
          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-3"
        />

        {/* Controls row */}
        <div className="flex items-center gap-3 mb-3">
          {/* Font family */}
          <select
            value={fontFamily}
            onChange={e => setFontFamily(e.target.value as TextAnnotation['fontFamily'])}
            className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="Helvetica">Helvetica (Sans)</option>
            <option value="Times-Roman">Times (Serif)</option>
            <option value="Courier">Courier (Mono)</option>
          </select>

          {/* Font size */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setFontSize(s => Math.max(6, s - 2))}
              className="w-6 h-6 rounded bg-slate-700 text-slate-300 text-xs hover:bg-slate-600 flex items-center justify-center"
            >−</button>
            <input
              type="number"
              value={fontSize}
              onChange={e => setFontSize(Math.max(6, Math.min(120, Number(e.target.value))))}
              className="w-12 text-center bg-slate-900 border border-slate-600 rounded px-1 py-1 text-xs text-slate-200 focus:outline-none"
            />
            <button
              onClick={() => setFontSize(s => Math.min(120, s + 2))}
              className="w-6 h-6 rounded bg-slate-700 text-slate-300 text-xs hover:bg-slate-600 flex items-center justify-center"
            >+</button>
          </div>

          {/* Color */}
          <input
            type="color"
            value={color}
            onChange={e => setColor(e.target.value)}
            title="Text color"
            className="w-8 h-8 rounded cursor-pointer border-2 border-slate-600 bg-slate-900 p-0.5"
          />
        </div>

        {/* Preview */}
        {text && (
          <div className="mb-3 px-2 py-1 bg-white rounded overflow-hidden h-8 flex items-center">
            <span
              style={{
                fontSize: Math.min(fontSize, 20),
                color,
                fontFamily: fontFamily === 'Times-Roman' ? '"Times New Roman",serif' : fontFamily === 'Courier' ? 'monospace' : 'sans-serif',
                lineHeight: 1,
              }}
            >
              {text}
            </span>
          </div>
        )}

        {/* Suggested font size badge */}
        {pending.suggestedFontSize !== 14 && (
          <p className="text-xs text-indigo-400 mb-2">
            📐 Detected nearby font size: {pending.suggestedFontSize}pt
            <button onClick={() => setFontSize(pending.suggestedFontSize)} className="ml-2 underline hover:text-indigo-300">use it</button>
          </p>
        )}

        {/* Buttons */}
        <div className="flex gap-2">
          <button
            onClick={confirm}
            disabled={!text.trim()}
            className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Place Text ↵
          </button>
          <button
            onClick={onCancel}
            className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Main PDFEditor ───────────────────────────────────────────────────────────

export default function PDFEditor({ pdfDoc, pdfBytes, fileName, onOpenNew, onFileInput }: PDFEditorProps) {
  const [zoom, setZoom] = useState(1);
  const [annotations, setAnnotations] = useState<TextAnnotation[]>([]);
  const [pending, setPending] = useState<PendingText | null>(null);
  const [pageInfos, setPageInfos] = useState<Map<number, PageInfo>>(new Map());
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Store page info from each rendered page
  const handlePageInfo = useCallback((pageIndex: number, info: PageInfo) => {
    setPageInfos(prev => {
      const next = new Map(prev);
      next.set(pageIndex, info);
      return next;
    });
  }, []);

  // Handle click on a page
  const handlePageClick = useCallback(async (
    pageIndex: number,
    xFrac: number,
    yFrac: number,
    popupLeft: number,
    popupTop: number
  ) => {
    // Sample nearby font size from PDF text content
    const suggestedFontSize = await sampleFontSize(pdfDoc, pageIndex, xFrac, yFrac);
    setPending({ pageIndex, xFrac, yFrac, popupLeft, popupTop, suggestedFontSize });
  }, [pdfDoc]);

  // Confirm placing text
  const handleConfirm = useCallback((
    text: string,
    fontSize: number,
    color: string,
    fontFamily: TextAnnotation['fontFamily']
  ) => {
    if (!pending) return;
    setAnnotations(prev => [...prev, {
      id: `${Date.now()}-${Math.random()}`,
      pageIndex: pending.pageIndex,
      xFrac: pending.xFrac,
      yFrac: pending.yFrac,
      text,
      fontSize,
      color,
      fontFamily,
    }]);
    setPending(null);
    toast.success('Text placed');
  }, [pending]);

  // Undo last annotation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        setAnnotations(prev => {
          if (prev.length === 0) return prev;
          toast('Undo', { icon: '↩️' });
          return prev.slice(0, -1);
        });
      }
      if (e.key === 'Escape') setPending(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Export: embed all text annotations into the PDF using pdf-lib
  const handleExport = async () => {
    setExporting(true);
    const tid = toast.loading('Exporting PDF with text…');
    try {
      const pdfLibDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
      const pages = pdfLibDoc.getPages();

      // Embed fonts
      const helvetica = await pdfLibDoc.embedFont(StandardFonts.Helvetica);
      const timesRoman = await pdfLibDoc.embedFont(StandardFonts.TimesRoman);
      const courier = await pdfLibDoc.embedFont(StandardFonts.Courier);

      const fontMap = {
        'Helvetica': helvetica,
        'Times-Roman': timesRoman,
        'Courier': courier,
      };

      for (const ann of annotations) {
        const page = pages[ann.pageIndex];
        if (!page) continue;
        const { width: pdfW, height: pdfH } = page.getSize();

        const info = pageInfos.get(ann.pageIndex);
        // Natural page dimensions from PDF.js (viewport at scale 1)
        const naturalW = info?.width ?? pdfW;
        const naturalH = info?.height ?? pdfH;

        // Convert fraction to PDF coords
        // PDF origin is bottom-left; screen origin is top-left
        const pdfX = ann.xFrac * naturalW;
        const pdfY = pdfH - (ann.yFrac * naturalH);

        // Parse hex color
        const hex = ann.color.replace('#', '');
        const r = parseInt(hex.slice(0, 2), 16) / 255;
        const g = parseInt(hex.slice(2, 4), 16) / 255;
        const b = parseInt(hex.slice(4, 6), 16) / 255;

        const font = fontMap[ann.fontFamily] ?? helvetica;

        page.drawText(ann.text, {
          x: pdfX,
          y: pdfY - ann.fontSize * 0.3, // slight baseline adjustment
          size: ann.fontSize,
          font,
          color: rgb(r, g, b),
        });
      }

      const outBytes = await pdfLibDoc.save();
      const blob = new Blob([outBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName.replace(/\.pdf$/i, '') + '_edited.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      toast.success('Exported!', { id: tid });
    } catch (e) {
      console.error(e);
      toast.error('Export failed', { id: tid });
    } finally {
      setExporting(false);
    }
  };

  const pageCount = pdfDoc.numPages;
  const zoomPct = Math.round(zoom * 100);

  return (
    <div className="flex flex-col h-screen bg-slate-950 overflow-hidden">
      {/* ── Top Bar ──────────────────────────────────────────────────────────── */}
      <header className="flex items-center gap-2 px-4 py-2 bg-slate-900 border-b border-slate-700/60 flex-shrink-0 z-30">
        {/* Logo */}
        <div className="flex items-center gap-2 mr-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
            <svg viewBox="0 0 20 20" className="w-4 h-4 text-white fill-current">
              <path d="M9 2a2 2 0 00-2 2v1H5a2 2 0 00-2 2v9a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2V4a2 2 0 00-2-2H9zM7 4a1 1 0 011-1h4a1 1 0 011 1v1H7V4zm-2 4h10v7H5V8z" />
            </svg>
          </div>
          <span className="font-bold text-sm bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent hidden sm:block">
            PDF Studio
          </span>
        </div>

        <div className="w-px h-5 bg-slate-700 mx-1" />

        {/* Open new file */}
        <label
          htmlFor="top-file-input"
          title="Open another PDF (drag & drop also works)"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 text-xs font-medium cursor-pointer transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          Open
        </label>
        <input id="top-file-input" ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={onFileInput} />

        {/* File name */}
        <span className="text-xs text-slate-400 truncate max-w-[160px] hidden sm:block" title={fileName}>
          {fileName}
        </span>

        <div className="flex-1" />

        {/* Instructions */}
        <span className="text-xs text-slate-500 hidden md:block">
          Click on the PDF to add text · Ctrl+Z to undo
        </span>

        <div className="w-px h-5 bg-slate-700 mx-1" />

        {/* Annotation count badge */}
        {annotations.length > 0 && (
          <span className="text-xs text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded-full">
            {annotations.length} text{annotations.length > 1 ? 's' : ''} added
          </span>
        )}

        {/* Undo */}
        <button
          onClick={() => setAnnotations(prev => prev.slice(0, -1))}
          disabled={annotations.length === 0}
          title="Undo last text (Ctrl+Z)"
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 text-xs disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
          </svg>
          Undo
        </button>

        <div className="w-px h-5 bg-slate-700 mx-1" />

        {/* Zoom */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom(z => Math.max(0.3, z - 0.25))}
            className="w-7 h-7 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm flex items-center justify-center transition-colors"
          >−</button>
          <button
            onClick={() => setZoom(1)}
            className="text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 rounded px-2 h-7 transition-colors min-w-[50px] text-center"
          >
            {zoomPct}%
          </button>
          <button
            onClick={() => setZoom(z => Math.min(3, z + 0.25))}
            className="w-7 h-7 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm flex items-center justify-center transition-colors"
          >+</button>
        </div>

        <div className="w-px h-5 bg-slate-700 mx-1" />

        {/* Export */}
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white text-xs font-semibold transition-colors shadow-lg shadow-indigo-500/20"
        >
          {exporting ? (
            <span className="w-3.5 h-3.5 border border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          )}
          Export PDF
        </button>
      </header>

      {/* ── Scroll area ──────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto bg-slate-950">
        <div className="flex flex-col items-center py-10 px-4 min-h-full">
          {Array.from({ length: pageCount }, (_, i) => (
            <PDFPage
              key={i}
              pdfDoc={pdfDoc}
              pageIndex={i}
              zoom={zoom}
              annotations={annotations}
              onPageClick={handlePageClick}
              onPageInfo={handlePageInfo}
            />
          ))}
          <p className="text-slate-600 text-xs mt-4">{pageCount} page{pageCount > 1 ? 's' : ''} · Click anywhere to add text</p>
        </div>
      </div>

      {/* ── Text placement popup ──────────────────────────────────────────────── */}
      {pending && (
        <TextPopup
          pending={pending}
          onConfirm={handleConfirm}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}
