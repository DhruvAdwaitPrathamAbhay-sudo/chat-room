import { Request, Response, NextFunction } from 'express';
import { verifySession } from '../services/authService';

/**
 * requireAuth middleware: validates the session cookie and attaches the user
 * to req.sessionUser. Returns 401 if not authenticated.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const sessionToken = req.cookies?.veil_session;
    if (!sessionToken) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
      });
      return;
    }

    const user = await verifySession(sessionToken);
    if (!user) {
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_SESSION', message: 'Session expired or invalid.' },
      });
      return;
    }

    req.sessionUser = { userId: user.id, name: user.name };
    next();
  } catch (err) {
    next(err);
  }
}
