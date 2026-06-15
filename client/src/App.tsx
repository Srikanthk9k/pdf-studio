import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { loadPDF } from './utils/pdfUtils';
import PDFEditor from './components/PDFEditor';
import type { PDFDocumentProxy } from './utils/pdfUtils';

export default function App() {
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null);
  const [fileName, setFileName] = useState('document.pdf');
  const [isDragOver, setIsDragOver] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load a File into state
  const loadFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      toast.error('Please select a PDF file');
      return;
    }
    setLoading(true);
    try {
      const bytes = await file.arrayBuffer();
      // Keep the original bytes; pass a copy to PDF.js (it will neuter the copy)
      const doc = await loadPDF(bytes.slice(0));
      setPdfBytes(bytes);
      setPdfDoc(doc);
      setFileName(file.name);
      toast.success(`Opened "${file.name}"`);
    } catch (e) {
      toast.error('Failed to open PDF — it may be encrypted or corrupted.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Window-level native drag-and-drop (bypasses any DnD library)
  useEffect(() => {
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        setIsDragOver(true);
      }
    };
    const onDragLeave = (e: DragEvent) => {
      // Only clear when leaving the window completely
      if (e.clientX === 0 && e.clientY === 0) setIsDragOver(false);
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer?.files[0];
      if (file) loadFile(file);
    };
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [loadFile]);

  // File input change handler
  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
    e.target.value = ''; // reset so same file can be re-selected
  };

  // ─── Upload / empty state ────────────────────────────────────────────────────
  if (!pdfDoc) {
    return (
      <div
        className={`h-screen w-screen flex items-center justify-center bg-slate-950 transition-all duration-200 ${
          isDragOver ? 'bg-indigo-950/60' : ''
        }`}
      >
        <label
          htmlFor="pdf-upload-input"
          className={`
            flex flex-col items-center gap-6 p-16 rounded-3xl border-2 border-dashed cursor-pointer
            transition-all duration-200 select-none
            ${isDragOver
              ? 'border-indigo-400 bg-indigo-500/10 scale-105'
              : 'border-slate-700 hover:border-indigo-500 hover:bg-indigo-500/5'
            }
          `}
        >
          {/* PDF icon */}
          <div className={`w-24 h-24 rounded-2xl flex items-center justify-center transition-colors duration-200 ${isDragOver ? 'bg-indigo-500/20' : 'bg-slate-800'}`}>
            <svg viewBox="0 0 24 24" className={`w-12 h-12 ${isDragOver ? 'text-indigo-400' : 'text-slate-500'}`} fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>

          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-400 text-sm">Loading PDF…</p>
            </div>
          ) : (
            <>
              <div className="text-center">
                <h1 className="text-2xl font-bold text-slate-100 mb-2">
                  {isDragOver ? 'Release to open PDF' : 'PDF Text Editor'}
                </h1>
                <p className="text-slate-400 text-sm max-w-xs">
                  {isDragOver
                    ? 'Drop it here!'
                    : 'Drop a PDF file here or click to browse. Click anywhere on the PDF to add text.'}
                </p>
              </div>
              <div className={`px-6 py-3 rounded-xl text-sm font-medium transition-colors duration-150 ${isDragOver ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
                {isDragOver ? '📄 Drop PDF here' : 'Browse Files'}
              </div>
            </>
          )}

          <input
            id="pdf-upload-input"
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={onFileInput}
          />
        </label>
      </div>
    );
  }

  // ─── Editor ──────────────────────────────────────────────────────────────────
  return (
    <PDFEditor
      pdfDoc={pdfDoc}
      pdfBytes={pdfBytes!}
      fileName={fileName}
      onOpenNew={() => {
        // Reset state so user can load new file
        setPdfDoc(null);
        setPdfBytes(null);
      }}
      onFileInput={onFileInput}
    />
  );
}
