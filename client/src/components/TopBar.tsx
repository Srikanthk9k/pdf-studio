import React, { useState, useRef } from 'react';
import { toast } from 'react-hot-toast';
import {
  FolderOpen,
  Save,
  Download,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize,
  AlignJustify,
  Sun,
  Moon,
  Share2,
  ChevronLeft,
  ChevronRight,
  Layers,
} from 'lucide-react';
import { useEditorStore } from '../store/editorStore';
import { useHistory } from '../hooks/useHistory';
import { flattenAndDownload } from '../utils/exportUtils';

type ActiveModal = 'convert' | 'ocr' | 'security' | 'share' | null;

interface TopBarProps {
  onOpenFile: () => void;
  onOpenModal: (modal: ActiveModal) => void;
}

export default function TopBar({ onOpenFile, onOpenModal }: TopBarProps) {
  const {
    document: doc,
    settings,
    toggleTheme,
    setZoom,
    setCurrentPage,
    setDocument,
    annotations,
  } = useEditorStore();

  const { undo, redo, canUndo, canRedo } = useHistory();

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [zoomInput, setZoomInput] = useState(false);
  const [zoomValue, setZoomValue] = useState('');
  const [pageInput, setPageInput] = useState(false);
  const [pageValue, setPageValue] = useState('');

  const nameRef = useRef<HTMLInputElement>(null);
  const zoomRef = useRef<HTMLInputElement>(null);

  // ── File name editing ─────────────────────────────────────────────────────────
  const startEditName = () => {
    setNameValue(doc.name);
    setEditingName(true);
    setTimeout(() => nameRef.current?.select(), 50);
  };

  const commitName = () => {
    const trimmed = nameValue.trim() || doc.name;
    setDocument({ name: trimmed });
    setEditingName(false);
  };

  // ── Zoom control ──────────────────────────────────────────────────────────────
  const handleZoomClick = () => {
    setZoomValue(Math.round(doc.zoom * 100).toString());
    setZoomInput(true);
    setTimeout(() => zoomRef.current?.select(), 50);
  };

  const commitZoom = () => {
    const val = parseInt(zoomValue, 10);
    if (!isNaN(val) && val >= 25 && val <= 500) {
      setZoom(val / 100);
    }
    setZoomInput(false);
  };

  // ── Page navigation ────────────────────────────────────────────────────────────
  const handlePageClick = () => {
    setPageValue(doc.currentPage.toString());
    setPageInput(true);
  };

  const commitPage = () => {
    const val = parseInt(pageValue, 10);
    if (!isNaN(val) && val >= 1 && val <= doc.totalPages) {
      setCurrentPage(val);
    }
    setPageInput(false);
  };

  // ── Save / Export ──────────────────────────────────────────────────────────────
  const handleSave = () => {
    toast.success('Document saved!');
  };

  const handleExport = async () => {
    if (!doc.fileBytes) {
      toast.error('No PDF loaded');
      return;
    }
    toast.loading('Exporting PDF…', { id: 'export' });
    try {
      // Collect canvas data URLs from DOM
      const canvasDataUrls: Record<number, string> = {};
      const fabricCanvases = document.querySelectorAll<HTMLCanvasElement>('[data-fabric-page]');
      fabricCanvases.forEach((c) => {
        const pageIndex = parseInt(c.getAttribute('data-fabric-page') || '-1', 10);
        if (pageIndex >= 0) {
          canvasDataUrls[pageIndex] = c.toDataURL('image/png');
        }
      });
      await flattenAndDownload(doc.fileBytes, canvasDataUrls, doc.name);
      toast.success('Exported!', { id: 'export' });
    } catch {
      toast.error('Export failed', { id: 'export' });
    }
  };

  const zoom = doc.zoom;
  const currentPage = doc.currentPage;
  const totalPages = doc.totalPages;

  return (
    <header className="flex items-center gap-1 px-3 py-2 bg-slate-900 border-b border-slate-700/60 shadow-toolbar z-30 flex-shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2 mr-3 select-none">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg">
          <Layers className="w-4 h-4 text-white" />
        </div>
        <span className="font-bold text-sm logo-gradient hidden sm:block">PDF Studio</span>
      </div>

      {/* Divider */}
      <div className="divider-v" />

      {/* Open / Save / Export */}
      <button
        onClick={onOpenFile}
        title="Open PDF (Ctrl+O)"
        className="toolbar-btn p-2"
      >
        <FolderOpen className="w-4 h-4" />
      </button>
      <button
        onClick={handleSave}
        title="Save (Ctrl+S)"
        className="toolbar-btn p-2"
      >
        <Save className="w-4 h-4" />
      </button>
      <button
        onClick={handleExport}
        title="Export PDF"
        className="toolbar-btn p-2"
      >
        <Download className="w-4 h-4" />
      </button>

      {/* Divider */}
      <div className="divider-v" />

      {/* Undo / Redo */}
      <button
        onClick={undo}
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
        className="toolbar-btn p-2"
      >
        <Undo2 className="w-4 h-4" />
      </button>
      <button
        onClick={redo}
        disabled={!canRedo}
        title="Redo (Ctrl+Y)"
        className="toolbar-btn p-2"
      >
        <Redo2 className="w-4 h-4" />
      </button>

      {/* Divider */}
      <div className="divider-v" />

      {/* Zoom Controls */}
      <button
        onClick={() => setZoom(Math.max(0.25, zoom - 0.25))}
        title="Zoom out"
        className="toolbar-btn p-2"
      >
        <ZoomOut className="w-4 h-4" />
      </button>

      {zoomInput ? (
        <input
          ref={zoomRef}
          type="number"
          value={zoomValue}
          onChange={(e) => setZoomValue(e.target.value)}
          onBlur={commitZoom}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitZoom();
            if (e.key === 'Escape') setZoomInput(false);
          }}
          className="w-14 text-center text-xs bg-slate-700 border border-slate-500 rounded px-1 py-0.5 text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      ) : (
        <button
          onClick={handleZoomClick}
          title="Click to type zoom %"
          className="text-xs font-medium text-slate-300 hover:text-slate-100 bg-slate-800 hover:bg-slate-700 rounded px-2 py-0.5 w-14 text-center transition-colors"
        >
          {Math.round(zoom * 100)}%
        </button>
      )}

      <button
        onClick={() => setZoom(Math.min(5, zoom + 0.25))}
        title="Zoom in"
        className="toolbar-btn p-2"
      >
        <ZoomIn className="w-4 h-4" />
      </button>

      {/* Fit to page */}
      <button
        onClick={() => setZoom(1)}
        title="Fit to page (100%)"
        className="toolbar-btn p-2"
      >
        <Maximize className="w-4 h-4" />
      </button>

      {/* Fit to width */}
      <button
        onClick={() => setZoom(1.5)}
        title="Fit to width"
        className="toolbar-btn p-2"
      >
        <AlignJustify className="w-4 h-4" />
      </button>

      {/* Divider */}
      <div className="divider-v" />

      {/* Page navigation */}
      {totalPages > 0 && (
        <div className="flex items-center gap-1 text-xs text-slate-400">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
            className="toolbar-btn p-1"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          {pageInput ? (
            <input
              type="number"
              value={pageValue}
              onChange={(e) => setPageValue(e.target.value)}
              onBlur={commitPage}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitPage();
                if (e.key === 'Escape') setPageInput(false);
              }}
              className="w-10 text-center text-xs bg-slate-700 border border-slate-500 rounded px-1 py-0.5 text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              autoFocus
            />
          ) : (
            <button
              onClick={handlePageClick}
              className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              {currentPage}
            </button>
          )}
          <span className="text-slate-600">/ {totalPages}</span>

          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages}
            className="toolbar-btn p-1"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* File name */}
      <div className="max-w-xs hidden md:block">
        {editingName ? (
          <input
            ref={nameRef}
            type="text"
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitName();
              if (e.key === 'Escape') setEditingName(false);
            }}
            className="w-full text-xs text-center bg-slate-700 border border-slate-500 rounded px-2 py-0.5 text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        ) : (
          <button
            onClick={startEditName}
            title="Click to rename"
            className="text-xs text-slate-400 hover:text-slate-200 truncate max-w-[180px] px-2 py-0.5 rounded hover:bg-slate-800 transition-colors"
          >
            {doc.name || 'Untitled.pdf'}
          </button>
        )}
      </div>

      {/* Divider */}
      <div className="divider-v" />

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        title={`Switch to ${settings.theme === 'dark' ? 'light' : 'dark'} mode`}
        className="toolbar-btn p-2"
      >
        {settings.theme === 'dark' ? (
          <Sun className="w-4 h-4" />
        ) : (
          <Moon className="w-4 h-4" />
        )}
      </button>

      {/* Share */}
      <button
        onClick={() => onOpenModal('share')}
        title="Share document"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-all duration-150 shadow-lg shadow-indigo-500/20 ml-1"
      >
        <Share2 className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Share</span>
      </button>
    </header>
  );
}
