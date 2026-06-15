import React, { useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import {
  Trash2,
  BringToFront,
  SendToBack,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Underline,
  ChevronLeft,
} from 'lucide-react';
import { useEditorStore } from '../store/editorStore';

const FONT_FAMILIES = [
  'Inter',
  'Arial',
  'Times New Roman',
  'Courier New',
  'Georgia',
  'Dancing Script',
];

const PRESET_COLORS = [
  '#6366f1', // indigo
  '#ef4444', // red
  '#22c55e', // green
  '#f59e0b', // amber
  '#3b82f6', // blue
  '#ec4899', // pink
  '#000000', // black
  '#ffffff', // white
];

export default function PropertiesPanel() {
  const {
    selectedElement,
    properties,
    updateProperties,
    removeAnnotation,
    settings,
    updateSettings,
  } = useEditorStore();

  const [recentColors, setRecentColors] = useState<string[]>(PRESET_COLORS.slice(0, 6));

  const addRecentColor = useCallback((color: string) => {
    setRecentColors((prev) => {
      const filtered = prev.filter((c) => c !== color);
      return [color, ...filtered].slice(0, 6);
    });
  }, []);

  const handleColorChange = (color: string) => {
    updateProperties({ color });
    addRecentColor(color);
  };

  const handleFillChange = (color: string) => {
    updateProperties({ fillColor: color });
  };

  const handleDeleteSelected = () => {
    if (selectedElement) {
      removeAnnotation(selectedElement.id);
      toast.success('Element deleted');
    }
  };

  return (
    <aside className="w-60 bg-slate-900 border-l border-slate-700/60 flex flex-col flex-shrink-0 overflow-hidden animate-slide-in-right">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/60">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Properties</h3>
        <button
          onClick={() => updateSettings({ showProperties: false })}
          title="Close panel"
          className="p-1 rounded text-slate-600 hover:text-slate-300 hover:bg-slate-800 transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* ── Text Section ────────────────────────────────────────────────────── */}
        <div className="p-3 border-b border-slate-800">
          <p className="panel-section-header px-0 mb-2">Text</p>

          {/* Font Family */}
          <div className="mb-3">
            <label className="block text-xs text-slate-500 mb-1">Font Family</label>
            <select
              value={properties.fontFamily}
              onChange={(e) => updateProperties({ fontFamily: e.target.value })}
              className="studio-input text-xs py-1.5"
            >
              {FONT_FAMILIES.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          {/* Font Size + Alignment */}
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1">Size</label>
              <input
                type="number"
                min={6}
                max={200}
                value={properties.fontSize}
                onChange={(e) => updateProperties({ fontSize: parseInt(e.target.value) || 16 })}
                className="studio-input text-xs py-1.5"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Align</label>
              <div className="flex gap-0.5">
                {[
                  { v: 'left', icon: <AlignLeft className="w-3.5 h-3.5" /> },
                  { v: 'center', icon: <AlignCenter className="w-3.5 h-3.5" /> },
                  { v: 'right', icon: <AlignRight className="w-3.5 h-3.5" /> },
                ].map(({ v, icon }) => (
                  <button
                    key={v}
                    onClick={() => updateProperties({ textAlign: v as 'left' | 'center' | 'right' })}
                    className={`p-1.5 rounded transition-colors ${
                      properties.textAlign === v
                        ? 'bg-indigo-500/20 text-indigo-400'
                        : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Bold / Italic / Underline */}
          <div className="flex gap-1 mb-3">
            {[
              { label: 'Bold', icon: <Bold className="w-3.5 h-3.5" /> },
              { label: 'Italic', icon: <Italic className="w-3.5 h-3.5" /> },
              { label: 'Underline', icon: <Underline className="w-3.5 h-3.5" /> },
            ].map(({ label, icon }) => (
              <button
                key={label}
                title={label}
                className="flex-1 flex items-center justify-center p-2 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-800 border border-slate-700 transition-colors text-xs"
              >
                {icon}
              </button>
            ))}
          </div>
        </div>

        {/* ── Color Section ────────────────────────────────────────────────────── */}
        <div className="p-3 border-b border-slate-800">
          <p className="panel-section-header px-0 mb-2">Color</p>

          {/* Text Color */}
          <div className="mb-3">
            <label className="block text-xs text-slate-500 mb-1.5">Text / Stroke</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={properties.color}
                onChange={(e) => handleColorChange(e.target.value)}
                className="flex-shrink-0"
              />
              <input
                type="text"
                value={properties.color}
                onChange={(e) => handleColorChange(e.target.value)}
                className="studio-input text-xs py-1.5 font-mono"
                placeholder="#6366f1"
              />
            </div>
          </div>

          {/* Fill Color */}
          <div className="mb-3">
            <label className="block text-xs text-slate-500 mb-1.5">Fill</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={properties.fillColor.startsWith('rgba') ? '#6366f1' : properties.fillColor}
                onChange={(e) => handleFillChange(e.target.value)}
                className="flex-shrink-0"
              />
              <input
                type="text"
                value={properties.fillColor}
                onChange={(e) => handleFillChange(e.target.value)}
                className="studio-input text-xs py-1.5 font-mono"
                placeholder="rgba(99,102,241,0.1)"
              />
            </div>
          </div>

          {/* Preset colors */}
          <div className="flex flex-wrap gap-1.5">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => handleColorChange(color)}
                title={color}
                className={`color-swatch ${properties.color === color ? 'active' : ''}`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>

          {/* Recent colors */}
          {recentColors.length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-slate-600 mb-1">Recent</p>
              <div className="flex flex-wrap gap-1.5">
                {recentColors.map((color) => (
                  <button
                    key={color}
                    onClick={() => handleColorChange(color)}
                    title={color}
                    className="color-swatch"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Stroke & Opacity Section ──────────────────────────────────────────── */}
        <div className="p-3 border-b border-slate-800">
          <p className="panel-section-header px-0 mb-2">Style</p>

          {/* Opacity */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-slate-500">Opacity</label>
              <span className="text-xs text-slate-400 font-mono">
                {Math.round(properties.opacity * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={properties.opacity}
              onChange={(e) => updateProperties({ opacity: parseFloat(e.target.value) })}
              className="w-full"
            />
          </div>

          {/* Stroke Width */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-slate-500">Stroke Width</label>
              <span className="text-xs text-slate-400 font-mono">{properties.strokeWidth}px</span>
            </div>
            <input
              type="range"
              min={1}
              max={20}
              step={1}
              value={properties.strokeWidth}
              onChange={(e) => updateProperties({ strokeWidth: parseInt(e.target.value) })}
              className="w-full"
            />
          </div>
        </div>

        {/* ── Position Section ──────────────────────────────────────────────────── */}
        {selectedElement && (
          <div className="p-3 border-b border-slate-800">
            <p className="panel-section-header px-0 mb-2">Position</p>
            <div className="grid grid-cols-2 gap-2">
              {['X', 'Y', 'W', 'H'].map((label) => (
                <div key={label}>
                  <label className="block text-xs text-slate-500 mb-1">{label}</label>
                  <input
                    type="number"
                    placeholder="0"
                    className="studio-input text-xs py-1.5"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Element Actions ───────────────────────────────────────────────────── */}
        {selectedElement && (
          <div className="p-3">
            <p className="panel-section-header px-0 mb-2">Element</p>
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <button className="btn-secondary flex-1 justify-center py-1.5 text-xs gap-1.5">
                  <BringToFront className="w-3.5 h-3.5" />
                  Bring Fwd
                </button>
                <button className="btn-secondary flex-1 justify-center py-1.5 text-xs gap-1.5">
                  <SendToBack className="w-3.5 h-3.5" />
                  Send Back
                </button>
              </div>
              <button
                onClick={handleDeleteSelected}
                className="btn-danger justify-center py-1.5 text-xs gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Element
              </button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!selectedElement && (
          <div className="p-4 text-center">
            <p className="text-xs text-slate-600 leading-relaxed">
              Select an element on the canvas to see and edit its properties.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
