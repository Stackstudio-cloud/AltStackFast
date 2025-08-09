import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// This secret should be a long, random string stored in your .env file
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-for-dev';
const NODE_ENV = process.env.NODE_ENV || 'development';

export const adminAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verify the token using our secret
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload | string;
    // Attach minimal identity to request for downstream auditing
    (req as any).user = typeof decoded === 'string' ? { sub: decoded } : decoded;
    // If the token is valid, proceed to the next handler
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Forbidden: Invalid token.' });
  }
}; 

// Fail fast if missing JWT secret in production
export const assertProdSecrets = () => {
  if (NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'default-secret-for-dev')) {
    throw new Error('JWT_SECRET must be set in production');
  }
};