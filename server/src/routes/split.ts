import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { readFile, saveFile, fileExists } from '../utils/fileStorage';
import { splitPdf, getPageCount } from '../services/pdfService';

const router = Router();

/**
 * POST /api/split
 * Body: { fileId: string, ranges: { start: number; end: number }[] }
 * Splits the PDF into multiple parts according to the page ranges (0-based, inclusive).
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fileId, ranges } = req.body as {
      fileId: string;
      ranges: { start: number; end: number }[];
    };

    if (!fileId) {
      res.status(400).json({ error: 'fileId is required.' });
      return;
    }
    if (!Array.isArray(ranges) || ranges.length === 0) {
      res.status(400).json({ error: 'Provide at least one range ({ start, end }).' });
      return;
    }
    if (!fileExists(fileId)) {
      res.status(404).json({ error: `File not found: ${fileId}` });
      return;
    }

    const buffer = await readFile(fileId);
    const splitBuffers = await splitPdf(buffer, ranges);

    const files: { fileId: string; url: string; pages: number }[] = [];
    for (const part of splitBuffers) {
      const partId = uuidv4();
      await saveFile(partId, part);
      const pages = await getPageCount(part);
      files.push({ fileId: partId, url: `/api/files/${partId}`, pages });
    }

    res.status(201).json({ files });
  } catch (err) {
    next(err);
  }
});

export default router;
