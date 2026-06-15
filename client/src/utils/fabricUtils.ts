import { fabric } from 'fabric';
import type { ToolType } from '../types';

// ─── Text object ──────────────────────────────────────────────────────────────
export function createTextObject(
  x: number,
  y: number,
  text: string = 'Text',
  options: Partial<fabric.ITextOptions> = {}
): fabric.IText {
  return new fabric.IText(text, {
    left: x,
    top: y,
    fontFamily: 'Inter, sans-serif',
    fontSize: 16,
    fill: '#6366f1',
    selectable: true,
    hasControls: true,
    padding: 4,
    ...options,
  });
}

// ─── Highlight rect ───────────────────────────────────────────────────────────
export function createHighlight(
  x: number,
  y: number,
  width: number,
  height: number,
  color: string = '#facc15',
  opacity: number = 0.35
): fabric.Rect {
  return new fabric.Rect({
    left: x,
    top: y,
    width,
    height,
    fill: color,
    opacity,
    selectable: true,
    hasControls: true,
    rx: 2,
    ry: 2,
    strokeWidth: 0,
  });
}

// ─── Rectangle ────────────────────────────────────────────────────────────────
export function createRectangle(
  x: number,
  y: number,
  width: number,
  height: number,
  options: Partial<fabric.IRectOptions> = {}
): fabric.Rect {
  return new fabric.Rect({
    left: x,
    top: y,
    width,
    height,
    fill: 'rgba(99,102,241,0.1)',
    stroke: '#6366f1',
    strokeWidth: 2,
    selectable: true,
    hasControls: true,
    rx: 4,
    ry: 4,
    ...options,
  });
}

// ─── Circle ───────────────────────────────────────────────────────────────────
export function createCircle(
  x: number,
  y: number,
  radius: number,
  options: Partial<fabric.ICircleOptions> = {}
): fabric.Circle {
  return new fabric.Circle({
    left: x,
    top: y,
    radius,
    fill: 'rgba(99,102,241,0.1)',
    stroke: '#6366f1',
    strokeWidth: 2,
    selectable: true,
    hasControls: true,
    ...options,
  });
}

// ─── Arrow ────────────────────────────────────────────────────────────────────
export function createArrow(
  points: number[],
  options: Partial<fabric.ILineOptions> = {}
): fabric.Group {
  const [x1, y1, x2, y2] = points;
  const line = new fabric.Line([x1, y1, x2, y2], {
    stroke: '#6366f1',
    strokeWidth: 2,
    selectable: false,
    ...options,
  });

  // Calculate arrowhead
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const arrowLen = 16;
  const arrowAngle = Math.PI / 6;

  const ax1 = x2 - arrowLen * Math.cos(angle - arrowAngle);
  const ay1 = y2 - arrowLen * Math.sin(angle - arrowAngle);
  const ax2 = x2 - arrowLen * Math.cos(angle + arrowAngle);
  const ay2 = y2 - arrowLen * Math.sin(angle + arrowAngle);

  const arrowHead = new fabric.Polygon(
    [
      { x: x2, y: y2 },
      { x: ax1, y: ay1 },
      { x: ax2, y: ay2 },
    ],
    {
      fill: (options.stroke as string) || '#6366f1',
      selectable: false,
    }
  );

  return new fabric.Group([line, arrowHead], {
    selectable: true,
    hasControls: true,
  });
}

// ─── Sticky note ──────────────────────────────────────────────────────────────
export function createStickyNote(
  x: number,
  y: number,
  text: string = 'Note...'
): fabric.Group {
  const bg = new fabric.Rect({
    width: 160,
    height: 120,
    fill: '#fef08a',
    stroke: '#eab308',
    strokeWidth: 1,
    rx: 4,
    ry: 4,
    shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.25)', blur: 8, offsetX: 2, offsetY: 2 }),
  });

  const textObj = new fabric.Textbox(text, {
    width: 140,
    left: 10,
    top: 10,
    fontSize: 13,
    fontFamily: 'Inter, sans-serif',
    fill: '#713f12',
    wrap: 'word',
  } as fabric.ITextboxOptions);

  return new fabric.Group([bg, textObj], {
    left: x,
    top: y,
    selectable: true,
    hasControls: true,
  });
}

// ─── Redaction rect ───────────────────────────────────────────────────────────
export function createRedactionRect(
  x: number,
  y: number,
  width: number,
  height: number
): fabric.Rect {
  return new fabric.Rect({
    left: x,
    top: y,
    width,
    height,
    fill: '#000000',
    stroke: '#000000',
    strokeWidth: 0,
    selectable: true,
    hasControls: true,
  });
}

