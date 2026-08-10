/**
 * backend/src/config/db.ts
 *
 * PostgreSQL connection pool setup using `pg` (node-postgres).
 * Relies on config/index.ts having already validated DATABASE_URL.
 */

import { Pool } from 'pg';
import { config } from './index';

/**
 * Determines whether SSL should be enabled for the PostgreSQL pool.
 * Automatically enables SSL for Supabase, Render, Neon, or if sslmode=require/ssl=true
 * is present in DATABASE_URL or DB_SSL=true is set in env.
 */
function shouldEnableSsl(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.includes('sslmode=require') ||
    lower.includes('ssl=true') ||
    lower.includes('supabase.com') ||
    lower.includes('render.com') ||
    lower.includes('neon.tech') ||
    process.env.DB_SSL === 'true'
  );
}

const useSsl = shouldEnableSsl(config.database.url);

export const pool = new Pool({
  connectionString: config.database.url,
  ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  // Connection pool tuning
  idleTimeoutMillis: config.isProd ? 600_000 : 30_000,
  connectionTimeoutMillis: 5_000,
  max: 20,
});

pool.on('error', (err) => {
  // Log error message without exposing connection credentials
  console.error('[DB] Unexpected pool error:', err.message);
});

export const query = (text: string, params?: unknown[]) =>
  pool.query(text, params);

export const getClient = () => pool.connect();

/**
 * Categorizes database connection errors safely without exposing passwords,
 * user credentials, or full connection strings.
 */
export function categorizeDbError(err: unknown): { category: string; description: string } {
  if (!(err instanceof Error)) {
    return {
      category: 'UNKNOWN_ERROR',
      description: 'An unknown non-error object was thrown during connection attempt.',
    };
  }

  const errObj = err as Error & { code?: string; errno?: number | string };
  const code = errObj.code || '';
  const msg = errObj.message.toLowerCase();

  if (code === 'ECONNREFUSED' || msg.includes('econnrefused')) {
    return {
      category: 'HOST_UNREACHABLE',
      description: 'PostgreSQL database server is not running at the specified host/port (e.g. port 5432 is down or unreachable).',
    };
  }
  if (code === 'ENOTFOUND' || msg.includes('enotfound') || msg.includes('getaddrinfo')) {
    return {
      category: 'HOST_NOT_FOUND',
      description: 'Database hostname could not be resolved by DNS.',
    };
  }
  if (code === '28P01' || msg.includes('password authentication failed')) {
    return {
      category: 'AUTHENTICATION_FAILED',
      description: 'Database username or password is incorrect.',
    };
  }
  if (code === '3D000' || (msg.includes('database') && msg.includes('does not exist'))) {
    return {
      category: 'DATABASE_NOT_FOUND',
      description: 'The target database name does not exist on the PostgreSQL server.',
    };
  }
  if (code === '28000' || msg.includes('no pg_hba.conf entry')) {
    return {
      category: 'AUTHORIZATION_SPECIFICATION_ERROR',
      description: 'Client connection rejected by PostgreSQL authorization (pg_hba.conf).',
    };
  }
  if (msg.includes('ssl') || msg.includes('tls') || code === 'DEPTH_ZERO_SELF_SIGNED_CERT') {
    return {
      category: 'SSL_CONFIGURATION_ERROR',
      description: 'SSL/TLS negotiation failed. Remote host may require SSL (e.g. ?sslmode=require).',
    };
  }
  if (code === 'ETIMEDOUT' || msg.includes('timeout')) {
    return {
      category: 'CONNECTION_TIMEOUT',
      description: 'Connection attempt timed out waiting for database server response.',
    };
  }

  return {
    category: 'CONNECTION_FAILURE',
    description: `Connection check failed [code: ${code || 'NONE'}]: ${errObj.message}`,
  };
}

/**
 * Perform a lightweight connectivity check on startup.
 * Rejects with a categorized error if the database is unreachable.
 */
export async function pingDatabase(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
  } finally {
    client.release();
  }
}
