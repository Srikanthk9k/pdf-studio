import React, { useState, useRef } from 'react';
import {
  MousePointer2, Type, Highlighter, Underline, Strikethrough, PenLine,
  Square, Circle, ArrowRight, Minus, Eraser, StickyNote, Image, FileText,
  CheckSquare, Radio, List, PenTool, FileOutput, Shield, ScanText,
  Trash2, RotateCw, FilePlus, Scissors, Merge, LayoutGrid,
  ChevronDown, ChevronRight as ChevronRightIcon, Hand, EyeOff,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useEditorStore } from '../store/editorStore';
import { deletePage, rotatePage, extractPages, insertBlankPage } from '../utils/exportUtils';
import type { ToolType } from '../types';

type ActiveModal = 'convert' | 'ocr' | 'security' | 'share' | null;

interface LeftSidebarProps {
  onOpenModal: (modal: ActiveModal) => void;
}

interface ToolItem { id: ToolType; label: string; icon: React.ReactNode; }
interface ToolGroup { id: string; label: string; icon: React.ReactNode; tools: ToolItem[]; }

const toolGroups: ToolGroup[] = [
  {
    id: 'view', label: 'View', icon: <Hand className="w-4 h-4" />,
    tools: [
      { id: 'select', label: 'Select', icon: <MousePointer2 className="w-4 h-4" /> },
      { id: 'none', label: 'Pan', icon: <Hand className="w-4 h-4" /> },
    ],
  },
  {
    id: 'annotate', label: 'Annotate', icon: <PenLine className="w-4 h-4" />,
    tools: [
      { id: 'highlight', label: 'Highlight', icon: <Highlighter className="w-4 h-4" /> },
      { id: 'underline', label: 'Underline', icon: <Underline className="w-4 h-4" /> },
      { id: 'strikethrough', label: 'Strikethrough', icon: <Strikethrough className="w-4 h-4" /> },
      { id: 'pen', label: 'Pen / Draw', icon: <PenLine className="w-4 h-4" /> },
      { id: 'rectangle', label: 'Rectangle', icon: <Square className="w-4 h-4" /> },
      { id: 'circle', label: 'Circle', icon: <Circle className="w-4 h-4" /> },
      { id: 'arrow', label: 'Arrow', icon: <ArrowRight className="w-4 h-4" /> },
      { id: 'line', label: 'Line', icon: <Minus className="w-4 h-4" /> },
      { id: 'eraser', label: 'Eraser', icon: <Eraser className="w-4 h-4" /> },
      { id: 'sticky-note', label: 'Sticky Note', icon: <StickyNote className="w-4 h-4" /> },
      { id: 'redact', label: 'Redact', icon: <EyeOff className="w-4 h-4" /> },
    ],
  },
  {
    id: 'edit', label: 'Edit', icon: <Type className="w-4 h-4" />,
    tools: [
      { id: 'text', label: 'Text', icon: <Type className="w-4 h-4" /> },
      { id: 'image', label: 'Insert Image', icon: <Image className="w-4 h-4" /> },
    ],
  },
  {
    id: 'form', label: 'Form', icon: <FileText className="w-4 h-4" />,
    tools: [
      { id: 'form-text', label: 'Text Field', icon: <FileText className="w-4 h-4" /> },
      { id: 'form-checkbox', label: 'Checkbox', icon: <CheckSquare className="w-4 h-4" /> },
      { id: 'form-radio', label: 'Radio', icon: <Radio className="w-4 h-4" /> },
      { id: 'form-dropdown', label: 'Dropdown', icon: <List className="w-4 h-4" /> },
      { id: 'form-signature', label: 'Signature Field', icon: <PenTool className="w-4 h-4" /> },
    ],
  },
  {
    id: 'sign', label: 'Sign', icon: <PenTool className="w-4 h-4" />,
    tools: [
      { id: 'signature', label: 'Add Signature', icon: <PenTool className="w-4 h-4" /> },
    ],
  },
];