// ─── Underline ────────────────────────────────────────────────────────────────
export function createUnderline(
  x: number,
  y: number,
  width: number,
  options: Partial<fabric.ILineOptions> = {}
): fabric.Line {
  return new fabric.Line([x, y, x + width, y], {
    stroke: '#3b82f6',
    strokeWidth: 2,
    selectable: true,
    hasControls: true,
    ...options,
  });
}

// ─── Strikethrough ───────────────────────────────────────────────────────────
export function createStrikethrough(
  x: number,
  y: number,
  width: number,
  options: Partial<fabric.ILineOptions> = {}
): fabric.Line {
  return new fabric.Line([x, y, x + width, y], {
    stroke: '#ef4444',
    strokeWidth: 2,
    selectable: true,
    hasControls: true,
    ...options,
  });
}

// ─── Signature image ──────────────────────────────────────────────────────────
export function createSignatureImage(
  x: number,
  y: number,
  dataUrl: string,
  maxWidth: number = 200
): Promise<fabric.Image> {
  return new Promise((resolve, reject) => {
    fabric.Image.fromURL(dataUrl, (img) => {
      if (!img) {
        reject(new Error('Failed to create image'));
        return;
      }
      const scaleX = maxWidth / (img.width || maxWidth);
      img.set({
        left: x,
        top: y,
        scaleX,
        scaleY: scaleX,
        selectable: true,
        hasControls: true,
      });
      resolve(img);
    });
  });
}

// ─── Form field placeholder ───────────────────────────────────────────────────
export function createFormFieldPlaceholder(
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  fieldType: string
): fabric.Group {
  const bg = new fabric.Rect({
    width,
    height,
    fill: 'rgba(99,102,241,0.08)',
    stroke: '#6366f1',
    strokeWidth: 1.5,
    strokeDashArray: [4, 4],
    rx: 4,
    ry: 4,
  });

  const labelText = new fabric.Text(`[${fieldType}] ${label}`, {
    left: 6,
    top: height / 2 - 8,
    fontSize: 11,
    fontFamily: 'Inter, sans-serif',
    fill: '#818cf8',
  });

  return new fabric.Group([bg, labelText], {
    left: x,
    top: y,
    selectable: true,
    hasControls: true,
    data: { fieldType, label },
  });
}

// ─── Set tool mode on canvas ──────────────────────────────────────────────────
export function setToolMode(canvas: fabric.Canvas, tool: ToolType): void {
  // Reset default state
  canvas.isDrawingMode = false;
  canvas.selection = true;
  canvas.defaultCursor = 'default';
  canvas.hoverCursor = 'move';

  canvas.getObjects().forEach((obj) => {
    obj.selectable = true;
    obj.evented = true;
  });

  switch (tool) {
    case 'select':
      canvas.defaultCursor = 'default';
      canvas.hoverCursor = 'move';
      break;
    case 'pen':
      canvas.isDrawingMode = true;
      canvas.defaultCursor = 'crosshair';
      if (canvas.freeDrawingBrush) {
        canvas.freeDrawingBrush.color = '#6366f1';
        canvas.freeDrawingBrush.width = 2;
      }
      break;
    case 'eraser':
      canvas.defaultCursor = 'cell';
      canvas.hoverCursor = 'cell';
      break;
    case 'text':
    case 'sticky-note':
    case 'signature':
    case 'image':
      canvas.defaultCursor = 'crosshair';
      canvas.selection = false;
      canvas.getObjects().forEach((obj) => {
        obj.selectable = false;
        obj.evented = false;
      });
      break;
    case 'highlight':
    case 'underline':
    case 'strikethrough':
    case 'rectangle':
    case 'circle':
    case 'arrow':
    case 'line':
    case 'redact':
    case 'form-text':
    case 'form-checkbox':
    case 'form-radio':
    case 'form-dropdown':
    case 'form-signature':
      canvas.defaultCursor = 'crosshair';
      canvas.selection = false;
      canvas.getObjects().forEach((obj) => {
        obj.selectable = false;
        obj.evented = false;
      });
      break;
    default:
      break;
  }
}

// ─── Serialize canvas ─────────────────────────────────────────────────────────
export function serializeCanvas(canvas: fabric.Canvas): string {
  return JSON.stringify(canvas.toJSON(['data', 'id', 'annotationType']));
}

// ─── Deserialize canvas ───────────────────────────────────────────────────────
export function deserializeCanvas(
  canvas: fabric.Canvas,
  json: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const parsed = JSON.parse(json);
      canvas.loadFromJSON(parsed, () => {
        canvas.renderAll();
        resolve();
      });
    } catch (e) {
      reject(e);
    }
  });
}

// ─── Canvas to DataURL ────────────────────────────────────────────────────────
export function canvasToDataURL(canvas: fabric.Canvas): string {
  return canvas.toDataURL({ format: 'png', multiplier: 1 });
}

// ─── Generate unique ID ───────────────────────────────────────────────────────
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
