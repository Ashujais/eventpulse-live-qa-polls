import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'eventpulse-super-secret-jwt-key-2026';

export interface AuthRequest extends Request {
  hostUser?: {
    id: string;
    email: string;
    name: string;
  };
}

export function generateToken(payload: { id: string; email: string; name: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Please log in as a host.' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string; name: string };
    req.hostUser = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired authentication token.' });
    return;
  }
}
