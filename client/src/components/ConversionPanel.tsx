import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { X, FileOutput, Download, RefreshCw, AlertTriangle } from 'lucide-react';
import axios from 'axios';
import { useEditorStore } from '../store/editorStore';
import type { ConversionJob } from '../types';

interface ConversionPanelProps {
  onClose: () => void;
}

const OUTPUT_FORMATS = [
  { id: 'docx', label: 'Word', ext: '.docx', icon: '📄', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  { id: 'xlsx', label: 'Excel', ext: '.xlsx', icon: '📊', color: 'bg-green-500/20 text-green-300 border-green-500/30' },
  { id: 'pptx', label: 'PowerPoint', ext: '.pptx', icon: '📑', color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
  { id: 'png', label: 'PNG', ext: '.png', icon: '🖼️', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  { id: 'jpg', label: 'JPEG', ext: '.jpg', icon: '🖼️', color: 'bg-pink-500/20 text-pink-300 border-pink-500/30' },
  { id: 'pdf', label: 'PDF/A', ext: '.pdf', icon: '📕', color: 'bg-red-500/20 text-red-300 border-red-500/30' },
];

export default function ConversionPanel({ onClose }: ConversionPanelProps) {
  const { document: doc } = useEditorStore();
  const [selectedFormat, setSelectedFormat] = useState<string>('docx');
  const [job, setJob] = useState<ConversionJob | null>(null);
  const [polling, setPolling] = useState(false);

  // ── Start conversion ──────────────────────────────────────────────────────────
  const handleConvert = async () => {
    if (!doc.id) {
      toast.error('Please open a PDF first');
      return;
    }

    try {
      const res = await axios.post<ConversionJob>('/api/convert', {
        fileId: doc.id,
        outputFormat: selectedFormat,
      });
      setJob(res.data);
      setPolling(true);
      toast.loading(`Converting to ${selectedFormat.toUpperCase()}…`, { id: 'convert' });
    } catch {
      toast.error('Conversion failed. Is the server running?');
    }
  };

  // ── Poll job status ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!polling || !job) return;

    const interval = setInterval(async () => {
      try {
        const res = await axios.get<ConversionJob>(`/api/convert/${job.jobId}`);
        setJob(res.data);

        if (res.data.status === 'done') {
          setPolling(false);
          toast.success('Conversion complete!', { id: 'convert' });
          clearInterval(interval);
        } else if (res.data.status === 'error') {
          setPolling(false);
          toast.error(res.data.error || 'Conversion error', { id: 'convert' });
          clearInterval(interval);
        }
      } catch {
        setPolling(false);
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [polling, job]);

  const handleDownload = () => {
    if (job?.downloadUrl) {
      const a = document.createElement('a');
      a.href = job.downloadUrl;
      a.download = `${doc.name.replace('.pdf', '')}.${selectedFormat}`;
      a.click();
    }
  };

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <FileOutput className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-semibold text-slate-100">Convert PDF</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4">
          {/* Input format */}
          <div className="mb-4">
            <p className="text-xs text-slate-500 mb-1">Source</p>
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-900 rounded-lg border border-slate-700">
              <span className="text-lg">📕</span>
              <div>
                <p className="text-sm font-medium text-slate-200">
                  {doc.name || 'No file loaded'}
                </p>
                <p className="text-xs text-slate-500">PDF Document · {doc.totalPages} pages</p>
              </div>
            </div>
          </div>

          {/* Output format selection */}
          <div className="mb-4">
            <p className="text-xs text-slate-500 mb-2">Output Format</p>
            <div className="grid grid-cols-3 gap-2">
              {OUTPUT_FORMATS.map((fmt) => (
                <button
                  key={fmt.id}
                  onClick={() => setSelectedFormat(fmt.id)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all duration-150 ${
                    selectedFormat === fmt.id
                      ? fmt.color + ' ring-1 ring-current scale-105'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  <span className="text-2xl">{fmt.icon}</span>
                  <span className="text-xs font-medium">{fmt.label}</span>
                  <span className="text-xs opacity-60">{fmt.ext}</span>
                </button>
              ))}
            </div>
          </div>

          {/* LibreOffice warning for office formats */}
          {['docx', 'xlsx', 'pptx'].includes(selectedFormat) && (
            <div className="flex gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-4">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300">
                Office format conversion requires LibreOffice installed on the server.
              </p>
            </div>
          )}

          {/* Progress */}
          {job && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-slate-400 capitalize">{job.status}</span>
                <span className="text-xs text-slate-500">{job.progress}%</span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${job.progress}%` }}
                />
              </div>
              {job.status === 'error' && job.error && (
                <p className="text-xs text-red-400 mt-1.5">{job.error}</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t border-slate-700">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">
            Cancel
          </button>

          {job?.status === 'done' ? (
            <button onClick={handleDownload} className="btn-primary flex-1 justify-center">
              <Download className="w-4 h-4" />
              Download
            </button>
          ) : (
            <button
              onClick={handleConvert}
              disabled={polling || !doc.id}
              className="btn-primary flex-1 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {polling ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Converting…
                </>
              ) : (
                <>
                  <FileOutput className="w-4 h-4" />
                  Convert
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
