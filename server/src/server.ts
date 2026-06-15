import 'express';
import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';

// Routes
import uploadRouter from './routes/upload';
import mergeRouter from './routes/merge';
import splitRouter from './routes/split';
import protectRouter from './routes/protect';
import compressRouter from './routes/compress';
import convertRouter from './routes/convert';
import shareRouter from './routes/share';
import exportRouter from './routes/export';
import ocrRouter from './routes/ocr';
import pagesRouter from './routes/pages';

// Middleware
import { authMiddleware } from './middleware/auth';
import { ensureUploadDir } from './utils/fileStorage';

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------
ensureUploadDir();

const app = express();
const PORT = parseInt(process.env.PORT ?? '3001', 10);
const isProduction = process.env.NODE_ENV === 'production';

// ---------------------------------------------------------------------------
// Security & utility middleware
// ---------------------------------------------------------------------------
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);
app.use(compression());
app.use(morgan(isProduction ? 'combined' : 'dev'));

// CORS
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
  : ['http://localhost:3000', 'http://localhost:5173'];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g., curl, Postman) or matching origins
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS policy: origin "${origin}" is not allowed`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ---------------------------------------------------------------------------
// Rate limiting on /api routes
// ---------------------------------------------------------------------------
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX ?? '200', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

app.use('/api', apiLimiter);

// ---------------------------------------------------------------------------
// Health check (no auth required)
// ---------------------------------------------------------------------------
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'pdf-studio-server',
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
  });
});

// ---------------------------------------------------------------------------
// API routes (all behind optional auth middleware)
// ---------------------------------------------------------------------------
app.use('/api/upload',    authMiddleware, uploadRouter);
app.use('/api/files',     authMiddleware, uploadRouter); // GET /api/files/:fileId is in the upload router
app.use('/api/merge',     authMiddleware, mergeRouter);
app.use('/api/split',     authMiddleware, splitRouter);
app.use('/api/protect',   authMiddleware, protectRouter);
app.use('/api/unlock',    authMiddleware, protectRouter);
app.use('/api/compress',  authMiddleware, compressRouter);
app.use('/api/convert',   authMiddleware, convertRouter);
app.use('/api/share',     authMiddleware, shareRouter);
app.use('/api/export',    authMiddleware, exportRouter);
app.use('/api/ocr',       authMiddleware, ocrRouter);
app.use('/api/pages',     authMiddleware, pagesRouter);

// ---------------------------------------------------------------------------
// Serve React client in production
// ---------------------------------------------------------------------------
if (isProduction) {
  const clientDistPath = path.resolve(__dirname, '../../client/dist');
  app.use(express.static(clientDistPath));

  // Catch-all: serve index.html for SPA routing
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// ---------------------------------------------------------------------------
// 404 handler (for /api routes in non-production)
// ---------------------------------------------------------------------------
app.use('/api/*', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------
app.use((err: Error & { status?: number; code?: string }, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[pdf-studio-server] Error:', err.message);
  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({ error: 'File too large. Maximum size is 100 MB.' });
    return;
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    res.status(400).json({ error: 'Unexpected file field.' });
    return;
  }

  const status = err.status ?? 500;
  res.status(status).json({
    error: err.message ?? 'An unexpected error occurred.',
    ...(isProduction ? {} : { stack: err.stack }),
  });
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════╗
║           PDF Studio Server — Ready              ║
╠══════════════════════════════════════════════════╣
║  Port     : ${String(PORT).padEnd(36)}║
║  Env      : ${(process.env.NODE_ENV ?? 'development').padEnd(36)}║
║  Auth     : ${(process.env.AUTH_ENABLED === 'true' ? 'enabled' : 'disabled').padEnd(36)}║
║  Health   : http://localhost:${PORT}/health${' '.repeat(Math.max(0, 16 - String(PORT).length))}║
╚══════════════════════════════════════════════════╝
  `);
});

export default app;
