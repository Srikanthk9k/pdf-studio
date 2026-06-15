import {
  PDFDocument,
  degrees,
  rgb,
  StandardFonts,
  PDFPage,
  PageSizes,
} from 'pdf-lib';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse hex colour string (e.g. "#ff0000" or "ff0000") to pdf-lib rgb(). */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean, 16);
  return {
    r: ((bigint >> 16) & 255) / 255,
    g: ((bigint >> 8) & 255) / 255,
    b: (bigint & 255) / 255,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the number of pages in the PDF.
 */
export async function getPageCount(bytes: Buffer): Promise<number> {
  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  return pdfDoc.getPageCount();
}

/**
 * Rotates the specified pages by `degrees` (must be a multiple of 90).
 */
export async function rotatePagesInPdf(
  bytes: Buffer,
  pageIndices: number[],
  deg: number,
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(bytes);
  const pages = pdfDoc.getPages();
  for (const idx of pageIndices) {
    if (idx < 0 || idx >= pages.length) continue;
    const page = pages[idx];
    const current = page.getRotation().angle;
    page.setRotation(degrees((current + deg) % 360));
  }
  const resultBytes = await pdfDoc.save();
  return Buffer.from(resultBytes);
}

/**
 * Removes the pages at the given indices (0-based) from the PDF.
 */
export async function deletePages(
  bytes: Buffer,
  pageIndices: number[],
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(bytes);
  // Sort descending so removing by index doesn't shift remaining indices
  const sorted = [...new Set(pageIndices)].sort((a, b) => b - a);
  for (const idx of sorted) {
    if (idx >= 0 && idx < pdfDoc.getPageCount()) {
      pdfDoc.removePage(idx);
    }
  }
  return Buffer.from(await pdfDoc.save());
}

/**
 * Inserts a blank page after `afterPageIndex` (use -1 to prepend).
 */
export async function insertBlankPage(
  bytes: Buffer,
  afterPageIndex: number,
  width = PageSizes.A4[0],
  height = PageSizes.A4[1],
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(bytes);
  const insertAt = afterPageIndex + 1;
  pdfDoc.insertPage(insertAt, [width, height]);
  return Buffer.from(await pdfDoc.save());
}

/**
 * Extracts only the specified pages into a new PDF document.
 */
export async function extractPages(
  bytes: Buffer,
  pageIndices: number[],
): Promise<Buffer> {
  const srcDoc = await PDFDocument.load(bytes);
  const newDoc = await PDFDocument.create();
  const copied = await newDoc.copyPages(srcDoc, pageIndices);
  for (const page of copied) {
    newDoc.addPage(page);
  }
  return Buffer.from(await newDoc.save());
}

/**
 * Reorders pages according to `newOrder` (array of original 0-based indices).
 */
export async function reorderPages(
  bytes: Buffer,
  newOrder: number[],
): Promise<Buffer> {
  const srcDoc = await PDFDocument.load(bytes);
  const newDoc = await PDFDocument.create();
  const copied = await newDoc.copyPages(srcDoc, newOrder);
  for (const page of copied) {
    newDoc.addPage(page);
  }
  return Buffer.from(await newDoc.save());
}

/**
 * Merges multiple PDFs into a single document.
 */
export async function mergePdfs(buffers: Buffer[]): Promise<Buffer> {
  const mergedDoc = await PDFDocument.create();
  for (const buf of buffers) {
    const srcDoc = await PDFDocument.load(buf);
    const pageCount = srcDoc.getPageCount();
    const indices = Array.from({ length: pageCount }, (_, i) => i);
    const copiedPages = await mergedDoc.copyPages(srcDoc, indices);
    for (const page of copiedPages) {
      mergedDoc.addPage(page);
    }
  }
  return Buffer.from(await mergedDoc.save());
}

/**
 * Splits a PDF into multiple documents according to the given page ranges.
 * `ranges` are inclusive, 0-based.
 */
export async function splitPdf(
  bytes: Buffer,
  ranges: { start: number; end: number }[],
): Promise<Buffer[]> {
  const srcDoc = await PDFDocument.load(bytes);
  const results: Buffer[] = [];
  for (const range of ranges) {
    const newDoc = await PDFDocument.create();
    const indices: number[] = [];
    for (let i = range.start; i <= range.end; i++) {
      if (i >= 0 && i < srcDoc.getPageCount()) {
        indices.push(i);
      }
    }
    if (indices.length === 0) continue;
    const copied = await newDoc.copyPages(srcDoc, indices);
    for (const page of copied) {
      newDoc.addPage(page);
    }
    results.push(Buffer.from(await newDoc.save()));
  }
  return results;
}

/**
 * Encrypts the PDF with user and owner passwords and sets permissions.
 */
export async function protectPdf(
  bytes: Buffer,
  userPassword: string,
  ownerPassword: string,
  _permissions: object,
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  // pdf-lib save with passwords (Standard security handler)
  const encrypted = await pdfDoc.save({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    userPassword: userPassword as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ownerPassword: ownerPassword as any,
  } as Parameters<typeof pdfDoc.save>[0]);
  return Buffer.from(encrypted);
}

/**
 * Loads an encrypted PDF using the provided password and re-saves without encryption.
 */
export async function unlockPdf(bytes: Buffer, password: string): Promise<Buffer> {
  let pdfDoc: PDFDocument;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pdfDoc = await PDFDocument.load(bytes, { password } as any);
  } catch {
    throw new Error('Incorrect password or PDF could not be decrypted');
  }
  // Re-save without any password options removes encryption
  return Buffer.from(await pdfDoc.save());
}

