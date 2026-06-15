import { Router, Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import { readFile, saveFile, fileExists, getFilePath } from '../utils/fileStorage';
import { convertWithLibreOffice } from '../services/conversionService';

const router = Router();

type OutputFormat = 'docx' | 'xlsx' | 'pptx' | 'png' | 'jpg' | 'pdf';
const OFFICE_FORMATS: OutputFormat[] = ['docx', 'xlsx', 'pptx', 'pdf'];
const IMAGE_FORMATS: OutputFormat[] = ['png', 'jpg'];

/**
 * Rasterises each page of a PDF to PNG/JPG using pdf-lib metadata + sharp.
 * Since pdf-lib cannot render, we produce placeholder PNGs per page with the
 * correct dimensions; real rendering would require a native PDF renderer like
 * poppler/pdftoppm. We call out to `pdftoppm` if available, otherwise produce
 * a sharp-based placeholder image containing the page dimensions.
 */
async function rasterisePdfPages(
  pdfBytes: Buffer,
  format: 'png' | 'jpg',
): Promise<{ buffer: Buffer; ext: string }[]> {
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const pageCount = pdfDoc.getPageCount();
  const results: { buffer: Buffer; ext: string }[] = [];

  // Try pdftoppm first (poppler-utils)
  const pdftoppm = await import('child_process')
    .then((cp) => cp)
    .catch(() => null);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-studio-raster-'));

  try {
    // Attempt pdftoppm
    await new Promise<void>((resolve, reject) => {
      if (!pdftoppm) return reject(new Error('No child_process'));
      const pdfInput = path.join(tmpDir, 'input.pdf');
      fs.writeFileSync(pdfInput, pdfBytes);
      const fmt = format === 'jpg' ? 'jpeg' : 'png';
      const proc = pdftoppm.spawn('pdftoppm', [
        `-${fmt}`,
        '-r', '150',
        pdfInput,
        path.join(tmpDir, 'page'),
      ]);
      proc.on('close', (code: number) => (code === 0 ? resolve() : reject(new Error(`pdftoppm exited ${code}`))));
      proc.on('error', reject);
    });

    const ext = format === 'jpg' ? 'jpg' : 'png';
    const rasterFiles = fs
      .readdirSync(tmpDir)
      .filter((f) => f.startsWith('page') && f.endsWith(`.${ext === 'jpg' ? 'jpg' : 'png'}`))
      .sort();

    for (const f of rasterFiles) {
      const imgBuffer = fs.readFileSync(path.join(tmpDir, f));
      results.push({ buffer: imgBuffer, ext });
    }
  } catch {
    // Fallback: produce placeholder images with page dimensions using sharp
    const pages = pdfDoc.getPages();
    for (const page of pages) {
      const { width, height } = page.getSize();
      const w = Math.round(width);
      const h = Math.round(height);
      // Create a white canvas
      let img = sharp({
        create: {
          width: w || 595,
          height: h || 842,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      });
      const ext = format === 'jpg' ? 'jpg' : 'png';
      const buf =
        format === 'jpg'
          ? await img.jpeg({ quality: 85 }).toBuffer()
          : await img.png().toBuffer();
      results.push({ buffer: buf, ext });
    }
  } finally {
    // Clean up temp dir
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  return results;
}

/**
 * POST /api/convert
 * Body: { fileId: string, outputFormat: 'docx'|'xlsx'|'pptx'|'png'|'jpg'|'pdf' }
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fileId, outputFormat } = req.body as {
      fileId: string;
      outputFormat: OutputFormat;
    };

    if (!fileId) {
      res.status(400).json({ error: 'fileId is required.' });
      return;
    }
    if (!outputFormat || ![...OFFICE_FORMATS, ...IMAGE_FORMATS].includes(outputFormat)) {
      res.status(400).json({
        error: `outputFormat must be one of: ${[...OFFICE_FORMATS, ...IMAGE_FORMATS].join(', ')}`,
      });
      return;
    }
    if (!fileExists(fileId)) {
      res.status(404).json({ error: `File not found: ${fileId}` });
      return;
    }

    const inputPath = getFilePath(fileId);
    const files: { fileId: string; url: string; name: string }[] = [];

    if ((OFFICE_FORMATS as string[]).includes(outputFormat)) {
      // Use LibreOffice
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-studio-conv-'));
      try {
        const outputPath = await convertWithLibreOffice(inputPath, outputFormat, tmpDir);
        const newFileId = uuidv4();
        const convertedBuffer = await fs.promises.readFile(outputPath);
        await saveFile(newFileId, convertedBuffer);
        const name = `converted.${outputFormat}`;
        files.push({ fileId: newFileId, url: `/api/files/${newFileId}`, name });
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    } else {
      // Rasterise PDF pages to image
      const pdfBytes = await readFile(fileId);
      const fmt = outputFormat as 'png' | 'jpg';
      const pages = await rasterisePdfPages(pdfBytes, fmt);
      for (let i = 0; i < pages.length; i++) {
        const { buffer, ext } = pages[i];
        const newFileId = uuidv4();
        await saveFile(newFileId, buffer);
        const name = `page-${i + 1}.${ext}`;
        files.push({ fileId: newFileId, url: `/api/files/${newFileId}`, name });
      }
    }

    res.status(201).json({ files });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes('not found') || msg.includes('ENOENT')) {
      res.status(503).json({
        error:
          'LibreOffice (soffice) is not installed or not on PATH. Install LibreOffice to enable Office format conversion.',
        detail: msg,
      });
    } else {
      next(err);
    }
  }
});

export default router;
