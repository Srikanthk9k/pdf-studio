import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { PDFDocument } from 'pdf-lib';
import { readFile, saveFile, fileExists } from '../utils/fileStorage';

const router = Router();

interface PageImage {
  pageIndex: number;
  dataUrl: string; // base64 data URL: "data:image/png;base64,..."
}

/**
 * POST /api/export
 * Body: { fileId: string, pageImages: { pageIndex: number; dataUrl: string }[] }
 *
 * Embeds canvas-rendered page images (PNG) over the corresponding PDF pages,
 * effectively flattening any in-browser edits into the PDF.
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fileId, pageImages } = req.body as {
      fileId: string;
      pageImages: PageImage[];
    };

    if (!fileId) {
      res.status(400).json({ error: 'fileId is required.' });
      return;
    }
    if (!Array.isArray(pageImages) || pageImages.length === 0) {
      res.status(400).json({ error: 'pageImages array is required and must not be empty.' });
      return;
    }
    if (!fileExists(fileId)) {
      res.status(404).json({ error: `File not found: ${fileId}` });
      return;
    }

    const pdfBytes = await readFile(fileId);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();

    for (const { pageIndex, dataUrl } of pageImages) {
      if (pageIndex < 0 || pageIndex >= pages.length) continue;

      // Extract base64 data
      const match = dataUrl.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
      if (!match) continue;

      const [, imgType, base64Data] = match;
      const imgBytes = Buffer.from(base64Data, 'base64');

      let embeddedImage;
      if (imgType === 'png') {
        embeddedImage = await pdfDoc.embedPng(imgBytes);
      } else {
        embeddedImage = await pdfDoc.embedJpg(imgBytes);
      }

      const page = pages[pageIndex];
      const { width, height } = page.getSize();

      // Draw the image covering the full page (replaces the visible content)
      page.drawImage(embeddedImage, {
        x: 0,
        y: 0,
        width,
        height,
      });
    }

    const savedBytes = await pdfDoc.save();
    const newFileId = uuidv4();
    await saveFile(newFileId, Buffer.from(savedBytes));

    res.status(201).json({
      fileId: newFileId,
      url: `/api/files/${newFileId}`,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
