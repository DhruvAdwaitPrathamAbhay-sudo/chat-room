import crypto from 'crypto';
import { query } from '../config/db';
import { User } from '../types';

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Creates a new user (or returns existing one by email for simplicity in MVP).
 * In a real app this would be part of a registration/login flow.
 */
export async function createOrGetUser(name: string, email?: string): Promise<User> {
  if (email) {
    // Try to find existing user by email
    const existing = await query(
      'SELECT id, name, email, avatar_url, created_at FROM users WHERE email = $1',
      [email]
    );
    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      return {
        id: row.id,
        name: row.name,
        email: row.email,
        avatarUrl: row.avatar_url,
        createdAt: row.created_at,
      };
    }
  }

  // Create new user
  const result = await query(
    `INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id, name, email, avatar_url, created_at`,
    [name, email || null]
  );
  const row = result.rows[0];
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
  };
}

/**
 * Creates a session token for a user and stores it in the DB.
 * Returns the plaintext token to be set as a cookie.
 */
export async function createSession(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await query(
    `INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt]
  );

  return token;
}

/**
 * Verifies a session token and returns the associated user.
 * Returns null if the session is invalid or expired.
 */
export async function verifySession(token: string): Promise<User | null> {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const result = await query(
    `SELECT u.id, u.name, u.email, u.avatar_url, u.created_at
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
    [tokenHash]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
  };
}

/**
 * Invalidates (deletes) a session by its plaintext token.
 */
export async function destroySession(token: string): Promise<void> {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  await query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]);
}

/**
 * Resolves an authenticated Supabase user from a Bearer JWT.
 * Reads the subject claim (auth.users.id) and ensures the user exists in public.users/profiles.
 */
export async function getAuthUserFromToken(token: string): Promise<User | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (!payload.sub || typeof payload.sub !== 'string') return null;

    const userId = payload.sub;

    // First check existing profile and user
    const userRes = await query(
      `SELECT u.id, COALESCE(p.real_name, u.name) as name, u.email, u.avatar_url, u.created_at
       FROM users u
       LEFT JOIN profiles p ON p.id = u.id
       WHERE u.id = $1`,
      [userId]
    );

    if (userRes.rows.length > 0) {
      const row = userRes.rows[0];
      return {
        id: row.id as string,
        name: row.name as string,
        email: row.email as string | undefined,
        avatarUrl: row.avatar_url as string | undefined,
        createdAt: row.created_at as Date,
      };
    }

    // If not found in public.users, check auth.users and sync
    const authRes = await query(
      `SELECT id, email, raw_user_meta_data, created_at FROM auth.users WHERE id = $1`,
      [userId]
    );

    if (authRes.rows.length > 0) {
      const row = authRes.rows[0];
      const realName =
        row.raw_user_meta_data?.real_name ||
        row.raw_user_meta_data?.full_name ||
        row.raw_user_meta_data?.name ||
        'User';
      const avatarUrl =
        row.raw_user_meta_data?.avatar_url ||
        row.raw_user_meta_data?.picture ||
        null;

      await query(
        `INSERT INTO users (id, name, email, avatar_url) VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, avatar_url = EXCLUDED.avatar_url`,
        [row.id, realName, row.email, avatarUrl]
      );

      await query(
        `INSERT INTO profiles (id, real_name, avatar_url) VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET real_name = COALESCE(public.profiles.real_name, EXCLUDED.real_name)`,
        [row.id, realName, avatarUrl]
      );

      return {
        id: row.id as string,
        name: realName,
        email: row.email as string,
        avatarUrl: avatarUrl || undefined,
        createdAt: row.created_at as Date,
      };
    }

    return null;
  } catch {
    return null;
  }
}

