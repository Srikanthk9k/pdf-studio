import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  rotatePagesInPdf,
  deletePages,
  insertBlankPage,
  extractPages,
  reorderPages,
  getPageCount,
} from '../services/pdfService';
import { readFile, saveFile, fileExists } from '../utils/fileStorage';

const router = Router();

// ---------------------------------------------------------------------------
// Shared helper: read → transform → save → respond
// ---------------------------------------------------------------------------
async function transformAndRespond(
  res: Response,
  next: NextFunction,
  fileId: string,
  transform: (buf: Buffer) => Promise<Buffer>,
): Promise<void> {
  try {
    if (!fileId) {
      res.status(400).json({ error: 'fileId is required.' });
      return;
    }
    if (!fileExists(fileId)) {
      res.status(404).json({ error: `File not found: ${fileId}` });
      return;
    }

    const input = await readFile(fileId);
    const output = await transform(input);

    const newFileId = uuidv4();
    await saveFile(newFileId, output);
    const pages = await getPageCount(output);

    res.status(201).json({
      fileId: newFileId,
      url: `/api/files/${newFileId}`,
      pages,
    });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// POST /api/pages/rotate
// Body: { fileId: string, pageIndices: number[], degrees: number }
// ---------------------------------------------------------------------------
router.post('/rotate', async (req: Request, res: Response, next: NextFunction) => {
  const { fileId, pageIndices, degrees } = req.body as {
    fileId: string;
    pageIndices: number[];
    degrees: number;
  };

  if (!Array.isArray(pageIndices) || pageIndices.length === 0) {
    res.status(400).json({ error: 'pageIndices must be a non-empty array.' });
    return;
  }
  if (![90, 180, 270, -90, -180, -270].includes(degrees)) {
    res.status(400).json({ error: 'degrees must be a multiple of 90 (e.g. 90, 180, 270).' });
    return;
  }

  await transformAndRespond(res, next, fileId, (buf) =>
    rotatePagesInPdf(buf, pageIndices, degrees),
  );
});

// ---------------------------------------------------------------------------
// POST /api/pages/delete
// Body: { fileId: string, pageIndices: number[] }
// ---------------------------------------------------------------------------
router.post('/delete', async (req: Request, res: Response, next: NextFunction) => {
  const { fileId, pageIndices } = req.body as {
    fileId: string;
    pageIndices: number[];
  };

  if (!Array.isArray(pageIndices) || pageIndices.length === 0) {
    res.status(400).json({ error: 'pageIndices must be a non-empty array.' });
    return;
  }

  await transformAndRespond(res, next, fileId, (buf) => deletePages(buf, pageIndices));
});

// ---------------------------------------------------------------------------
// POST /api/pages/insert-blank
// Body: { fileId: string, afterPageIndex: number, width?: number, height?: number }
// ---------------------------------------------------------------------------
router.post('/insert-blank', async (req: Request, res: Response, next: NextFunction) => {
  const { fileId, afterPageIndex, width, height } = req.body as {
    fileId: string;
    afterPageIndex: number;
    width?: number;
    height?: number;
  };

  if (afterPageIndex === undefined || afterPageIndex === null) {
    res.status(400).json({ error: 'afterPageIndex is required.' });
    return;
  }

  await transformAndRespond(res, next, fileId, (buf) =>
    insertBlankPage(buf, afterPageIndex, width, height),
  );
});

// ---------------------------------------------------------------------------
// POST /api/pages/extract
// Body: { fileId: string, pageIndices: number[] }
// ---------------------------------------------------------------------------
router.post('/extract', async (req: Request, res: Response, next: NextFunction) => {
  const { fileId, pageIndices } = req.body as {
    fileId: string;
    pageIndices: number[];
  };

  if (!Array.isArray(pageIndices) || pageIndices.length === 0) {
    res.status(400).json({ error: 'pageIndices must be a non-empty array.' });
    return;
  }

  await transformAndRespond(res, next, fileId, (buf) => extractPages(buf, pageIndices));
});

// ---------------------------------------------------------------------------
// POST /api/pages/reorder
// Body: { fileId: string, newOrder: number[] }
// ---------------------------------------------------------------------------
router.post('/reorder', async (req: Request, res: Response, next: NextFunction) => {
  const { fileId, newOrder } = req.body as {
    fileId: string;
    newOrder: number[];
  };

  if (!Array.isArray(newOrder) || newOrder.length === 0) {
    res.status(400).json({ error: 'newOrder must be a non-empty array.' });
    return;
  }

  await transformAndRespond(res, next, fileId, (buf) => reorderPages(buf, newOrder));
});

export default router;
