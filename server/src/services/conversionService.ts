import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Runs a command via child_process.spawn. Collects stdout and stderr.
 * Rejects with a descriptive error if the process exits non-zero or times out.
 */
function runProcess(
  command: string,
  args: string[],
  timeoutMs = 120_000,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    let proc: ReturnType<typeof spawn>;

    try {
      proc = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (spawnErr) {
      reject(new Error(`Failed to start process "${command}": ${(spawnErr as Error).message}`));
      return;
    }

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error(`Process "${command}" timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);

    proc.on('error', (err) => {
      clearTimeout(timer);
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(
          new Error(
            `"${command}" not found. Please install it and ensure it is on PATH.`,
          ),
        );
      } else {
        reject(new Error(`Process "${command}" error: ${err.message}`));
      }
    });

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(
          new Error(
            `Process "${command}" exited with code ${code}.\nSTDERR: ${stderr.trim()}`,
          ),
        );
      }
    });
  });
}

// ---------------------------------------------------------------------------
// LibreOffice conversion
// ---------------------------------------------------------------------------

/**
 * Converts a file using LibreOffice headless mode.
 *
 * @param inputPath   Absolute path to the input file.
 * @param outputFormat Target format string understood by soffice (e.g. "docx", "pdf", "png").
 * @param outputDir   Directory where the converted file should be written.
 * @returns Absolute path to the converted output file.
 */
export async function convertWithLibreOffice(
  inputPath: string,
  outputFormat: string,
  outputDir: string,
): Promise<string> {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  // Possible soffice binary names across platforms
  const sofficeBin =
    process.env.SOFFICE_PATH ??
    (process.platform === 'darwin'
      ? '/Applications/LibreOffice.app/Contents/MacOS/soffice'
      : 'soffice');

  await runProcess(sofficeBin, [
    '--headless',
    '--norestore',
    `--convert-to`,
    outputFormat,
    '--outdir',
    outputDir,
    inputPath,
  ]);

  // LibreOffice replaces the extension with the target format
  const baseName = path.basename(inputPath, path.extname(inputPath));
  const outputPath = path.join(outputDir, `${baseName}.${outputFormat}`);

  if (!fs.existsSync(outputPath)) {
    throw new Error(
      `LibreOffice conversion succeeded but output file not found at: ${outputPath}`,
    );
  }

  return outputPath;
}

// ---------------------------------------------------------------------------
// Ghostscript compression
// ---------------------------------------------------------------------------

type CompressionQuality = 'low' | 'medium' | 'high';

/** Ghostscript -dPDFSETTINGS values mapped to our quality levels. */
const GS_QUALITY_MAP: Record<CompressionQuality, string> = {
  low: '/screen',      // 72 dpi images — smallest file
  medium: '/ebook',    // 150 dpi images
  high: '/printer',    // 300 dpi images — best quality
};

/**
 * Compresses a PDF file using Ghostscript.
 *
 * @param inputPath   Absolute path to the source PDF.
 * @param outputPath  Absolute path for the compressed output PDF.
 * @param quality     Compression level preset.
 * @returns Object containing `inputSize` and `outputSize` in bytes.
 */
export async function compressWithGhostscript(
  inputPath: string,
  outputPath: string,
  quality: CompressionQuality,
): Promise<{ inputSize: number; outputSize: number }> {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  const pdfsetting = GS_QUALITY_MAP[quality];
  const gsBin = process.env.GS_PATH ?? 'gs';

  await runProcess(gsBin, [
    '-sDEVICE=pdfwrite',
    '-dCompatibilityLevel=1.4',
    `-dPDFSETTINGS=${pdfsetting}`,
    '-dNOPAUSE',
    '-dQUIET',
    '-dBATCH',
    `-sOutputFile=${outputPath}`,
    inputPath,
  ]);

  if (!fs.existsSync(outputPath)) {
    throw new Error(`Ghostscript compression succeeded but output not found at: ${outputPath}`);
  }

  const inputStat = fs.statSync(inputPath);
  const outputStat = fs.statSync(outputPath);

  return {
    inputSize: inputStat.size,
    outputSize: outputStat.size,
  };
}
