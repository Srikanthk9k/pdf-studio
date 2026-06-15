import React, { useEffect, useRef, useCallback } from 'react';
import { fabric } from 'fabric';
import { useEditorStore, selectAnnotationsForPage } from '../store/editorStore';
import {
  setToolMode,
  createTextObject,
  createHighlight,
  createRectangle,
  createCircle,
  createArrow,
  createStickyNote,
  createRedactionRect,
  createUnderline,
  createStrikethrough,
  createSignatureImage,
  createFormFieldPlaceholder,
  serializeCanvas,
  deserializeCanvas,
  generateId,
} from '../utils/fabricUtils';
import type { AnnotationType } from '../types';

interface AnnotationLayerProps {
  pageIndex: number;
  width: number;
  height: number;
  onRequestImageInsert?: () => void;
}

export default function AnnotationLayer({
  pageIndex,
  width,
  height,
}: AnnotationLayerProps) {
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const isDrawingRef = useRef(false);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const activeShapeRef = useRef<fabric.Object | null>(null);

  const store = useEditorStore();
  const annotations = useEditorStore(selectAnnotationsForPage(pageIndex));

  // ── Map tool to annotation type ───────────────────────────────────────────────
  const toolToAnnotationType = (tool: string): AnnotationType => {
    const map: Record<string, AnnotationType> = {
      text: 'text',
      highlight: 'highlight',
      underline: 'underline',
      strikethrough: 'strikethrough',
      pen: 'drawing',
      rectangle: 'rectangle',
      circle: 'circle',
      arrow: 'arrow',
      line: 'line',
      'sticky-note': 'sticky-note',
      redact: 'redaction',
      signature: 'signature',
      'form-text': 'form-field',
      'form-checkbox': 'form-field',
      'form-radio': 'form-field',
      'form-dropdown': 'form-field',
      'form-signature': 'form-field',
    };
    return (map[tool] as AnnotationType) || 'drawing';
  };

  // ── Sync canvas state to store ────────────────────────────────────────────────
  const syncToStore = useCallback(
    (canvas: fabric.Canvas) => {
      const json = serializeCanvas(canvas);
      const existing = annotations.find(
        (a) => a.type === 'drawing' && (a.metadata?.isCanvasState as boolean)
      );
      if (existing) {
        store.updateAnnotation(existing.id, {
          fabricObjectJson: json,
          updatedAt: new Date().toISOString(),
        });
      } else {
        store.addAnnotation({
          id: generateId(),
          type: 'drawing',
          pageIndex,
          fabricObjectJson: json,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          metadata: { isCanvasState: true },
        });
      }
    },
    [annotations, store, pageIndex]
  );

  // ── Initialize Fabric canvas ──────────────────────────────────────────────────
  useEffect(() => {
    if (!canvasElRef.current) return;

    const canvas = new fabric.Canvas(canvasElRef.current, {
      width,
      height,
      backgroundColor: 'transparent',
      selection: true,
      preserveObjectStacking: true,
    });

    fabricRef.current = canvas;

    // Load saved state
    const savedState = annotations.find(
      (a) => a.type === 'drawing' && (a.metadata?.isCanvasState as boolean)
    );
    if (savedState) {
      deserializeCanvas(canvas, savedState.fabricObjectJson).catch(() => {});
    }

    // Set initial tool mode
    setToolMode(canvas, store.activeTool);

    // ── Object selection sync ─────────────────────────────────────────────────
    canvas.on('selection:created', (e) => {
      const obj = e.selected?.[0];
      if (obj && (obj as fabric.Object & { annotationId?: string }).annotationId) {
        const ann = annotations.find(
          (a) => a.id === (obj as fabric.Object & { annotationId?: string }).annotationId
        );
        if (ann) store.setSelectedElement(ann);
      }
    });

    canvas.on('selection:cleared', () => {
      store.setSelectedElement(null);
    });

    // ── Modification sync ─────────────────────────────────────────────────────
    canvas.on('object:modified', () => syncToStore(canvas));
    canvas.on('object:added', () => syncToStore(canvas));
    canvas.on('object:removed', () => syncToStore(canvas));
    canvas.on('path:created', () => syncToStore(canvas));

    return () => {
      canvas.dispose();
      fabricRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageIndex, width, height]);

  // ── Update tool mode when activeTool changes ──────────────────────────────────
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    setToolMode(canvas, store.activeTool);

    // Clean up shape drawing listeners
    canvas.off('mouse:down');
    canvas.off('mouse:move');
    canvas.off('mouse:up');

    const tool = store.activeTool;
    const props = store.properties;

    if (
      ['highlight', 'underline', 'strikethrough', 'rectangle', 'circle', 'line', 'arrow', 'redact'].includes(tool)
    ) {
      // ── Shape drawing mode ──────────────────────────────────────────────────
      canvas.on('mouse:down', (opt) => {
        if (!opt.pointer) return;
        isDrawingRef.current = true;
        startPointRef.current = { x: opt.pointer.x, y: opt.pointer.y };

        let shape: fabric.Object | null = null;

        if (tool === 'rectangle') {
          shape = createRectangle(opt.pointer.x, opt.pointer.y, 1, 1, {
            fill: props.fillColor,
            stroke: props.color,
            strokeWidth: props.strokeWidth,
          });
        } else if (tool === 'highlight') {
          shape = createHighlight(opt.pointer.x, opt.pointer.y, 1, 20, props.color, props.opacity);
        } else if (tool === 'underline') {
          shape = createUnderline(opt.pointer.x, opt.pointer.y, 0, { stroke: props.color });
        } else if (tool === 'strikethrough') {
          shape = createStrikethrough(opt.pointer.x, opt.pointer.y, 0, { stroke: props.color });
        } else if (tool === 'circle') {
          shape = createCircle(opt.pointer.x, opt.pointer.y, 1, {
            fill: props.fillColor,
            stroke: props.color,
            strokeWidth: props.strokeWidth,
          });
        } else if (tool === 'redact') {
          shape = createRedactionRect(opt.pointer.x, opt.pointer.y, 0, 0);
        } else if (tool === 'line') {
          shape = new fabric.Line([opt.pointer.x, opt.pointer.y, opt.pointer.x, opt.pointer.y], {
            stroke: props.color,
            strokeWidth: props.strokeWidth,
            selectable: false,
          });
        }

        if (shape) {
          canvas.add(shape);
          activeShapeRef.current = shape;
        }
      });

      canvas.on('mouse:move', (opt) => {
        if (!isDrawingRef.current || !startPointRef.current || !opt.pointer) return;
        const shape = activeShapeRef.current;
        if (!shape) return;

        const { x: sx, y: sy } = startPointRef.current;
        const { x: ex, y: ey } = opt.pointer;
        const w = ex - sx;
        const h = ey - sy;

        if (tool === 'rectangle' || tool === 'highlight' || tool === 'redact') {
          (shape as fabric.Rect).set({
            left: w < 0 ? ex : sx,
            top: h < 0 ? ey : sy,
            width: Math.abs(w),
            height: Math.abs(h),
          });
        } else if (tool === 'circle') {
          const r = Math.max(1, Math.sqrt(w * w + h * h) / 2);
          (shape as fabric.Circle).set({ radius: r });
        } else if (tool === 'underline' || tool === 'strikethrough') {
          (shape as fabric.Line).set({ x2: ex, y2: sy });
        } else if (tool === 'line' || tool === 'arrow') {
          (shape as fabric.Line).set({ x2: ex, y2: ey });
        }

        shape.setCoords();
        canvas.renderAll();
      });

      canvas.on('mouse:up', () => {
        isDrawingRef.current = false;
        const shape = activeShapeRef.current;
        if (shape) {
          // For arrow tool: replace Line preview with proper Arrow group
          if (tool === 'arrow') {
            const line = shape as fabric.Line;
            const x1 = (line.x1 ?? 0) + (line.left ?? 0);
            const y1 = (line.y1 ?? 0) + (line.top ?? 0);
            const x2 = (line.x2 ?? 0) + (line.left ?? 0);
            const y2 = (line.y2 ?? 0) + (line.top ?? 0);
            canvas.remove(line);
            const arrow = createArrow([x1, y1, x2, y2], {
              stroke: props.color,
              strokeWidth: props.strokeWidth,
            });
            canvas.add(arrow);
            canvas.setActiveObject(arrow);
          } else {
            shape.set({ selectable: true, evented: true });
            shape.setCoords();
          }
          canvas.renderAll();
          syncToStore(canvas);
        }
        activeShapeRef.current = null;
        startPointRef.current = null;
        store.setActiveTool('select');
        setToolMode(canvas, 'select');
      });
    } else if (tool === 'text') {
      canvas.on('mouse:down', (opt) => {
        if (!opt.pointer) return;
        const text = createTextObject(opt.pointer.x, opt.pointer.y, 'Text', {
          fill: props.color,
          fontSize: props.fontSize,
          fontFamily: props.fontFamily,
          opacity: props.opacity,
        });
        canvas.add(text);
        canvas.setActiveObject(text);
        (text as fabric.IText).enterEditing();
        syncToStore(canvas);
        store.setActiveTool('select');
        setToolMode(canvas, 'select');
      });
    } else if (tool === 'sticky-note') {
      canvas.on('mouse:down', (opt) => {
        if (!opt.pointer) return;
        const note = createStickyNote(opt.pointer.x, opt.pointer.y);
        canvas.add(note);
        canvas.setActiveObject(note);
        syncToStore(canvas);
        store.setActiveTool('select');
        setToolMode(canvas, 'select');
      });
    } else if (tool === 'eraser') {
      canvas.on('mouse:down', () => {
        const active = canvas.getActiveObjects();
        if (active.length > 0) {
          active.forEach((obj) => canvas.remove(obj));
          canvas.discardActiveObject();
          syncToStore(canvas);
        } else {
          const objects = canvas.getObjects();
          const last = objects[objects.length - 1];
          if (last) {
            canvas.remove(last);
            syncToStore(canvas);
          }
        }
      });
    } else if (tool === 'signature' && store.signatures.length > 0) {
      const sig = store.signatures[0];
      canvas.on('mouse:down', (opt) => {
        if (!opt.pointer) return;
        createSignatureImage(opt.pointer.x, opt.pointer.y, sig.dataUrl).then((img) => {
          canvas.add(img);
          canvas.setActiveObject(img);
          syncToStore(canvas);
          store.setActiveTool('select');
          setToolMode(canvas, 'select');
        });
      });
    } else if (tool === 'image') {
      // Trigger file picker for image insertion
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/png,image/jpeg,image/gif,image/webp';
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          const dataUrl = ev.target?.result as string;
          fabric.Image.fromURL(dataUrl, (img) => {
            img.set({
              left: 60,
              top: 60,
              scaleX: Math.min(1, (width * 0.5) / (img.width || 1)),
              scaleY: Math.min(1, (width * 0.5) / (img.width || 1)),
              selectable: true,
              hasControls: true,
            });
            canvas.add(img);
            canvas.setActiveObject(img);
            canvas.renderAll();
            syncToStore(canvas);
          });
        };
        reader.readAsDataURL(file);
        store.setActiveTool('select');
        setToolMode(canvas, 'select');
      };
      input.click();
    } else if (tool === 'form-text' || tool === 'form-checkbox' || tool === 'form-radio' || tool === 'form-dropdown' || tool === 'form-signature') {
      const fieldType = tool.replace('form-', '') as 'text' | 'checkbox' | 'radio' | 'dropdown' | 'signature';
      canvas.on('mouse:down', (opt) => {
        if (!opt.pointer) return;
        const fieldW = fieldType === 'checkbox' || fieldType === 'radio' ? 24 : 200;
        const fieldH = fieldType === 'checkbox' || fieldType === 'radio' ? 24 : 36;
        const field = createFormFieldPlaceholder(
          opt.pointer.x,
          opt.pointer.y,
          fieldW,
          fieldH,
          'Field',
          fieldType
        );
        canvas.add(field);
        canvas.setActiveObject(field);
        syncToStore(canvas);
        store.addFormField({
          id: generateId(),
          fieldType,
          pageIndex,
          x: opt.pointer.x,
          y: opt.pointer.y,
          width: fieldW,
          height: fieldH,
          label: 'Field',
          value: '',
        });
        store.setActiveTool('select');
        setToolMode(canvas, 'select');
      });
    }

    // Update pen brush properties
    if (tool === 'pen' && canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.color = props.color;
      canvas.freeDrawingBrush.width = props.strokeWidth;
    }
  }, [store.activeTool, store.properties, store, pageIndex, syncToStore]);

  // ── Update brush when properties change ──────────────────────────────────────
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || !canvas.freeDrawingBrush) return;
    canvas.freeDrawingBrush.color = store.properties.color;
    canvas.freeDrawingBrush.width = store.properties.strokeWidth;
  }, [store.properties.color, store.properties.strokeWidth]);

  return (
    <canvas
      ref={canvasElRef}
      data-fabric-page={pageIndex}
      className="annotation-canvas"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width,
        height,
        pointerEvents: store.activeTool === 'none' ? 'none' : 'all',
      }}
    />
  );
}
