/**
 * backend/src/middleware/security.ts
 *
 * Helmet (HTTP security headers) and express-rate-limit configurations.
 *
 * Rate limit tiers:
 *   - authLimiter        — login/join endpoints (moderate; stops credential stuffing)
 *   - adminKeyLimiter    — admin-key authentication (strict; brute-force resistant)
 *   - createRoomLimiter  — room creation (low; prevents spam)
 *   - joinRoomLimiter    — room joining (moderate)
 *   - sensitiveAdminLimiter — reveal/hide/mute/remove/ban/close (strict)
 *   - generalLimiter     — everything else (generous; won't break chat usage)
 *
 * All limiters use an in-memory store (MemoryStore) which is fine for a single
 * server instance. Swap to a Redis store when scaling horizontally.
 */

import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from '../config';

// ── Helmet ─────────────────────────────────────────────────────────────────────

/**
 * Helmet with defaults adjusted so they don't break:
 *   - Next.js frontend (needs inline styles/scripts in dev)
 *   - Socket.IO (needs WebSocket upgrade; CSP frame-ancestors is permissive)
 *   - Local development (HTTPS not enforced in dev)
 */
export const helmetMiddleware = helmet({
  // Only enforce HTTPS in production
  hsts: config.isProd
    ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
    : false,

  // Content-Security-Policy: permissive enough for Socket.IO WS connections
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", 'ws:', 'wss:'],
      scriptSrc: ["'self'", "'unsafe-inline'"],  // unsafe-inline needed for Next.js HMR in dev
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      fontSrc: ["'self'", 'data:'],
      frameSrc: ["'none'"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
    },
  },

  // Cross-Origin policies — relaxed so Next.js can fetch from the API
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
});

// ── Rate Limiters ─────────────────────────────────────────────────────────────

function makeLimiter(max: number, windowMinutes: number, message: string) {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1_000,
    max,
    standardHeaders: true,   // Return rate limit info in RateLimit-* headers
    legacyHeaders: false,
    message: {
      success: false,
      error: { code: 'RATE_LIMITED', message },
    },
    // Skip rate limiting in test environment
    skip: () => config.isTest,
  });
}

/** POST /api/auth/join — create/get user & set session */
export const authLimiter = makeLimiter(
  20,
  15,
  'Too many authentication attempts. Please wait before trying again.'
);

/**
 * POST /api/rooms/:roomCode/admin-access
 * Strict — prevents brute-force against Admin Keys.
 */
export const adminKeyLimiter = makeLimiter(
  5,
  15,
  'Too many admin key attempts. Please wait 15 minutes before trying again.'
);

/** POST /api/rooms — create a room */
export const createRoomLimiter = makeLimiter(
  10,
  60,
  'Too many rooms created. Please wait before creating another.'
);

/** POST /api/rooms/:roomCode/join */
export const joinRoomLimiter = makeLimiter(
  30,
  15,
  'Too many join attempts. Please wait before trying again.'
);

/**
 * Admin moderation actions:
 * reveal, hide, mute, unmute, remove, ban, close
 */
export const sensitiveAdminLimiter = makeLimiter(
  30,
  5,
  'Too many admin actions. Please slow down.'
);

/**
 * General fallback — generous limits so normal API usage is never blocked.
 * 300 requests per 5 minutes ≈ 1 req/s sustained, with burst headroom.
 */
export const generalLimiter = makeLimiter(
  300,
  5,
  'Too many requests. Please slow down.'
);

/**
 * POST /api/admin/rooms/clear
 * Extremely strict — this is a highly destructive, irreversible operation.
 * 3 attempts per 60 minutes per IP.
 */
export const clearRoomsLimiter = makeLimiter(
  3,
  60,
  'Too many clear-all attempts. Please wait 60 minutes before trying again.'
);
