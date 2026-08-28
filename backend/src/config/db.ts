/**
 * backend/src/config/db.ts
 *
 * PostgreSQL connection pool setup using `pg` (node-postgres).
 * Relies on config/index.ts having already validated DATABASE_URL.
 * Includes automated schema migrations and connection diagnostics.
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
  idleTimeoutMillis: config.isProd ? 600_000 : 30_000,
  connectionTimeoutMillis: 5_000,
  max: 20,
});

pool.on('error', (err) => {
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
 * Automatically creates required database tables and indexes if they do not exist.
 */
export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE,
          avatar_url TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS rooms (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          room_code VARCHAR(50) UNIQUE NOT NULL,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          password_hash TEXT NOT NULL,
          admin_key_hash TEXT NOT NULL,
          owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
          max_members INTEGER DEFAULT 50,
          status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'closed')),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS room_members (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          anonymous_name VARCHAR(100) NOT NULL,
          anonymous_avatar VARCHAR(100),
          role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('member', 'admin')),
          identity_visible BOOLEAN DEFAULT FALSE,
          status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'muted', 'removed', 'banned')),
          joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(room_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS messages (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
          sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
          content TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          deleted_at TIMESTAMP WITH TIME ZONE
      );

      CREATE TABLE IF NOT EXISTS reports (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
          reporter_id UUID REFERENCES users(id) ON DELETE SET NULL,
          reported_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
          message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
          reason TEXT NOT NULL,
          status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'resolved', 'dismissed')),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          resolved_at TIMESTAMP WITH TIME ZONE
      );

      CREATE TABLE IF NOT EXISTS moderation_actions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
          admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
          target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
          action VARCHAR(50) NOT NULL,
          metadata JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sessions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          token_hash TEXT UNIQUE NOT NULL,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS profiles (
          id UUID PRIMARY KEY,
          real_name VARCHAR(255) NOT NULL,
          avatar_url TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_room_code ON rooms(room_code);
      
      -- Close any legacy duplicate active rooms so unique index can be safely created
      UPDATE rooms 
      SET status = 'closed', updated_at = NOW() 
      WHERE id NOT IN (
        SELECT DISTINCT ON (LOWER(name)) id 
        FROM rooms 
        WHERE status = 'active' 
        ORDER BY LOWER(name), created_at DESC
      ) AND status = 'active';

      CREATE UNIQUE INDEX IF NOT EXISTS idx_rooms_name_active ON rooms (LOWER(name)) WHERE status = 'active';
      CREATE INDEX IF NOT EXISTS idx_room_members_room ON room_members(room_id);
      CREATE INDEX IF NOT EXISTS idx_room_members_user ON room_members(user_id);
      CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room_id);
      CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
      CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_profiles_id ON profiles(id);

      -- Ensure public.users and public.profiles sync on auth.users insert/update
      CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
      RETURNS TRIGGER AS $$
      DECLARE
          user_real_name TEXT;
          user_avatar TEXT;
      BEGIN
          user_real_name := COALESCE(
              NEW.raw_user_meta_data->>'real_name',
              NEW.raw_user_meta_data->>'full_name',
              NEW.raw_user_meta_data->>'name',
              'User'
          );
          user_avatar := COALESCE(
              NEW.raw_user_meta_data->>'avatar_url',
              NEW.raw_user_meta_data->>'picture'
          );

          INSERT INTO public.profiles (id, real_name, avatar_url, created_at, updated_at)
          VALUES (NEW.id, user_real_name, user_avatar, NOW(), NOW())
          ON CONFLICT (id) DO UPDATE
          SET avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
              updated_at = NOW();

          INSERT INTO public.users (id, name, email, avatar_url, created_at, updated_at)
          VALUES (NEW.id, user_real_name, NEW.email, user_avatar, NOW(), NOW())
          ON CONFLICT (id) DO UPDATE
          SET email = COALESCE(EXCLUDED.email, public.users.email),
              avatar_url = COALESCE(EXCLUDED.avatar_url, public.users.avatar_url),
              updated_at = NOW();

          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;

      DO $do$
      BEGIN
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
              DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
              CREATE TRIGGER on_auth_user_created
                  AFTER INSERT OR UPDATE ON auth.users
                  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
          END IF;
      END $do$;
    `);
  } finally {
    client.release();
  }
}

/**
 * Perform a lightweight connectivity check and run migrations on startup.
 */
export async function pingDatabase(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
  } finally {
    client.release();
  }
  await runMigrations();
}
