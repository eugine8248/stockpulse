import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const NO_AUTH = process.env.NO_AUTH === 'true';

export interface AuthedRequest extends Request {
  userId?: number;
}

export async function ensureNoAuthUser(): Promise<number> {
  let u = await prisma.user.findFirst({ where: { email: 'local@stockpulse.local' } });
  if (!u) {
    u = await prisma.user.create({
      data: {
        email: 'local@stockpulse.local',
        passwordHash: bcrypt.hashSync('no-auth-mode', 4),
        name: 'Local User',
      },
    });
  }
  return u.id;
}

export function authMiddleware(req: AuthedRequest, res: Response, next: NextFunction) {
  if (NO_AUTH) {
    ensureNoAuthUser()
      .then(id => { req.userId = id; next(); })
      .catch(next);
    return;
  }
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ success: false, error: 'No token' });
  try {
    const payload = jwt.verify(token, SECRET) as { userId: number };
    req.userId = payload.userId;
    next();
  } catch {
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }
}

export function signToken(userId: number): string {
  return jwt.sign({ userId }, SECRET, { expiresIn: '7d' });
}

export function verifyTokenSafe(token: string): number | null {
  try {
    const payload = jwt.verify(token, SECRET) as { userId: number };
    return payload.userId;
  } catch {
    return null;
  }
}
