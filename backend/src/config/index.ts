/**
 * backend/src/config/index.ts
 *
 * Centralized environment configuration with Zod validation.
 * This module must be imported BEFORE any other application module so that
 * environment variables are loaded and validated at process start.
 *
 * On validation failure the process exits immediately with a non-zero code
 * and a clear, secret-free error message.
 */

import path from 'path';
import dotenv from 'dotenv';
import { z } from 'zod';

import fs from 'fs';

// ── Load .env with fallback candidate paths ──────────────────────────────────
const envCandidates = [
  path.resolve(__dirname, '../../../.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../.env'),
];

for (const candidate of envCandidates) {
  if (fs.existsSync(candidate)) {
    dotenv.config({ path: candidate });
    break;
  }
}

// ── Schema ────────────────────────────────────────────────────────────────────

const envSchema = z.object({
  // Server
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z
    .string()
    .regex(/^\d+$/, 'PORT must be a numeric string')
    .default('4000'),

  // Database
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required'),

  // CORS — at least one of ALLOWED_ORIGINS or CLIENT_URL must be provided
  CLIENT_URL: z.string().optional(),
  ALLOWED_ORIGINS: z.string().optional(),

  // Session
  SESSION_SECRET: z
    .string()
    .min(32, 'SESSION_SECRET must be at least 32 characters'),

  // Authorization
  ADMIN_KEYS: z
    .string()
    .min(1, 'ADMIN_KEYS is required'),

  // Room limits & inactivity
  MAX_ROOM_MEMBERS: z
    .string()
    .regex(/^\d+$/, 'MAX_ROOM_MEMBERS must be numeric')
    .default('50'),
  ROOM_INACTIVITY_TIMEOUT: z
    .string()
    .regex(/^\d+$/, 'ROOM_INACTIVITY_TIMEOUT must be numeric')
    .default('30000'),
});

// ── Validate ──────────────────────────────────────────────────────────────────

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  • ${i.path.join('.')}: ${i.message}`)
    .join('\n');

  // Never print the actual secret values — only field names and validation messages
  process.stderr.write(
    `\n❌ Configuration error — missing or invalid environment variables:\n${issues}\n\n` +
      `  Copy .env.example to .env and fill in the required values.\n\n`
  );
  process.exit(1);
}

const env = parsed.data;

// ── Ensure at least one CORS origin is configured ────────────────────────────
if (!env.ALLOWED_ORIGINS && !env.CLIENT_URL) {
  process.stderr.write(
    '\n❌ Configuration error — ALLOWED_ORIGINS or CLIENT_URL must be set.\n\n'
  );
  process.exit(1);
}

// ── Derived / convenience values ─────────────────────────────────────────────

/**
 * Returns the list of allowed CORS origins derived from env.
 * ALLOWED_ORIGINS (comma-separated) takes precedence over CLIENT_URL.
 */
function resolveAllowedOrigins(): string[] {
  const raw = env.ALLOWED_ORIGINS || env.CLIENT_URL || '';
  return raw
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

/**
 * Returns the list of configured Global Admin Keys.
 */
function resolveAdminKeys(): string[] {
  const raw = env.ADMIN_KEYS || '';
  return raw
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
}

// ── Exported typed config ─────────────────────────────────────────────────────

export const config = {
  nodeEnv: env.NODE_ENV,
  port: parseInt(env.PORT, 10),
  isProd: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',

  database: {
    url: env.DATABASE_URL,
  },

  cors: {
    allowedOrigins: resolveAllowedOrigins(),
  },

  session: {
    secret: env.SESSION_SECRET,
    cookieName: 'veil_session',
    maxAgeMs: 7 * 24 * 60 * 60 * 1000, // 7 days
  },

  adminKeys: resolveAdminKeys(),
  maxRoomMembers: parseInt(env.MAX_ROOM_MEMBERS, 10),
  roomInactivityTimeoutMs: parseInt(env.ROOM_INACTIVITY_TIMEOUT, 10),
} as const;
