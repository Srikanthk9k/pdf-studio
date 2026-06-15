import { Router, Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { uploadSingle } from '../middleware/upload';
import { getPageCount } from '../services/pdfService';
import { saveFile, readFile, getFilePath, fileExists } from '../utils/fileStorage';

const router = Router();

// ---------------------------------------------------------------------------
// POST /api/upload
// ---------------------------------------------------------------------------
router.post(
  '/',
  (req: Request, res: Response, next: NextFunction) => {
    uploadSingle(req, res, (err) => {
      if (err) {
        return next(err);
      }
      next();
    });
  },
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded. Send a file in the "file" field.' });
        return;
      }

      const multerFile = req.file;
      const fileId = uuidv4();
      const originalName = multerFile.originalname;

      // Read the file written by multer and re-save under the fileId key
      const fileBuffer = await fs.promises.readFile(multerFile.path);
      await saveFile(fileId, fileBuffer);

      // Clean up the multer-written temp file (we now manage storage ourselves)
      await fs.promises.unlink(multerFile.path).catch(() => void 0);

      // Get page count for PDFs; other formats return 0
      let pages = 0;
      const ext = path.extname(originalName).toLowerCase();
      if (ext === '.pdf') {
        try {
          pages = await getPageCount(fileBuffer);
        } catch {
          pages = 0;
        }
      }

      res.status(201).json({
        fileId,
        name: originalName,
        size: multerFile.size,
        pages,
        url: `/api/files/${fileId}`,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/files/:fileId  — stream the file back to the client
// ---------------------------------------------------------------------------
router.get('/files/:fileId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fileId } = req.params;

    if (!fileExists(fileId)) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    const filePath = getFilePath(fileId);
    const stat = fs.statSync(filePath);

    res.setHeader('Content-Disposition', `attachment; filename="${fileId}.pdf"`);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', stat.size);

    const readStream = fs.createReadStream(filePath);
    readStream.on('error', next);
    readStream.pipe(res);
  } catch (err) {
    next(err);
  }
});

export default router;
