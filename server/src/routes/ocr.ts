import { Router, Request, Response } from 'express';

const router = Router();

/**
 * POST /api/ocr
 *
 * Server-side OCR stub. Full OCR is handled client-side via Tesseract.js,
 * which runs entirely in the browser and requires no network round-trip.
 * This endpoint exists to inform the client of that decision and to provide
 * a consistent API surface.
 */
router.post('/', (_req: Request, res: Response) => {
  res.status(200).json({
    message:
      'OCR is performed client-side using Tesseract.js. ' +
      'No server processing is required — call the Tesseract.js API directly in the browser.',
    clientSide: true,
    instructions: {
      library: 'tesseract.js',
      npm: 'npm install tesseract.js',
      usage:
        "import Tesseract from 'tesseract.js';\n" +
        "const { data: { text } } = await Tesseract.recognize(imageElement, 'eng');",
      docs: 'https://github.com/naptha/tesseract.js#documentation',
    },
  });
});

export default router;
