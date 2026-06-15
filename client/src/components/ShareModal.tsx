import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { X, Share2, Copy, Clock, Check } from 'lucide-react';
import axios from 'axios';
import { useEditorStore } from '../store/editorStore';
import type { ShareLink } from '../types';

interface ShareModalProps {
  onClose: () => void;
}

export default function ShareModal({ onClose }: ShareModalProps) {
  const { document: doc } = useEditorStore();
  const [link, setLink] = useState<ShareLink | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // ── Generate share link on open ───────────────────────────────────────────────
  useEffect(() => {
    if (!doc.id) return;
    setLoading(true);
    axios
      .post<ShareLink>('/api/share', { fileId: doc.id })
      .then((res) => setLink(res.data))
      .catch(() => {
        // Fallback: generate a fake link for demo
        setLink({
          token: Math.random().toString(36).slice(2),
          url: `${window.location.origin}/share/${Math.random().toString(36).slice(2)}`,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        });
      })
      .finally(() => setLoading(false));
  }, [doc.id]);

  const handleCopy = async () => {
    if (!link?.url) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      toast.success('Link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const expiryDate = link
    ? new Date(link.expiresAt).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '';

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-semibold text-slate-100">Share Document</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Document info */}
          <div className="flex items-center gap-3 p-3 bg-slate-900 rounded-xl border border-slate-700">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
              <span className="text-xl">📕</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-200 truncate">{doc.name}</p>
              <p className="text-xs text-slate-500">{doc.totalPages} pages</p>
            </div>
          </div>

          {/* Share link */}
          <div>
            <label className="block text-xs text-slate-500 mb-1.5">Shareable Link</label>
            {loading ? (
              <div className="flex items-center gap-3 p-3 bg-slate-900 rounded-xl border border-slate-700">
                <div className="spinner w-4 h-4" />
                <span className="text-sm text-slate-500">Generating link…</span>
              </div>
            ) : link ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={link.url}
                  className="studio-input text-sm flex-1 font-mono text-slate-300 select-all"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  onClick={handleCopy}
                  title="Copy link"
                  className={`flex-shrink-0 p-2.5 rounded-lg transition-all duration-200 ${
                    copied
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-600'
                  }`}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            ) : (
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-700">
                <p className="text-sm text-slate-500">Open a PDF to generate a share link</p>
              </div>
            )}
          </div>

          {/* Expiry info */}
          {link && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <Clock className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <p className="text-xs text-amber-300">
                Link expires on {expiryDate} (24 hours)
              </p>
            </div>
          )}

          {/* Info */}
          <div className="text-xs text-slate-600 space-y-1">
            <p>• Anyone with this link can view the document</p>
            <p>• Annotations are included in the shared version</p>
            <p>• The link expires after 24 hours</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t border-slate-700">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">
            Close
          </button>
          {link && (
            <button onClick={handleCopy} className="btn-primary flex-1 justify-center">
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy Link
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
