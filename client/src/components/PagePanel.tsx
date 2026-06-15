import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { RotateCw, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useEditorStore } from '../store/editorStore';
import { generateThumbnail } from '../utils/pdfUtils';
import { rotatePage, deletePage } from '../utils/exportUtils';
import type { PDFDocumentProxy } from '../utils/pdfUtils';

interface PagePanelProps {
  pdfDoc: PDFDocumentProxy;
}

const DND_TYPE = 'THUMBNAIL';

interface ThumbnailCardProps {
  pageNum: number;
  thumbnail: string;
  isSelected: boolean;
  onSelect: () => void;
  onReorder: (from: number, to: number) => void;
  onRotate: (pageNum: number) => void;
  onDelete: (pageNum: number) => void;
}

function ThumbnailCard({
  pageNum,
  thumbnail,
  isSelected,
  onSelect,
  onReorder,
  onRotate,
  onDelete,
}: ThumbnailCardProps) {
  const [hovered, setHovered] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag] = useDrag({
    type: DND_TYPE,
    item: { pageNum },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });

  const [{ isOver }, drop] = useDrop({
    accept: DND_TYPE,
    drop: (item: { pageNum: number }) => {
      if (item.pageNum !== pageNum) {
        onReorder(item.pageNum, pageNum);
      }
    },
    collect: (monitor) => ({ isOver: monitor.isOver() }),
  });

  drag(drop(ref));

  return (
    <div
      ref={ref}
      className={`thumbnail-card group ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging-thumbnail' : ''} ${isOver ? 'ring-1 ring-indigo-500' : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onSelect}
    >
      {/* Thumbnail image */}
      <div className={`thumbnail-img rounded overflow-hidden ${isSelected ? 'ring-2 ring-indigo-500' : 'ring-1 ring-slate-700'}`}>
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={`Page ${pageNum}`}
            className="w-full object-contain bg-white"
            draggable={false}
          />
        ) : (
          <div className="w-full h-24 skeleton" />
        )}
      </div>

      {/* Page number */}
      <div className="flex items-center justify-between mt-1.5">
        <span className={`text-xs ${isSelected ? 'text-indigo-400 font-semibold' : 'text-slate-500'}`}>
          {pageNum}
        </span>

        {/* Hover actions */}
        {hovered && (
          <div className="flex gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); onRotate(pageNum); }}
              title="Rotate"
              className="p-0.5 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-700 transition-colors"
            >
              <RotateCw className="w-3 h-3" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(pageNum); }}
              title="Delete page"
              className="p-0.5 rounded text-slate-500 hover:text-red-400 hover:bg-slate-700 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PagePanel({ pdfDoc }: PagePanelProps) {
  const { document: doc, setCurrentPage, setDocument } = useEditorStore();
  const [thumbnails, setThumbnails] = useState<Map<number, string>>(new Map());
  const generatingRef = useRef<Set<number>>(new Set());

  // ── Generate thumbnails progressively ─────────────────────────────────────────
  useEffect(() => {
    if (!pdfDoc) return;

    const generate = async (pageNum: number) => {
      if (generatingRef.current.has(pageNum)) return;
      generatingRef.current.add(pageNum);
      try {
        const dataUrl = await generateThumbnail(pdfDoc, pageNum, 120);
        setThumbnails((prev) => new Map(prev).set(pageNum, dataUrl));
      } finally {
        generatingRef.current.delete(pageNum);
      }
    };

    // Generate all pages (sequentially to avoid overloading)
    const generateAll = async () => {
      for (let i = 1; i <= pdfDoc.numPages; i++) {
        await generate(i);
      }
    };

    generateAll();
  }, [pdfDoc]);

  const handleReorder = useCallback(
    (from: number, to: number) => {
      const pages = [...doc.pages];
      const [moved] = pages.splice(from - 1, 1);
      pages.splice(to - 1, 0, moved);
      // Re-index
      const reindexed = pages.map((p, i) => ({ ...p, index: i + 1 }));
      setDocument({ pages: reindexed });
    },
    [doc.pages, setDocument]
  );

  const handleRotate = useCallback(async (pageNum: number) => {
    if (!doc.fileBytes) { toast.error('No PDF loaded'); return; }
    try {
      const result = await rotatePage(doc.fileBytes, pageNum - 1, 90);
      setDocument({ fileBytes: result.buffer as ArrayBuffer });
      // Refresh thumbnail
      setThumbnails((prev) => { const next = new Map(prev); next.delete(pageNum); return next; });
      toast.success(`Page ${pageNum} rotated`);
    } catch { toast.error('Rotate failed'); }
  }, [doc.fileBytes, setDocument]);

  const handleDelete = useCallback(async (pageNum: number) => {
    if (!doc.fileBytes) { toast.error('No PDF loaded'); return; }
    if (doc.totalPages <= 1) { toast.error('Cannot delete the only page'); return; }
    try {
      const result = await deletePage(doc.fileBytes, pageNum - 1);
      const newPages = doc.pages.filter((_, i) => i !== pageNum - 1).map((p, i) => ({ ...p, index: i + 1 }));
      setDocument({
        fileBytes: result.buffer as ArrayBuffer,
        pages: newPages,
        totalPages: newPages.length,
        currentPage: Math.min(doc.currentPage, newPages.length),
      });
      setThumbnails((prev) => { const next = new Map(prev); next.delete(pageNum); return next; });
      toast.success(`Page ${pageNum} deleted`);
    } catch { toast.error('Delete failed'); }
  }, [doc.fileBytes, doc.pages, doc.totalPages, doc.currentPage, setDocument]);

  const pageCount = pdfDoc.numPages;

  return (
    <aside className="w-36 bg-slate-900 border-r border-slate-700/60 flex flex-col flex-shrink-0 overflow-hidden animate-slide-in-left">
      <div className="px-2 py-2 border-b border-slate-700/60">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pages</p>
      </div>

      <div className="flex-1 overflow-y-auto py-2 px-1 space-y-0.5">
        {Array.from({ length: pageCount }, (_, i) => i + 1).map((pageNum) => (
          <ThumbnailCard
            key={pageNum}
            pageNum={pageNum}
            thumbnail={thumbnails.get(pageNum) || ''}
            isSelected={pageNum === doc.currentPage}
            onSelect={() => setCurrentPage(pageNum)}
            onReorder={handleReorder}
            onRotate={handleRotate}
            onDelete={handleDelete}
          />
        ))}
      </div>

      <div className="px-2 py-1.5 border-t border-slate-700/60">
        <p className="text-xs text-slate-600 text-center">{pageCount} pages</p>
      </div>
    </aside>
  );
}
