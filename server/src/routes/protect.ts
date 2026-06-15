import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { readFile, saveFile, fileExists } from '../utils/fileStorage';
import { protectPdf, unlockPdf } from '../services/pdfService';

const router = Router();

/**
 * POST /api/protect
 * Body: { fileId, userPassword, ownerPassword, permissions }
 */
router.post('/protect', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fileId, userPassword, ownerPassword, permissions = {} } = req.body as {
      fileId: string;
      userPassword: string;
      ownerPassword: string;
      permissions: object;
    };

    if (!fileId || !userPassword || !ownerPassword) {
      res.status(400).json({ error: 'fileId, userPassword, and ownerPassword are required.' });
      return;
    }
    if (!fileExists(fileId)) {
      res.status(404).json({ error: `File not found: ${fileId}` });
      return;
    }

    const buffer = await readFile(fileId);
    const protected_ = await protectPdf(buffer, userPassword, ownerPassword, permissions);

    const newFileId = uuidv4();
    await saveFile(newFileId, protected_);

    res.status(201).json({
      fileId: newFileId,
      url: `/api/files/${newFileId}`,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/unlock
 * Body: { fileId, password }
 */
router.post('/unlock', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fileId, password } = req.body as { fileId: string; password: string };

    if (!fileId || !password) {
      res.status(400).json({ error: 'fileId and password are required.' });
      return;
    }
    if (!fileExists(fileId)) {
      res.status(404).json({ error: `File not found: ${fileId}` });
      return;
    }

    const buffer = await readFile(fileId);
    const unlocked = await unlockPdf(buffer, password);

    const newFileId = uuidv4();
    await saveFile(newFileId, unlocked);

    res.status(201).json({
      fileId: newFileId,
      url: `/api/files/${newFileId}`,
    });
  } catch (err) {
    // Distinguish between wrong-password and other errors
    if ((err as Error).message.includes('password') || (err as Error).message.includes('decrypt')) {
      res.status(403).json({ error: (err as Error).message });
    } else {
      next(err);
    }
  }
});

export default router;
