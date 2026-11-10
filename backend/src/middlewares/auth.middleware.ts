import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

export interface AuthenticatedUser {
  id: string;
  nomor_induk: string;
  nama: string;
  role: 'ADMIN' | 'GURU' | 'SISWA' | 'ORANG_TUA';
  kelas_id?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export const authenticateJWT = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Akses ditolak: Token autentikasi tidak ditemukan.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as AuthenticatedUser;
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Token tidak valid atau telah kedaluwarsa.' });
  }
};

export const requireRole = (allowedRoles: Array<'ADMIN' | 'GURU' | 'SISWA' | 'ORANG_TUA'>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Pengguna belum terautentikasi.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Akses dilarang. Diperlukan hak akses: [${allowedRoles.join(', ')}]`,
      });
    }

    next();
  };
};

