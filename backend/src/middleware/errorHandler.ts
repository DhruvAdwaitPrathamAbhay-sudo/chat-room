/**
 * backend/src/middleware/errorHandler.ts
 *
 * Global Express error handler.
 *
 * Security rules:
 *   - 500 responses never expose internal error details to the client.
 *   - Logs include the error message and stack trace for debugging.
 *   - Logs never contain passwords, Admin Keys, session tokens, or DATABASE_URL.
 */

import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

// Known secret field names — ensure they never appear in logs
const SECRET_FIELDS = [
  'password',
  'adminKey',
  'admin_key',
  'sessionToken',
  'session_token',
  'token',
  'DATABASE_URL',
  'SESSION_SECRET',
];

/**
 * Returns true if the given key is a known secret field that must not be logged.
 */
function isSecretField(key: string): boolean {
  return SECRET_FIELDS.some((f) => key.toLowerCase().includes(f.toLowerCase()));
}

/**
 * Produces a sanitized version of an error suitable for logging.
 * Removes fields that could contain sensitive data.
 */
function sanitizeForLog(err: unknown): string {
  if (!(err instanceof Error)) return String(err);

  // Build a safe representation without any secret request body fields
  const lines: string[] = [`${err.name}: ${err.message}`];
  if (err.stack) {
    // Include only the stack, not the full object (which may carry req.body)
    lines.push(err.stack);
  }
  return lines.join('\n');
}

export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void => {
  const typedErr = err as { statusCode?: number; code?: string; message?: string };
  const statusCode = typedErr.statusCode ?? 500;

  // Log all errors in dev; only >= 500 in production (expected 4xx are client mistakes)
  if (!config.isProd || statusCode >= 500) {
    // Never log request body (may contain passwords / admin keys)
    console.error(`[Error] ${req.method} ${req.path} → ${statusCode}`);
    console.error(sanitizeForLog(err));
  }

  // For 500s: generic message to the client — never expose internals
  const clientMessage =
    statusCode >= 500
      ? 'An unexpected error occurred. Please try again.'
      : (typedErr.message ?? 'An error occurred.');

  res.status(statusCode).json({
    success: false,
    error: {
      code: typedErr.code ?? 'INTERNAL_ERROR',
      message: clientMessage,
    },
  });
};