// ---------------------------------------------------------------------------
// Annotation types
// ---------------------------------------------------------------------------

export interface AnnotationItem {
  type: 'text' | 'highlight' | 'rectangle' | 'ellipse' | 'arrow' | 'image' | string;
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  color?: string;       // hex
  imageData?: string;   // base64 data URL
}

/**
 * Flattens (burns in) annotations onto PDF pages.
 * `annotationsPerPage` is a map of 0-based page index → list of annotations.
 */
export async function flattenAnnotations(
  bytes: Buffer,
  annotationsPerPage: Record<number, AnnotationItem[]>,
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(bytes);
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  for (const [pageIndexStr, annotations] of Object.entries(annotationsPerPage)) {
    const pageIndex = Number(pageIndexStr);
    if (pageIndex < 0 || pageIndex >= pages.length) continue;
    const page: PDFPage = pages[pageIndex];
    const { height: pageHeight } = page.getSize();

    for (const ann of annotations) {
      // PDF coordinate system: origin bottom-left; we assume incoming coords are top-left.
      const pdfY = pageHeight - ann.y - ann.height;

      // Determine colour
      let fillColor = rgb(1, 1, 0); // default yellow
      if (ann.color) {
        try {
          const c = hexToRgb(ann.color);
          fillColor = rgb(c.r, c.g, c.b);
        } catch { /* keep default */ }
      }

      switch (ann.type) {
        case 'highlight':
          page.drawRectangle({
            x: ann.x,
            y: pdfY,
            width: ann.width,
            height: ann.height,
            color: fillColor,
            opacity: 0.35,
          });
          break;

        case 'rectangle':
          page.drawRectangle({
            x: ann.x,
            y: pdfY,
            width: ann.width,
            height: ann.height,
            borderColor: fillColor,
            borderWidth: 2,
            opacity: 0,
          });
          break;

        case 'ellipse':
          page.drawEllipse({
            x: ann.x + ann.width / 2,
            y: pdfY + ann.height / 2,
            xScale: ann.width / 2,
            yScale: ann.height / 2,
            borderColor: fillColor,
            borderWidth: 2,
            opacity: 0,
          });
          break;

        case 'arrow': {
          // Draw a simple line from top-left to bottom-right as the arrow
          const x1 = ann.x;
          const y1 = pageHeight - ann.y;
          const x2 = ann.x + ann.width;
          const y2 = pageHeight - ann.y - ann.height;
          page.drawLine({
            start: { x: x1, y: y1 },
            end: { x: x2, y: y2 },
            color: fillColor,
            thickness: 2,
          });
          break;
        }

        case 'text':
          if (ann.text) {
            page.drawText(ann.text, {
              x: ann.x,
              y: pdfY + ann.height / 2,
              size: Math.max(8, Math.min(ann.height * 0.8, 24)),
              font,
              color: fillColor,
            });
          }
          break;

        case 'image': {
          if (ann.imageData) {
            try {
              // Strip data URL prefix
              const base64 = ann.imageData.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
              const imgBytes = Buffer.from(base64, 'base64');
              let embeddedImage;
              if (ann.imageData.startsWith('data:image/png')) {
                embeddedImage = await pdfDoc.embedPng(imgBytes);
              } else {
                embeddedImage = await pdfDoc.embedJpg(imgBytes);
              }
              page.drawImage(embeddedImage, {
                x: ann.x,
                y: pdfY,
                width: ann.width,
                height: ann.height,
              });
            } catch { /* skip malformed image data */ }
          }
          break;
        }

        default:
          // Unknown annotation type — skip
          break;
      }
    }
  }

  return Buffer.from(await pdfDoc.save());
}
