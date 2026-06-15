import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import { Request } from 'express';
import { ensureUploadDir } from '../utils/fileStorage';

const UPLOAD_DIR = '/tmp/pdf-studio-uploads';
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',       // xlsx
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // pptx
  'text/html',
  'application/msword',          // doc
  'application/vnd.ms-excel',    // xls
  'application/vnd.ms-powerpoint', // ppt
]);

const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.png', '.jpg', '.jpeg', '.docx', '.xlsx', '.pptx', '.html', '.htm',
]);

ensureUploadDir();

const storage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb) => {
    ensureUploadDir();
    cb(null, UPLOAD_DIR);
  },
  filename: (_req: Request, file: Express.Multer.File, cb) => {
    // Use the original name with a timestamp prefix to avoid collisions
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_MIME_TYPES.has(file.mimetype) || ALLOWED_EXTENSIONS.has(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype} (${ext})`));
  }
};

const multerInstance = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
});

/** Middleware for uploading a single file in the 'file' field. */
export const uploadSingle = multerInstance.single('file');

/** Middleware for uploading multiple files in the 'files' field (up to 20). */
export const uploadMultiple = multerInstance.array('files', 20);
