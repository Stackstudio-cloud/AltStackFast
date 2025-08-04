import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// This secret should be a long, random string stored in your .env file
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-for-dev';

export const adminAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verify the token using our secret
    jwt.verify(token, JWT_SECRET);
    // If the token is valid, proceed to the next handler
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Forbidden: Invalid token.' });
  }
}; 