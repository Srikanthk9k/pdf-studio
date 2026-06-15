import { useCallback } from 'react';
import { fabric } from 'fabric';
import { useEditorStore, selectAnnotationsForPage } from '../store/editorStore';
import { serializeCanvas, deserializeCanvas, generateId } from '../utils/fabricUtils';
import type { Annotation, AnnotationType } from '../types';

interface UseAnnotationsReturn {
  syncCanvasToStore: (canvas: fabric.Canvas, pageIndex: number) => void;
  loadAnnotationsToCanvas: (canvas: fabric.Canvas, pageIndex: number) => Promise<void>;
  exportAnnotationsAsJSON: () => string;
  importAnnotationsFromJSON: (json: string) => void;
  addAnnotationFromCanvas: (
    canvas: fabric.Canvas,
    pageIndex: number,
    type: AnnotationType
  ) => void;
}

export function useAnnotations(): UseAnnotationsReturn {
  const store = useEditorStore();

  // ── Sync canvas objects to the store ──────────────────────────────────────────
  const syncCanvasToStore = useCallback(
    (canvas: fabric.Canvas, pageIndex: number) => {
      const json = serializeCanvas(canvas);
      const existingAnnotations = selectAnnotationsForPage(pageIndex)(store);

      // We use a single "canvas state" annotation per page to store Fabric.js JSON
      const canvasAnnotation: Annotation | undefined = existingAnnotations.find(
        (a) => a.type === 'drawing' && (a.metadata?.isCanvasState as boolean)
      );

      if (canvasAnnotation) {
        store.updateAnnotation(canvasAnnotation.id, {
          fabricObjectJson: json,
          updatedAt: new Date().toISOString(),
        });
      } else {
        const annotation: Annotation = {
          id: generateId(),
          type: 'drawing',
          pageIndex,
          fabricObjectJson: json,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          metadata: { isCanvasState: true },
        };
        store.addAnnotation(annotation);
      }
    },
    [store]
  );

  // ── Load stored annotations back into canvas ───────────────────────────────────
  const loadAnnotationsToCanvas = useCallback(
    async (canvas: fabric.Canvas, pageIndex: number) => {
      const existingAnnotations = selectAnnotationsForPage(pageIndex)(store);
      const canvasAnnotation = existingAnnotations.find(
        (a) => a.type === 'drawing' && (a.metadata?.isCanvasState as boolean)
      );

      if (canvasAnnotation) {
        try {
          await deserializeCanvas(canvas, canvasAnnotation.fabricObjectJson);
        } catch {
          // If deserialization fails, just clear the canvas
          canvas.clear();
          canvas.renderAll();
        }
      }
    },
    [store]
  );

  // ── Add a specific fabric object as an annotation ─────────────────────────────
  const addAnnotationFromCanvas = useCallback(
    (canvas: fabric.Canvas, pageIndex: number, type: AnnotationType) => {
      const json = serializeCanvas(canvas);
      const annotation: Annotation = {
        id: generateId(),
        type,
        pageIndex,
        fabricObjectJson: json,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      store.addAnnotation(annotation);
    },
    [store]
  );

  // ── Export all annotations as JSON ────────────────────────────────────────────
  const exportAnnotationsAsJSON = useCallback((): string => {
    return JSON.stringify(store.annotations, null, 2);
  }, [store.annotations]);

  // ── Import annotations from JSON string ───────────────────────────────────────
  const importAnnotationsFromJSON = useCallback(
    (json: string) => {
      try {
        const annotations: Annotation[] = JSON.parse(json);
        if (!Array.isArray(annotations)) {
          throw new Error('Invalid annotations format');
        }
        // Clear all existing annotations and replace with imported
        annotations.forEach((annotation) => {
          const existing = store.annotations.find((a) => a.id === annotation.id);
          if (existing) {
            store.updateAnnotation(annotation.id, annotation);
          } else {
            store.addAnnotation(annotation);
          }
        });
      } catch (e) {
        console.error('Failed to import annotations:', e);
      }
    },
    [store]
  );

  return {
    syncCanvasToStore,
    loadAnnotationsToCanvas,
    exportAnnotationsAsJSON,
    importAnnotationsFromJSON,
    addAnnotationFromCanvas,
  };
}
