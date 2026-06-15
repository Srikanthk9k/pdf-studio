import { Router, Request, Response, NextFunction } from 'express';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { readFile, saveFile, fileExists, getFilePath } from '../utils/fileStorage';
import { compressWithGhostscript } from '../services/conversionService';

const router = Router();

type Quality = 'low' | 'medium' | 'high';

/**
 * POST /api/compress
 * Body: { fileId: string, quality: 'low' | 'medium' | 'high' }
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fileId, quality = 'medium' } = req.body as { fileId: string; quality: Quality };

    if (!fileId) {
      res.status(400).json({ error: 'fileId is required.' });
      return;
    }
    if (!['low', 'medium', 'high'].includes(quality)) {
      res.status(400).json({ error: 'quality must be "low", "medium", or "high".' });
      return;
    }
    if (!fileExists(fileId)) {
      res.status(404).json({ error: `File not found: ${fileId}` });
      return;
    }

    const inputPath = getFilePath(fileId);
    const newFileId = uuidv4();
    const outputPath = getFilePath(newFileId);

    const { inputSize, outputSize } = await compressWithGhostscript(
      inputPath,
      outputPath,
      quality,
    );

    const ratio = inputSize > 0 ? Math.round((1 - outputSize / inputSize) * 100) : 0;

    res.status(201).json({
      fileId: newFileId,
      url: `/api/files/${newFileId}`,
      originalSize: inputSize,
      compressedSize: outputSize,
      ratio,
    });
  } catch (err) {
    // Give a helpful error when Ghostscript isn't installed
    const msg = (err as Error).message;
    if (msg.includes('not found') || msg.includes('ENOENT')) {
      res.status(503).json({
        error: 'Ghostscript is not installed or not on PATH. Install gs to enable compression.',
        detail: msg,
      });
    } else {
      next(err);
    }
  }
});

export default router;
