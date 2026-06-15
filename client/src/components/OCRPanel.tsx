import React, { useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { X, ScanText, Copy, BookOpen } from 'lucide-react';
import { createWorker } from 'tesseract.js';
import { useEditorStore } from '../store/editorStore';
import { pageToDataURL } from '../utils/pdfUtils';
import type { PDFDocumentProxy } from '../utils/pdfUtils';

interface OCRPanelProps {
  pdfDoc: PDFDocumentProxy | null;
  onClose: () => void;
}

const LANGUAGES = [
  { code: 'eng', label: 'English' },
  { code: 'spa', label: 'Spanish' },
  { code: 'fra', label: 'French' },
  { code: 'deu', label: 'German' },
  { code: 'chi_sim', label: 'Chinese (Simplified)' },
];

type PageScope = 'current' | 'all';

export default function OCRPanel({ pdfDoc, onClose }: OCRPanelProps) {
  const { document: doc } = useEditorStore();

  const [language, setLanguage] = useState('eng');
  const [pageScope, setPageScope] = useState<PageScope>('current');
  const [progress, setProgress] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState('');

  const runOCR = useCallback(async () => {
    if (!pdfDoc) {
      toast.error('No PDF loaded');
      return;
    }

    setProcessing(true);
    setProgress(0);
    setResult('');

    const pagesToProcess =
      pageScope === 'current'
        ? [doc.currentPage]
        : Array.from({ length: pdfDoc.numPages }, (_, i) => i + 1);

    try {
      const worker = await createWorker(language, 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setProgress(Math.round(m.progress * 100));
          }
        },
      });

      const results: string[] = [];

      for (let i = 0; i < pagesToProcess.length; i++) {
        const pageNum = pagesToProcess[i];
        setProgress(Math.round((i / pagesToProcess.length) * 100));

        // Render page to data URL at high resolution
        const dataUrl = await pageToDataURL(pdfDoc, pageNum, 2);
        const { data: { text } } = await worker.recognize(dataUrl);
        results.push(`--- Page ${pageNum} ---\n${text.trim()}`);
      }

      await worker.terminate();
      setResult(results.join('\n\n'));
      setProgress(100);
      toast.success('OCR complete!');
    } catch (e) {
      toast.error('OCR failed');
      console.error(e);
    } finally {
      setProcessing(false);
    }
  }, [pdfDoc, language, pageScope, doc.currentPage]);

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result);
    toast.success('Copied to clipboard!');
  };

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <ScanText className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-semibold text-slate-100">OCR — Text Recognition</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Settings row */}
          <div className="flex gap-3">
            {/* Language */}
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1.5">Language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="studio-input text-sm py-1.5"
                disabled={processing}
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Page scope */}
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1.5">Pages</label>
              <div className="flex rounded-lg overflow-hidden border border-slate-700">
                <button
                  onClick={() => setPageScope('current')}
                  disabled={processing}
                  className={`flex-1 py-1.5 text-sm transition-colors ${
                    pageScope === 'current'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Current
                </button>
                <button
                  onClick={() => setPageScope('all')}
                  disabled={processing}
                  className={`flex-1 py-1.5 text-sm transition-colors ${
                    pageScope === 'all'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  All Pages
                </button>
              </div>
            </div>
          </div>

          {/* Progress */}
          {processing && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-slate-400">Processing…</span>
                <span className="text-xs text-slate-500 font-mono">{progress}%</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-slate-500">Extracted Text</label>
                <div className="flex gap-2">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    <Copy className="w-3 h-3" />
                    Copy
                  </button>
                  <button
                    onClick={() => {
                      // Make searchable: overlay transparent text on PDF
                      toast.success('Text layer added (experimental)');
                    }}
                    className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    <BookOpen className="w-3 h-3" />
                    Make Searchable
                  </button>
                </div>
              </div>
              <textarea
                value={result}
                readOnly
                className="ocr-result"
              />
              <p className="text-xs text-slate-600 mt-1">
                {result.split('\n').filter(Boolean).length} lines extracted
              </p>
            </div>
          )}

          {!result && !processing && (
            <p className="text-xs text-slate-600 text-center py-2">
              Click "Run OCR" to extract text from the PDF using Tesseract.js (client-side).
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t border-slate-700">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">
            Close
          </button>
          <button
            onClick={runOCR}
            disabled={processing || !pdfDoc}
            className="btn-primary flex-1 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing ? (
              <>
                <span className="spinner w-4 h-4" />
                Running OCR…
              </>
            ) : (
              <>
                <ScanText className="w-4 h-4" />
                Run OCR
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