export default function LeftSidebar({ onOpenModal }: LeftSidebarProps) {
  const { activeTool, setActiveTool, updateSettings, settings, document: doc, setDocument } = useEditorStore();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['view', 'annotate']));
  const mergeInputRef = useRef<HTMLInputElement>(null);

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleToolSelect = (tool: ToolType) => setActiveTool(tool);

  // ── Page actions using client-side pdf-lib ────────────────────────────────────
  const requirePDF = (): ArrayBuffer | null => {
    if (!doc.fileBytes) { toast.error('No PDF loaded'); return null; }
    return doc.fileBytes;
  };

  const handleInsertBlank = async () => {
    const bytes = requirePDF(); if (!bytes) return;
    try {
      const result = await insertBlankPage(bytes, doc.currentPage - 1);
      const newBytes = result.buffer as ArrayBuffer;
      setDocument({ fileBytes: newBytes });
      toast.success('Blank page inserted');
    } catch { toast.error('Failed to insert page'); }
  };

  const handleDeletePage = async () => {
    const bytes = requirePDF(); if (!bytes) return;
    if (doc.totalPages <= 1) { toast.error('Cannot delete the only page'); return; }
    try {
      const result = await deletePage(bytes, doc.currentPage - 1);
      const newBytes = result.buffer as ArrayBuffer;
      const newPages = doc.pages.filter((_, i) => i !== doc.currentPage - 1).map((p, i) => ({ ...p, index: i + 1 }));
      setDocument({
        fileBytes: newBytes,
        pages: newPages,
        totalPages: newPages.length,
        currentPage: Math.min(doc.currentPage, newPages.length),
      });
      toast.success('Page deleted');
    } catch { toast.error('Failed to delete page'); }
  };

  const handleRotate = async () => {
    const bytes = requirePDF(); if (!bytes) return;
    try {
      const result = await rotatePage(bytes, doc.currentPage - 1, 90);
      const newBytes = result.buffer as ArrayBuffer;
      setDocument({ fileBytes: newBytes });
      toast.success('Page rotated 90°');
    } catch { toast.error('Failed to rotate page'); }
  };

  const handleExtract = async () => {
    const bytes = requirePDF(); if (!bytes) return;
    try {
      const result = await extractPages(bytes, [doc.currentPage - 1]);
      const blob = new Blob([result.buffer as ArrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `page-${doc.currentPage}.pdf`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast.success(`Page ${doc.currentPage} extracted`);
    } catch { toast.error('Failed to extract page'); }
  };

  const handleMerge = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const bytes = requirePDF(); if (!bytes) return;
    try {
      toast.loading('Merging PDFs…', { id: 'merge' });
      const { mergePDFs } = await import('../utils/exportUtils');
      const buffers = await Promise.all(files.map(f => f.arrayBuffer()));
      const merged = await mergePDFs([bytes, ...buffers]);
      const newBytes = merged.buffer as ArrayBuffer;
      setDocument({ fileBytes: newBytes });
      toast.success('PDFs merged!', { id: 'merge' });
      // Reload page count
      const { loadPDF } = await import('../utils/pdfUtils');
      const pdf = await loadPDF(merged.buffer.slice(0) as ArrayBuffer);
      const pages = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const p = await pdf.getPage(i);
        const vp = p.getViewport({ scale: 1 });
        pages.push({ index: i, rotation: 0, width: vp.width, height: vp.height });
      }
      setDocument({ pages, totalPages: pdf.numPages });
    } catch { toast.error('Merge failed', { id: 'merge' }); }
    if (mergeInputRef.current) mergeInputRef.current.value = '';
  };

  return (
    <aside className="flex flex-col w-52 bg-slate-900 border-r border-slate-700/60 overflow-y-auto flex-shrink-0">
      {/* Hidden file input for merge */}
      <input ref={mergeInputRef} type="file" accept=".pdf" multiple className="hidden" onChange={handleMerge} />

      <div className="py-2">
        {/* Tool groups */}
        {toolGroups.map((group) => {
          const isExpanded = expandedGroups.has(group.id);
          return (
            <div key={group.id}>
              <button
                onClick={() => toggleGroup(group.id)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 transition-colors"
              >
                <span className="text-slate-600">{group.icon}</span>
                <span>{group.label}</span>
                <span className="ml-auto">
                  {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRightIcon className="w-3 h-3" />}
                </span>
              </button>
              {isExpanded && (
                <div className="pb-1">
                  {group.tools.map((tool) => {
                    const isActive = activeTool === tool.id;
                    return (
                      <button
                        key={tool.id}
                        onClick={() => handleToolSelect(tool.id)}
                        title={tool.label}
                        className={`w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-all duration-150 ${
                          isActive
                            ? 'bg-indigo-500/20 text-indigo-300 border-r-2 border-indigo-500'
                            : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
                        }`}
                      >
                        <span className={isActive ? 'text-indigo-400' : 'text-slate-500'}>{tool.icon}</span>
                        <span>{tool.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        <div className="h-px bg-slate-700/60 my-2 mx-3" />
        <div className="panel-section-header">Pages &amp; Tools</div>

        {/* Thumbnail toggle */}
        <button
          onClick={() => updateSettings({ showThumbnails: !settings.showThumbnails })}
          title="Toggle Thumbnails"
          className={`w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-all duration-150 ${
            settings.showThumbnails ? 'text-indigo-300 bg-indigo-500/10' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
          }`}
        >
          <span className="text-slate-500"><LayoutGrid className="w-4 h-4" /></span>
          <span>Thumbnails</span>
        </button>

        <button onClick={handleInsertBlank} title="Insert Blank Page after current" className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-all duration-150">
          <span className="text-slate-500"><FilePlus className="w-4 h-4" /></span><span>Insert Blank Page</span>
        </button>
        <button onClick={handleDeletePage} title="Delete current page" className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-400 hover:text-red-300 hover:bg-slate-800 transition-all duration-150">
          <span className="text-slate-500"><Trash2 className="w-4 h-4" /></span><span>Delete Page</span>
        </button>
        <button onClick={handleRotate} title="Rotate current page 90°" className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-all duration-150">
          <span className="text-slate-500"><RotateCw className="w-4 h-4" /></span><span>Rotate Page</span>
        </button>
        <button onClick={handleExtract} title="Extract current page as new PDF" className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-all duration-150">
          <span className="text-slate-500"><Scissors className="w-4 h-4" /></span><span>Extract Page</span>
        </button>
        <button onClick={() => mergeInputRef.current?.click()} title="Merge with other PDFs" className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-all duration-150">
          <span className="text-slate-500"><Merge className="w-4 h-4" /></span><span>Merge PDFs</span>
        </button>

        <div className="h-px bg-slate-700/60 my-2 mx-3" />

        <button onClick={() => onOpenModal('ocr')} title="OCR / Text Recognition" className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-all duration-150">
          <span className="text-slate-500"><ScanText className="w-4 h-4" /></span><span>OCR / Text</span>
        </button>
        <button onClick={() => onOpenModal('convert')} title="Convert PDF" className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-all duration-150">
          <span className="text-slate-500"><FileOutput className="w-4 h-4" /></span><span>Convert PDF</span>
        </button>
        <button onClick={() => onOpenModal('security')} title="Security &amp; Compress" className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-all duration-150">
          <span className="text-slate-500"><Shield className="w-4 h-4" /></span><span>Security</span>
        </button>
      </div>
    </aside>
  );
}
