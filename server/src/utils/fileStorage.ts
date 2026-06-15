import fs from 'fs';
import path from 'path';

const UPLOAD_DIR = '/tmp/pdf-studio-uploads';

/**
 * Ensures the upload directory exists, creating it if necessary.
 */
export function ensureUploadDir(): void {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

/**
 * Returns the full file system path for a given fileId.
 */
export function getFilePath(fileId: string): string {
  return path.join(UPLOAD_DIR, fileId);
}

/**
 * Saves a buffer to disk under the given fileId.
 */
export async function saveFile(fileId: string, buffer: Buffer): Promise<void> {
  ensureUploadDir();
  const filePath = getFilePath(fileId);
  await fs.promises.writeFile(filePath, buffer);
}

/**
 * Reads a file from disk and returns it as a Buffer.
 * Throws if the file does not exist.
 */
export async function readFile(fileId: string): Promise<Buffer> {
  const filePath = getFilePath(fileId);
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${fileId}`);
  }
  return fs.promises.readFile(filePath);
}

/**
 * Deletes a file from disk.
 * Silently ignores missing files.
 */
export async function deleteFile(fileId: string): Promise<void> {
  const filePath = getFilePath(fileId);
  try {
    await fs.promises.unlink(filePath);
  } catch (err: unknown) {
    const nodeErr = err as NodeJS.ErrnoException;
    if (nodeErr.code !== 'ENOENT') {
      throw err;
    }
  }
}

/**
 * Returns true if a file with the given fileId exists on disk.
 */
export function fileExists(fileId: string): boolean {
  return fs.existsSync(getFilePath(fileId));
}
