import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthenticatedUser {
  id: string;
  email?: string;
  role?: string;
}

// Extend Express Request to carry the authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET ?? 'pdf-studio-dev-secret-change-in-production';

/**
 * Auth middleware.
 * When AUTH_ENABLED !== 'true', all requests are allowed through without a token.
 * When AUTH_ENABLED === 'true', a valid Bearer JWT is required.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (process.env.AUTH_ENABLED !== 'true') {
    // Auth is disabled — pass through immediately
    next();
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or malformed Authorization header' });
    return;
  }

  const token = authHeader.slice('Bearer '.length);

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUser & jwt.JwtPayload;
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    };
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Token has expired' });
    } else if (err instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: 'Invalid token' });
    } else {
      res.status(500).json({ error: 'Authentication error' });
    }
  }
}
