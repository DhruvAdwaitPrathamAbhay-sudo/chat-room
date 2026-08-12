/**
 * backend/src/server.ts
 *
 * Application entry point.
 *
 * Import order matters:
 *   1. config/index — loads + validates .env, exits on failure
 *   2. config/db    — creates the DB pool using the validated config
 *   3. Everything else
 */

// ① Validate environment FIRST — exits with a clear message if vars are missing
import { config } from './config';

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import http from 'http';
import { Server } from 'socket.io';

import { pingDatabase, categorizeDbError } from './config/db';
import {
  helmetMiddleware,
  generalLimiter,
  authLimiter,
  adminKeyLimiter,
  createRoomLimiter,
  joinRoomLimiter,
  sensitiveAdminLimiter,
} from './middleware/security';
import { errorHandler } from './middleware/errorHandler';
import apiRoutes from './routes';
import { setupSocket } from './socket';

// ── App & HTTP server ─────────────────────────────────────────────────────────

const app = express();
const server = http.createServer(app);

// ── Socket.IO ─────────────────────────────────────────────────────────────────

const io = new Server(server, {
  cors: {
    origin: config.cors.allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST'],
  },
  // Prevent connections that never complete a handshake from lingering
  connectTimeout: 10_000,
});

// Make io accessible in controllers via req.app.get('io')
app.set('io', io);

// ── CORS ──────────────────────────────────────────────────────────────────────
// Never use wildcard (*) when credentials: true — browsers reject it.

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow server-to-server / curl / same-origin requests (no Origin header)
    if (!origin) return callback(null, true);

    const cleanOrigin = origin.trim().replace(/^['"]|['"]$/g, '').replace(/\/+$/, '');
    const isAllowed = config.cors.allowedOrigins.some(
      (allowed) => allowed.trim().replace(/^['"]|['"]$/g, '').replace(/\/+$/, '') === cleanOrigin
    );

    if (isAllowed) {
      return callback(null, true);
    }

    // Pass false instead of throwing Error to prevent Express 500 error on preflight OPTIONS
    console.warn(`[CORS] Rejected origin: ${origin}`);
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 204,
};

// Enable CORS and explicitly handle preflight OPTIONS requests before other middleware
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ── Security headers ──────────────────────────────────────────────────────────

app.use(helmetMiddleware);

// ── Body parsing ──────────────────────────────────────────────────────────────

// 50 kb matches SECURITY.md max message size (2000 chars) with room for metadata
app.use(express.json({ limit: '50kb' }));
app.use(cookieParser());

// ── General rate limit (applied before all routes) ────────────────────────────
app.use(generalLimiter);

// ── Health check (before auth so monitoring tools can reach it) ───────────────

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: config.nodeEnv,
  });
});

// ── Route-level rate limiters ─────────────────────────────────────────────────

app.use('/api/auth/join', authLimiter);
app.use('/api/rooms/:roomCode/admin-access', adminKeyLimiter);
app.use('/api/rooms', (req, _res, next) => {
  // POST /api/rooms (create room)
  if (req.method === 'POST' && req.path === '/') {
    return createRoomLimiter(req, _res, next);
  }
  // POST /api/rooms/:code/join
  if (req.method === 'POST' && req.path.endsWith('/join')) {
    return joinRoomLimiter(req, _res, next);
  }
  // Sensitive admin actions
  const sensitivePattern = /\/(reveal|hide|mute|unmute|remove|ban|close)$/;
  if (req.method === 'POST' && sensitivePattern.test(req.path)) {
    return sensitiveAdminLimiter(req, _res, next);
  }
  next();
});

// ── API routes ────────────────────────────────────────────────────────────────

app.use('/api', apiRoutes);

// ── Global error handler ──────────────────────────────────────────────────────

app.use(errorHandler);

// ── Socket.IO setup ───────────────────────────────────────────────────────────

setupSocket(io);

// ── Start ─────────────────────────────────────────────────────────────────────

async function start(): Promise<void> {
  // Verify DB connectivity before accepting traffic
  try {
    await pingDatabase();
    console.log('[DB] Connected successfully.');
  } catch (err: unknown) {
    const diag = categorizeDbError(err);
    process.stderr.write(
      `\n❌ Database Connection Diagnostic:\n` +
        `   • Failure Category : ${diag.category}\n` +
        `   • Diagnostic Summary: ${diag.description}\n\n` +
        `  Please ensure PostgreSQL is running and update your local .env with valid credentials.\n` +
        `  Refer to .env.example for the expected variable format.\n\n`
    );
    process.exit(1);
  }

  server.listen(config.port, '0.0.0.0', () => {
    console.log(
      `✅ Veil backend running on http://0.0.0.0:${config.port} [${config.nodeEnv}]`
    );
    console.log(
      `   Allowed origins: ${config.cors.allowedOrigins.join(', ')}`
    );
  });
}

start();
