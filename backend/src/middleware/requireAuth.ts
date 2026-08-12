import { Request, Response, NextFunction } from 'express';
import { verifySession, createOrGetUser, createSession } from '../services/authService';

const IS_PROD = process.env.NODE_ENV === 'production';
const SESSION_COOKIE = 'veil_session';
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

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
    const sessionToken = req.cookies?.[SESSION_COOKIE];
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

/**
 * ensureAuth middleware: validates existing session cookie if present; if not,
 * auto-provisions a new anonymous user session and sets the HTTP-only cookie.
 */
export async function ensureAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const sessionToken = req.cookies?.[SESSION_COOKIE];
    if (sessionToken) {
      const user = await verifySession(sessionToken);
      if (user) {
        req.sessionUser = { userId: user.id, name: user.name };
        return next();
      }
    }

    // Auto-create anonymous user + session cookie if no valid session token exists
    const user = await createOrGetUser('Anonymous User');
    const token = await createSession(user.id);

    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: IS_PROD,
      sameSite: IS_PROD ? 'none' : 'lax',
      maxAge: SESSION_MAX_AGE,
      path: '/',
    });

    req.sessionUser = { userId: user.id, name: user.name };
    next();
  } catch (err) {
    next(err);
  }
}
