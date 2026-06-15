import { PDFDocument, rgb, degrees } from 'pdf-lib';

// ─── Download helper ──────────────────────────────────────────────────────────
export async function downloadFile(url: string, fileName: string): Promise<void> {
  const response = await fetch(url);
  const blob = await response.blob();
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(blob);
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(anchor.href), 10_000);
}

// ─── Blob to ArrayBuffer ──────────────────────────────────────────────────────
export function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

// ─── DataURL → Uint8Array ─────────────────────────────────────────────────────
export function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ─── Uint8Array → DataURL ─────────────────────────────────────────────────────
export function uint8ArrayToDataUrl(bytes: Uint8Array, mimeType: string = 'image/png'): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
}

// ─── Flatten canvas overlays and download ─────────────────────────────────────
export async function flattenAndDownload(
  originalBytes: ArrayBuffer,
  canvasDataUrls: Record<number, string>, // pageIndex (0-based) → data URL
  fileName: string
): Promise<void> {
  // Load the original PDF
  const pdfDoc = await PDFDocument.load(originalBytes, {
    ignoreEncryption: true,
  });

  const pages = pdfDoc.getPages();

  // For each page with an overlay, embed as PNG on top
  for (const [pageIndexStr, dataUrl] of Object.entries(canvasDataUrls)) {
    const pageIndex = parseInt(pageIndexStr, 10);
    if (pageIndex < 0 || pageIndex >= pages.length) continue;
    if (!dataUrl || dataUrl === 'data:,') continue;

    const page = pages[pageIndex];
    const { width, height } = page.getSize();

    // Convert canvas data URL to PNG bytes
    const pngBytes = dataUrlToUint8Array(dataUrl);

    // Embed PNG image
    const pngImage = await pdfDoc.embedPng(pngBytes);

    // Draw the annotation overlay at full page size
    page.drawImage(pngImage, {
      x: 0,
      y: 0,
      width,
      height,
      opacity: 1,
    });
  }

  // Serialize and trigger download
  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// ─── Merge multiple PDFs (client-side) ───────────────────────────────────────
export async function mergePDFs(pdfBuffers: ArrayBuffer[]): Promise<Uint8Array> {
  const mergedDoc = await PDFDocument.create();

  for (const buffer of pdfBuffers) {
    const srcDoc = await PDFDocument.load(buffer);
    const copiedPages = await mergedDoc.copyPages(srcDoc, srcDoc.getPageIndices());
    copiedPages.forEach((page) => mergedDoc.addPage(page));
  }

  return mergedDoc.save();
}

// ─── Add blank page ───────────────────────────────────────────────────────────
export async function insertBlankPage(
  pdfBytes: ArrayBuffer,
  afterIndex: number,
  width: number = 612,
  height: number = 792
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  pdfDoc.insertPage(afterIndex + 1, [width, height]);
  return pdfDoc.save();
}

// ─── Delete page ──────────────────────────────────────────────────────────────
export async function deletePage(
  pdfBytes: ArrayBuffer,
  pageIndex: number
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  pdfDoc.removePage(pageIndex);
  return pdfDoc.save();
}

// ─── Extract pages as new PDF ─────────────────────────────────────────────────
export async function extractPages(
  pdfBytes: ArrayBuffer,
  pageIndices: number[]
): Promise<Uint8Array> {
  const srcDoc = await PDFDocument.load(pdfBytes);
  const newDoc = await PDFDocument.create();
  const copiedPages = await newDoc.copyPages(srcDoc, pageIndices);
  copiedPages.forEach((page) => newDoc.addPage(page));
  return newDoc.save();
}

// ─── Rotate page ──────────────────────────────────────────────────────────────
export async function rotatePage(
  pdfBytes: ArrayBuffer,
  pageIndex: number,
  rotationDegrees: number = 90
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();
  if (pageIndex >= 0 && pageIndex < pages.length) {
    const page = pages[pageIndex];
    page.setRotation(degrees((page.getRotation().angle + rotationDegrees) % 360));
  }
  return pdfDoc.save();
}

// ─── Format file size ─────────────────────────────────────────────────────────
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Read file as ArrayBuffer ─────────────────────────────────────────────────
export function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

// ─── Read file as DataURL ─────────────────────────────────────────────────────
export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// Re-export rgb for consumers who need it
export { rgb };
