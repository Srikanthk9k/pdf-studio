import React, { useEffect, useRef, useState } from 'react';
import { fabric } from 'fabric';
import { toast } from 'react-hot-toast';
import { X, Trash2, Check } from 'lucide-react';
import { useEditorStore } from '../store/editorStore';
import { generateId } from '../utils/fabricUtils';

interface SignatureModalProps {
  onClose: () => void;
  onSave?: (dataUrl: string) => void;
}

type Tab = 'draw' | 'type' | 'upload';

export default function SignatureModal({ onClose, onSave }: SignatureModalProps) {
  const { addSignature } = useEditorStore();
  const [activeTab, setActiveTab] = useState<Tab>('draw');

  // ── Draw tab ─────────────────────────────────────────────────────────────────
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const [drawColor, setDrawColor] = useState('#000000');
  const [drawWidth, setDrawWidth] = useState(3);

  useEffect(() => {
    if (activeTab !== 'draw' || !drawCanvasRef.current) return;

    const canvas = new fabric.Canvas(drawCanvasRef.current, {
      width: 460,
      height: 200,
      backgroundColor: '#ffffff',
      isDrawingMode: true,
    });

    canvas.freeDrawingBrush.color = drawColor;
    canvas.freeDrawingBrush.width = drawWidth;
    fabricCanvasRef.current = canvas;

    return () => {
      canvas.dispose();
      fabricCanvasRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !canvas.freeDrawingBrush) return;
    canvas.freeDrawingBrush.color = drawColor;
    canvas.freeDrawingBrush.width = drawWidth;
  }, [drawColor, drawWidth]);

  const handleClearDraw = () => {
    fabricCanvasRef.current?.clear();
    fabricCanvasRef.current?.setBackgroundColor('#ffffff', () =>
      fabricCanvasRef.current?.renderAll()
    );
  };

  // ── Type tab ─────────────────────────────────────────────────────────────────
  const [typedName, setTypedName] = useState('');
  const [typeFontSize, setTypeFontSize] = useState(48);
  const [typeColor, setTypeColor] = useState('#1e293b');

  // ── Upload tab ───────────────────────────────────────────────────────────────
  const [uploadPreview, setUploadPreview] = useState<string>('');
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setUploadPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  // ── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = () => {
    let dataUrl = '';

    if (activeTab === 'draw') {
      if (!fabricCanvasRef.current) return;
      dataUrl = fabricCanvasRef.current.toDataURL({ format: 'png', multiplier: 2 });
    } else if (activeTab === 'type') {
      if (!typedName.trim()) {
        toast.error('Please type a name');
        return;
      }
      // Render typed signature to canvas
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = 400;
      tempCanvas.height = 120;
      const ctx = tempCanvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 400, 120);
      ctx.font = `${typeFontSize}px 'Dancing Script', cursive`;
      ctx.fillStyle = typeColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(typedName, 200, 60);
      dataUrl = tempCanvas.toDataURL('image/png');
    } else if (activeTab === 'upload') {
      if (!uploadPreview) {
        toast.error('Please select an image');
        return;
      }
      dataUrl = uploadPreview;
    }

    if (!dataUrl) return;

    const sig = {
      id: generateId(),
      name: typedName || `Signature ${Date.now()}`,
      dataUrl,
      createdAt: new Date().toISOString(),
    };

    addSignature(sig);
    onSave?.(dataUrl);
    toast.success('Signature saved!');
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-base font-semibold text-slate-100">Add Signature</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-3 border-b border-slate-700">
          {(['draw', 'type', 'upload'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`tab-button capitalize ${activeTab === tab ? 'active' : ''}`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-4">
          {/* ── Draw Tab ────────────────────────────────────────────────────── */}
          {activeTab === 'draw' && (
            <div>
              <div className="signature-pad-container mb-3 overflow-hidden" style={{ height: 200 }}>
                <canvas ref={drawCanvasRef} />
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-400">Color</label>
                  <input
                    type="color"
                    value={drawColor}
                    onChange={(e) => setDrawColor(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2 flex-1">
                  <label className="text-xs text-slate-400 whitespace-nowrap">Width {drawWidth}px</label>
                  <input
                    type="range"
                    min={1}
                    max={12}
                    value={drawWidth}
                    onChange={(e) => setDrawWidth(parseInt(e.target.value))}
                    className="flex-1"
                  />
                </div>
                <button
                  onClick={handleClearDraw}
                  className="btn-secondary py-1 px-2 gap-1 text-xs"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* ── Type Tab ────────────────────────────────────────────────────── */}
          {activeTab === 'type' && (
            <div>
              <input
                type="text"
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                placeholder="Type your name…"
                className="studio-input mb-3"
                autoFocus
              />
              {/* Preview */}
              <div
                className="w-full h-28 bg-white rounded-lg flex items-center justify-center mb-3 border border-slate-300"
                style={{
                  fontFamily: "'Dancing Script', cursive",
                  fontSize: typeFontSize,
                  color: typeColor,
                }}
              >
                {typedName || <span style={{ color: '#cbd5e1', fontSize: 16 }}>Your signature preview</span>}
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-400">Color</label>
                  <input
                    type="color"
                    value={typeColor}
                    onChange={(e) => setTypeColor(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2 flex-1">
                  <label className="text-xs text-slate-400 whitespace-nowrap">Size {typeFontSize}px</label>
                  <input
                    type="range"
                    min={24}
                    max={96}
                    value={typeFontSize}
                    onChange={(e) => setTypeFontSize(parseInt(e.target.value))}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Upload Tab ───────────────────────────────────────────────────── */}
          {activeTab === 'upload' && (
            <div>
              {uploadPreview ? (
                <div className="relative mb-3">
                  <img
                    src={uploadPreview}
                    alt="Signature preview"
                    className="w-full h-40 object-contain bg-white rounded-lg border border-slate-300"
                  />
                  <button
                    onClick={() => setUploadPreview('')}
                    className="absolute top-2 right-2 p-1 rounded-full bg-slate-800 text-slate-400 hover:text-red-400"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => uploadInputRef.current?.click()}
                  className="drop-zone w-full h-40 flex flex-col items-center justify-center gap-2 mb-3 cursor-pointer hover:border-indigo-500 hover:bg-indigo-500/5"
                >
                  <span className="text-slate-500 text-sm">Click to upload PNG or JPG</span>
                </button>
              )}
              <input
                ref={uploadInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                className="hidden"
                onChange={handleUpload}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t border-slate-700">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">
            Cancel
          </button>
          <button onClick={handleSave} className="btn-primary flex-1 justify-center">
            <Check className="w-4 h-4" />
            Save Signature
          </button>
        </div>
      </div>
    </div>
  );
}
