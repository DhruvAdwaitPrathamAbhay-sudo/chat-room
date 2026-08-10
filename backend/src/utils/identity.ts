import crypto from 'crypto';

// Anonymous identity word lists
const ADJECTIVES = [
  'Silent', 'Shadow', 'Neon', 'Midnight', 'Quiet', 'Unknown', 'Phantom',
  'Crimson', 'Azure', 'Mystic', 'Frozen', 'Golden', 'Silver', 'Dark',
  'Electric', 'Cosmic', 'Spectral', 'Hollow', 'Ember', 'Stone', 'Swift',
  'Pale', 'Iron', 'Lunar', 'Solar', 'Velvet', 'Ancient', 'Hidden', 'Wild',
  'Obsidian', 'Amber', 'Crystal', 'Sapphire', 'Ivory', 'Onyx', 'Russet',
];

const NOUNS = [
  'Fox', 'Wolf', 'Ghost', 'Raven', 'Panda', 'Knight', 'Hawk', 'Lynx',
  'Bear', 'Viper', 'Falcon', 'Jaguar', 'Specter', 'Cipher', 'Wraith',
  'Shade', 'Echo', 'Titan', 'Nomad', 'Sage', 'Frost', 'Storm', 'Ridge',
  'Dusk', 'Dawn', 'Flare', 'Ember', 'Gale', 'Tide', 'Void', 'Mist',
  'Crow', 'Serpent', 'Stallion', 'Wisp', 'Phantom', 'Oracle', 'Ranger',
];

/**
 * Generates a random anonymous identity (e.g., "Silent Fox").
 * Attempts to make it unique within a room by avoiding already-used names.
 */
export function generateAnonymousName(usedNames: string[] = []): string {
  const usedSet = new Set(usedNames);
  const maxAttempts = 100;

  for (let i = 0; i < maxAttempts; i++) {
    const adj = ADJECTIVES[crypto.randomInt(ADJECTIVES.length)];
    const noun = NOUNS[crypto.randomInt(NOUNS.length)];
    const name = `${adj} ${noun}`;
    if (!usedSet.has(name)) {
      return name;
    }
  }

  // Fallback: append a short random suffix if all combinations are exhausted
  const adj = ADJECTIVES[crypto.randomInt(ADJECTIVES.length)];
  const noun = NOUNS[crypto.randomInt(NOUNS.length)];
  const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `${adj} ${noun} ${suffix}`;
}

/**
 * Generates a random anonymous avatar identifier (one of a predefined set).
 */
export function generateAnonymousAvatar(): string {
  const avatars = [
    'fox', 'wolf', 'panda', 'raven', 'hawk', 'lynx', 'bear',
    'viper', 'falcon', 'jaguar', 'ghost', 'knight',
  ];
  return avatars[crypto.randomInt(avatars.length)] + '-01';
}

/**
 * Generates a short, unique room code (e.g., "VX7K2P").
 */
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[crypto.randomInt(chars.length)];
  }
  return code;
}

/**
 * Generates a cryptographically secure admin key.
 * Returns something like "VEIL-A3F2-91QK-B7XZ"
 */
export function generateAdminKey(): string {
  const part = () => crypto.randomBytes(2).toString('hex').toUpperCase();
  return `VEIL-${part()}-${part()}-${part()}`;
}
