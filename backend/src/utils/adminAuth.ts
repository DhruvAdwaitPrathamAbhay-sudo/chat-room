/**
 * backend/src/utils/adminAuth.ts
 *
 * Shared Global Admin Key verification.
 * Uses crypto.timingSafeEqual to prevent timing-based side-channel attacks.
 *
 * DO NOT log the supplied key. DO NOT return it in any error response.
 */

import crypto from 'crypto';
import { config } from '../config';

/**
 * Returns true if `key` matches any of the configured ADMIN_KEYS.
 * Comparison is constant-time to prevent timing attacks.
 */
export function verifyGlobalAdminKey(key: string): boolean {
  if (!key || typeof key !== 'string') return false;

  const suppliedBuffer = Buffer.from(key, 'utf8');
  let valid = false;

  for (const configuredKey of config.adminKeys) {
    const configuredBuffer = Buffer.from(configuredKey, 'utf8');
    // timingSafeEqual requires equal-length buffers — skip if lengths differ
    if (suppliedBuffer.length === configuredBuffer.length) {
      if (crypto.timingSafeEqual(suppliedBuffer, configuredBuffer)) {
        valid = true;
        // Do NOT break early — always iterate all keys to avoid timing leaks
      }
    }
  }

  return valid;
}
