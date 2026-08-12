import { Request, Response } from 'express';
import { createOrGetUser, createSession, destroySession } from '../services/authService';

const IS_PROD = process.env.NODE_ENV === 'production';
const SESSION_COOKIE = 'veil_session';
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * POST /api/auth/join
 * Simple anonymous "join" — creates a user with a display name.
 * In a full app this would be a full register/login flow.
 */
export async function join(req: Request, res: Response): Promise<void> {
  const { name, email } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 50) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_NAME', message: 'A valid display name (1–50 chars) is required.' },
    });
    return;
  }

  const user = await createOrGetUser(name.trim(), email?.trim());
  const token = await createSession(user.id);

  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: IS_PROD ? 'none' : 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  });

  res.status(200).json({
    success: true,
    data: {
      user: { id: user.id, name: user.name },
    },
  });
}

/**
 * GET /api/auth/me
 * Returns the currently authenticated user from session.
 */
export async function me(req: Request, res: Response): Promise<void> {
  // requireAuth middleware attaches sessionUser
  const { userId, name } = req.sessionUser!;
  res.json({
    success: true,
    data: { user: { id: userId, name } },
  });
}

/**
 * POST /api/auth/logout
 * Destroys the session and clears the cookie.
 */
export async function logout(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.[SESSION_COOKIE];
  if (token) {
    await destroySession(token);
  }
  res.clearCookie(SESSION_COOKIE, {
    path: '/',
    httpOnly: true,
    secure: IS_PROD,
    sameSite: IS_PROD ? 'none' : 'lax',
  });
  res.json({ success: true });
}
