import { Request, Response, NextFunction } from 'express';
import {
  verifySession,
  createOrGetUser,
  createSession,
  getAuthUserFromToken,
} from '../services/authService';

const IS_PROD = process.env.NODE_ENV === 'production';
const SESSION_COOKIE = 'veil_session';
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Extracts Bearer token from Authorization header if present.
 */
function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.substring(7).trim();
}

/**
 * requireAuth middleware: validates the Supabase Bearer token or session cookie
 * and attaches the user to req.sessionUser. Returns 401 if not authenticated.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // 1. Try Supabase Bearer token first
    const bearerToken = getBearerToken(req);
    if (bearerToken) {
      const authUser = await getAuthUserFromToken(bearerToken);
      if (authUser) {
        req.sessionUser = { userId: authUser.id, name: authUser.name };
        return next();
      }
    }

    // 2. Fallback to existing session cookie
    const sessionToken = req.cookies?.[SESSION_COOKIE];
    if (sessionToken) {
      const user = await verifySession(sessionToken);
      if (user) {
        req.sessionUser = { userId: user.id, name: user.name };
        return next();
      }
    }

    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * ensureAuth middleware: validates Supabase Bearer token or existing session cookie;
 * if absent, auto-provisions an anonymous guest session so guests can participate.
 */
export async function ensureAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // 1. Try Supabase Bearer token first
    const bearerToken = getBearerToken(req);
    if (bearerToken) {
      const authUser = await getAuthUserFromToken(bearerToken);
      if (authUser) {
        req.sessionUser = { userId: authUser.id, name: authUser.name };
        return next();
      }
    }

    // 2. Try existing session cookie
    const sessionToken = req.cookies?.[SESSION_COOKIE];
    if (sessionToken) {
      const user = await verifySession(sessionToken);
      if (user) {
        req.sessionUser = { userId: user.id, name: user.name };
        return next();
      }
    }

    // 3. Auto-create anonymous guest user + session cookie
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

