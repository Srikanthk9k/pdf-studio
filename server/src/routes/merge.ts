import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { readFile, saveFile, fileExists } from '../utils/fileStorage';
import { mergePdfs, getPageCount } from '../services/pdfService';

const router = Router();

/**
 * POST /api/merge
 * Body: { fileIds: string[] }
 * Merges all supplied PDFs in order and returns a new fileId.
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fileIds } = req.body as { fileIds: string[] };

    if (!Array.isArray(fileIds) || fileIds.length < 2) {
      res.status(400).json({ error: 'Provide at least 2 fileIds to merge.' });
      return;
    }

    // Validate all files exist before doing any work
    for (const id of fileIds) {
      if (!fileExists(id)) {
        res.status(404).json({ error: `File not found: ${id}` });
        return;
      }
    }

    const buffers = await Promise.all(fileIds.map((id) => readFile(id)));
    const merged = await mergePdfs(buffers);

    const fileId = uuidv4();
    await saveFile(fileId, merged);
    const pages = await getPageCount(merged);

    res.status(201).json({
      fileId,
      url: `/api/files/${fileId}`,
      pages,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
