import { Router, Request, Response, NextFunction } from 'express';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { fileExists, getFilePath, readFile } from '../utils/fileStorage';

const router = Router();

// ---------------------------------------------------------------------------
// In-memory share token store
// ---------------------------------------------------------------------------
interface ShareEntry {
  fileId: string;
  expiresAt: Date;
}

const shareStore = new Map<string, ShareEntry>();

// Periodically prune expired tokens (every 10 minutes)
setInterval(() => {
  const now = new Date();
  for (const [token, entry] of shareStore.entries()) {
    if (entry.expiresAt < now) {
      shareStore.delete(token);
    }
  }
}, 10 * 60 * 1000);

// ---------------------------------------------------------------------------
// POST /api/share
// Body: { fileId: string }
// ---------------------------------------------------------------------------
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fileId } = req.body as { fileId: string };

    if (!fileId) {
      res.status(400).json({ error: 'fileId is required.' });
      return;
    }
    if (!fileExists(fileId)) {
      res.status(404).json({ error: `File not found: ${fileId}` });
      return;
    }

    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    shareStore.set(token, { fileId, expiresAt });

    res.status(201).json({
      token,
      url: `/api/share/${token}`,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/share/:token  — stream the file if token is valid and not expired
// ---------------------------------------------------------------------------
router.get('/:token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.params;
    const entry = shareStore.get(token);

    if (!entry) {
      res.status(404).json({ error: 'Share token not found.' });
      return;
    }

    if (new Date() > entry.expiresAt) {
      shareStore.delete(token);
      res.status(410).json({ error: 'Share token has expired.' });
      return;
    }

    if (!fileExists(entry.fileId)) {
      res.status(404).json({ error: 'Shared file no longer exists.' });
      return;
    }

    const filePath = getFilePath(entry.fileId);
    const stat = fs.statSync(filePath);

    res.setHeader('Content-Disposition', `attachment; filename="${entry.fileId}.pdf"`);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', stat.size);
    res.setHeader(
      'Cache-Control',
      `private, max-age=${Math.floor((entry.expiresAt.getTime() - Date.now()) / 1000)}`,
    );

    const stream = fs.createReadStream(filePath);
    stream.on('error', next);
    stream.pipe(res);
  } catch (err) {
    next(err);
  }
});

export default router;
