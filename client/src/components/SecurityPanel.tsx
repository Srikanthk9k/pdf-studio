import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { X, Shield, Lock, Unlock, Zap, Eye } from 'lucide-react';
import axios from 'axios';
import { useEditorStore } from '../store/editorStore';

interface SecurityPanelProps {
  onClose: () => void;
}

interface Permissions {
  printing: boolean;
  copying: boolean;
  editing: boolean;
  annotating: boolean;
}

type CompressionQuality = 'low' | 'medium' | 'high';

interface CompressResult {
  originalSize: number;
  compressedSize: number;
  downloadUrl: string;
}

export default function SecurityPanel({ onClose }: SecurityPanelProps) {
  const { document: doc } = useEditorStore();

  // ── Password protection state ─────────────────────────────────────────────────
  const [userPassword, setUserPassword] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [showUserPw, setShowUserPw] = useState(false);
  const [showOwnerPw, setShowOwnerPw] = useState(false);
  const [permissions, setPermissions] = useState<Permissions>({
    printing: true,
    copying: false,
    editing: false,
    annotating: true,
  });
  const [protecting, setProtecting] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  // ── Compression state ─────────────────────────────────────────────────────────
  const [quality, setQuality] = useState<CompressionQuality>('medium');
  const [compressing, setCompressing] = useState(false);
  const [compressResult, setCompressResult] = useState<CompressResult | null>(null);

  // ── Protect PDF ───────────────────────────────────────────────────────────────
  const handleProtect = async () => {
    if (!doc.id) { toast.error('No PDF loaded'); return; }
    if (!userPassword && !ownerPassword) { toast.error('Enter at least one password'); return; }
    setProtecting(true);
    try {
      await axios.post('/api/protect', {
        fileId: doc.id,
        userPassword,
        ownerPassword,
        permissions,
      });
      toast.success('PDF protected with password!');
      setUserPassword('');
      setOwnerPassword('');
    } catch {
      toast.error('Failed to protect PDF. Is the server running?');
    } finally {
      setProtecting(false);
    }
  };

  // ── Unlock PDF ────────────────────────────────────────────────────────────────
  const handleUnlock = async () => {
    if (!doc.id) { toast.error('No PDF loaded'); return; }
    setUnlocking(true);
    try {
      await axios.post('/api/unlock', { fileId: doc.id, password: userPassword });
      toast.success('Password removed!');
    } catch {
      toast.error('Failed to unlock. Check password and server.');
    } finally {
      setUnlocking(false);
    }
  };

  // ── Compress PDF ──────────────────────────────────────────────────────────────
  const handleCompress = async () => {
    if (!doc.id) { toast.error('No PDF loaded'); return; }
    setCompressing(true);
    setCompressResult(null);
    try {
      const res = await axios.post<CompressResult>('/api/compress', {
        fileId: doc.id,
        quality,
      });
      setCompressResult(res.data);
      const saved = ((res.data.originalSize - res.data.compressedSize) / res.data.originalSize * 100).toFixed(1);
      toast.success(`Compressed! Saved ${saved}%`);
    } catch {
      toast.error('Compression failed. Is the server running?');
    } finally {
      setCompressing(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const togglePermission = (key: keyof Permissions) => {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700 sticky top-0 bg-slate-800 z-10">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-semibold text-slate-100">Security & Compression</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-6">
          {/* ── Password Protection ──────────────────────────────────────────── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Lock className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-200">Password Protection</h3>
            </div>

            {/* User password */}
            <div className="mb-3">
              <label className="block text-xs text-slate-500 mb-1.5">
                User Password <span className="text-slate-600">(required to open)</span>
              </label>
              <div className="relative">
                <input
                  type={showUserPw ? 'text' : 'password'}
                  value={userPassword}
                  onChange={(e) => setUserPassword(e.target.value)}
                  placeholder="Leave blank to skip"
                  className="studio-input pr-8"
                />
                <button
                  onClick={() => setShowUserPw((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  <Eye className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Owner password */}
            <div className="mb-3">
              <label className="block text-xs text-slate-500 mb-1.5">
                Owner Password <span className="text-slate-600">(controls permissions)</span>
              </label>
              <div className="relative">
                <input
                  type={showOwnerPw ? 'text' : 'password'}
                  value={ownerPassword}
                  onChange={(e) => setOwnerPassword(e.target.value)}
                  placeholder="Leave blank to skip"
                  className="studio-input pr-8"
                />
                <button
                  onClick={() => setShowOwnerPw((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  <Eye className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Permissions */}
            <div className="mb-4">
              <label className="block text-xs text-slate-500 mb-2">Permissions</label>
              <div className="space-y-2">
                {(Object.keys(permissions) as (keyof Permissions)[]).map((key) => (
                  <label key={key} className="permission-checkbox">
                    <input
                      type="checkbox"
                      checked={permissions[key]}
                      onChange={() => togglePermission(key)}
                      className="rounded border-slate-600 bg-slate-700 text-indigo-500 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-slate-300 capitalize">{key}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Protect / Unlock buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleProtect}
                disabled={protecting || !doc.id}
                className="btn-primary flex-1 justify-center disabled:opacity-50"
              >
                {protecting ? (
                  <span className="spinner w-4 h-4" />
                ) : (
                  <Lock className="w-4 h-4" />
                )}
                Protect PDF
              </button>
              <button
                onClick={handleUnlock}
                disabled={unlocking || !doc.id}
                className="btn-secondary flex-1 justify-center disabled:opacity-50"
              >
                {unlocking ? (
                  <span className="spinner w-4 h-4" />
                ) : (
                  <Unlock className="w-4 h-4" />
                )}
                Remove Password
              </button>
            </div>
          </section>

          {/* Divider */}
          <div className="h-px bg-slate-700" />

          {/* ── Compression ──────────────────────────────────────────────────── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-200">Compress PDF</h3>
            </div>

            <div className="space-y-2 mb-4">
              {([
                { value: 'low', label: 'Screen (Low Quality)', desc: 'Smallest size, for web/email' },
                { value: 'medium', label: 'eBook (Medium)', desc: 'Balanced quality & size' },
                { value: 'high', label: 'Printer (High Quality)', desc: 'Best quality, larger file' },
              ] as { value: CompressionQuality; label: string; desc: string }[]).map(({ value, label, desc }) => (
                <label
                  key={value}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all duration-150 ${
                    quality === value
                      ? 'border-indigo-500 bg-indigo-500/10'
                      : 'border-slate-700 hover:border-slate-600 bg-slate-900'
                  }`}
                >
                  <input
                    type="radio"
                    name="quality"
                    value={value}
                    checked={quality === value}
                    onChange={() => setQuality(value)}
                    className="mt-0.5 text-indigo-500"
                  />
                  <div>
                    <p className="text-sm text-slate-200 font-medium">{label}</p>
                    <p className="text-xs text-slate-500">{desc}</p>
                  </div>
                </label>
              ))}
            </div>

            {/* Compress result */}
            {compressResult && (
              <div className="flex items-center gap-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20 mb-3">
                <div className="text-center flex-1">
                  <p className="text-xs text-slate-500 mb-0.5">Original</p>
                  <p className="text-sm font-semibold text-slate-200">
                    {formatSize(compressResult.originalSize)}
                  </p>
                </div>
                <div className="text-green-400 text-xl">→</div>
                <div className="text-center flex-1">
                  <p className="text-xs text-slate-500 mb-0.5">Compressed</p>
                  <p className="text-sm font-semibold text-green-300">
                    {formatSize(compressResult.compressedSize)}
                  </p>
                </div>
                <div className="text-center flex-1">
                  <p className="text-xs text-slate-500 mb-0.5">Saved</p>
                  <p className="text-sm font-semibold text-green-400">
                    {((compressResult.originalSize - compressResult.compressedSize) / compressResult.originalSize * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            )}

            <button
              onClick={handleCompress}
              disabled={compressing || !doc.id}
              className="btn-primary w-full justify-center disabled:opacity-50"
            >
              {compressing ? (
                <>
                  <span className="spinner w-4 h-4" />
                  Compressing…
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Compress PDF
                </>
              )}
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
