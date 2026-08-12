import { query, getClient } from '../config/db';
import { config } from '../config';
import argon2 from 'argon2';
import {
  generateAdminKey,
  generateAnonymousAvatar,
  generateAnonymousName,
  generateRoomCode,
} from '../utils/identity';
import { Room, RoomMember } from '../types';

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function rowToRoom(row: Record<string, unknown>): Room {
  return {
    id: row.id as string,
    roomCode: row.room_code as string,
    name: row.name as string,
    description: row.description as string | undefined,
    ownerId: row.owner_id as string,
    maxMembers: row.max_members as number,
    status: row.status as 'active' | 'closed',
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  };
}

function rowToMember(row: Record<string, unknown>): RoomMember {
  return {
    id: row.id as string,
    roomId: row.room_id as string,
    userId: row.user_id as string,
    anonymousName: row.anonymous_name as string,
    anonymousAvatar: row.anonymous_avatar as string,
    role: row.role as 'member' | 'admin',
    identityVisible: row.identity_visible as boolean,
    status: row.status as 'active' | 'muted' | 'removed' | 'banned',
    joinedAt: row.joined_at as Date,
    updatedAt: row.updated_at as Date,
  };
}

// ──────────────────────────────────────────────
// Room Queries
// ──────────────────────────────────────────────

export async function findRoomByCode(roomCode: string): Promise<Room | null> {
  const result = await query('SELECT * FROM rooms WHERE room_code = $1', [roomCode]);
  return result.rows.length ? rowToRoom(result.rows[0]) : null;
}

export async function findRoomByName(name: string): Promise<Room | null> {
  const result = await query(
    `SELECT * FROM rooms WHERE LOWER(name) = LOWER($1) AND status = 'active'`,
    [name.trim()]
  );
  return result.rows.length ? rowToRoom(result.rows[0]) : null;
}

export async function findRoomById(roomId: string): Promise<Room | null> {
  const result = await query('SELECT * FROM rooms WHERE id = $1', [roomId]);
  return result.rows.length ? rowToRoom(result.rows[0]) : null;
}

// ──────────────────────────────────────────────
// Member Queries
// ──────────────────────────────────────────────

export async function findMembership(roomId: string, userId: string): Promise<RoomMember | null> {
  const result = await query(
    'SELECT * FROM room_members WHERE room_id = $1 AND user_id = $2',
    [roomId, userId]
  );
  return result.rows.length ? rowToMember(result.rows[0]) : null;
}

export async function findMembershipById(membershipId: string, roomId: string): Promise<RoomMember | null> {
  const result = await query(
    'SELECT * FROM room_members WHERE id = $1 AND room_id = $2',
    [membershipId, roomId]
  );
  return result.rows.length ? rowToMember(result.rows[0]) : null;
}

export async function getUsedAnonymousNames(roomId: string): Promise<string[]> {
  const result = await query(
    'SELECT anonymous_name FROM room_members WHERE room_id = $1',
    [roomId]
  );
  return result.rows.map((r) => r.anonymous_name as string);
}

export async function getActiveMemberCount(roomId: string): Promise<number> {
  const result = await query(
    `SELECT COUNT(*) FROM room_members WHERE room_id = $1 AND status NOT IN ('removed', 'banned')`,
    [roomId]
  );
  return parseInt(result.rows[0].count, 10);
}

export async function getAllActiveMembers(roomId: string): Promise<RoomMember[]> {
  const result = await query(
    `SELECT * FROM room_members WHERE room_id = $1 AND status NOT IN ('removed', 'banned') ORDER BY joined_at ASC`,
    [roomId]
  );
  return result.rows.map(rowToMember);
}

// ──────────────────────────────────────────────
// Create Room
// ──────────────────────────────────────────────

export interface CreateRoomInput {
  name: string;
  description?: string;
  password: string;
  adminKey?: string;
  maxMembers?: number;
  ownerId: string;
}

export interface CreateRoomResult {
  room: Room;
  membership: RoomMember;
  adminKey: string; // plaintext — shown once to the creator
}

export async function createRoom(input: CreateRoomInput): Promise<CreateRoomResult> {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Generate or validate admin key
    const plaintextAdminKey = input.adminKey || generateAdminKey();
    const passwordHash = await argon2.hash(input.password);
    const adminKeyHash = await argon2.hash(plaintextAdminKey);

    // Check if an active room with the same name already exists
    const existingRoomName = await client.query(
      `SELECT id FROM rooms WHERE LOWER(name) = LOWER($1) AND status = 'active'`,
      [input.name.trim()]
    );
    if (existingRoomName.rows.length > 0) {
      throw Object.assign(new Error('A room with this name already exists.'), {
        statusCode: 400,
        code: 'ROOM_NAME_EXISTS',
      });
    }

    // Generate unique room code (retry up to 5 times)
    let roomCode = '';
    for (let i = 0; i < 5; i++) {
      roomCode = generateRoomCode();
      const existing = await client.query('SELECT id FROM rooms WHERE room_code = $1', [roomCode]);
      if (existing.rows.length === 0) break;
    }

    let roomResult;
    try {
      roomResult = await client.query(
        `INSERT INTO rooms (room_code, name, description, password_hash, admin_key_hash, owner_id, max_members, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
         RETURNING *`,
        [roomCode, input.name.trim(), input.description?.trim() || null, passwordHash, adminKeyHash, input.ownerId, Math.min(input.maxMembers || config.maxRoomMembers, config.maxRoomMembers)]
      );
    } catch (dbErr: unknown) {
      const errObj = dbErr as { code?: string };
      if (errObj.code === '23505') {
        throw Object.assign(new Error('A room with this name already exists.'), {
          statusCode: 400,
          code: 'ROOM_NAME_EXISTS',
        });
      }
      throw dbErr;
    }
    const room = rowToRoom(roomResult.rows[0]);

    // Generate anonymous identity for the admin
    const anonName = generateAnonymousName([]);
    const anonAvatar = generateAnonymousAvatar();

    const memberResult = await client.query(
      `INSERT INTO room_members (room_id, user_id, anonymous_name, anonymous_avatar, role, identity_visible, status)
       VALUES ($1, $2, $3, $4, 'admin', false, 'active')
       RETURNING *`,
      [room.id, input.ownerId, anonName, anonAvatar]
    );
    const membership = rowToMember(memberResult.rows[0]);

    // Log moderation action
    await client.query(
      `INSERT INTO moderation_actions (room_id, admin_id, target_user_id, action) VALUES ($1, $2, $2, 'room_created')`,
      [room.id, input.ownerId]
    );

    await client.query('COMMIT');
    return { room, membership, adminKey: plaintextAdminKey };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ──────────────────────────────────────────────
// Join Room as Member
// ──────────────────────────────────────────────

export async function joinRoomAsMember(
  roomId: string,
  userId: string,
  password: string,
  realName?: string
): Promise<{ room: Room; membership: RoomMember }> {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Lock the room row for UPDATE to prevent race conditions on capacity
    const roomRes = await client.query('SELECT * FROM rooms WHERE id = $1 FOR UPDATE', [roomId]);
    if (roomRes.rows.length === 0) {
      throw Object.assign(new Error('Room not found.'), { statusCode: 404, code: 'ROOM_NOT_FOUND' });
    }
    const room = rowToRoom(roomRes.rows[0]);
    if (room.status !== 'active') {
      throw Object.assign(new Error('This room is closed.'), { statusCode: 403, code: 'ROOM_CLOSED' });
    }

    // Update user's real name if provided
    if (realName && realName.trim()) {
      await client.query('UPDATE users SET name = $1, updated_at = NOW() WHERE id = $2', [realName.trim(), userId]);
    }

    // Verify password
    const valid = await argon2.verify(roomRes.rows[0].password_hash, password);
    if (!valid) {
      throw Object.assign(new Error('Incorrect room password.'), { statusCode: 403, code: 'INVALID_ROOM_CREDENTIALS' });
    }

    // Check existing membership inside the transaction
    const existingRes = await client.query(
      'SELECT * FROM room_members WHERE room_id = $1 AND user_id = $2',
      [roomId, userId]
    );
    if (existingRes.rows.length > 0) {
      const existing = rowToMember(existingRes.rows[0]);
      if (existing.status === 'banned') {
        throw Object.assign(new Error('You are banned from this room.'), { statusCode: 403, code: 'MEMBERSHIP_BANNED' });
      }
      if (existing.status === 'removed') {
        await client.query(
          `UPDATE room_members SET status = 'active', updated_at = NOW() WHERE id = $1`,
          [existing.id]
        );
        await client.query('COMMIT');
        return { room, membership: { ...existing, status: 'active' } };
      }
      await client.query('COMMIT');
      return { room, membership: existing };
    }

    // Atomic capacity check
    const countRes = await client.query(
      `SELECT COUNT(*) FROM room_members WHERE room_id = $1 AND status NOT IN ('removed', 'banned')`,
      [roomId]
    );
    const count = parseInt(countRes.rows[0].count, 10);
    const maxCapacity = Math.min(room.maxMembers || 50, config.maxRoomMembers);
    if (count >= maxCapacity) {
      throw Object.assign(new Error('Room is full.'), { statusCode: 403, code: 'ROOM_FULL' });
    }

    // Generate unique anonymous identity inside transaction
    const usedRes = await client.query(
      `SELECT anonymous_name FROM room_members WHERE room_id = $1 AND status NOT IN ('removed', 'banned')`,
      [roomId]
    );
    const usedNames = usedRes.rows.map((r) => r.anonymous_name as string);
    const anonName = generateAnonymousName(usedNames);
    const anonAvatar = generateAnonymousAvatar();

    const insertRes = await client.query(
      `INSERT INTO room_members (room_id, user_id, anonymous_name, anonymous_avatar, role, identity_visible, status)
       VALUES ($1, $2, $3, $4, 'member', false, 'active')
       RETURNING *`,
      [roomId, userId, anonName, anonAvatar]
    );
    const membership = rowToMember(insertRes.rows[0]);

    await client.query('COMMIT');
    return { room, membership };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ──────────────────────────────────────────────
// Join as Admin (re-authenticate)
// ──────────────────────────────────────────────

export async function authenticateAdmin(
  roomCode: string,
  userId: string,
  password: string,
  adminKey: string
): Promise<{ room: Room; membership: RoomMember }> {
  const room = await findRoomByCode(roomCode);
  if (!room) throw Object.assign(new Error('Room not found.'), { statusCode: 404, code: 'ROOM_NOT_FOUND' });
  if (room.status !== 'active') throw Object.assign(new Error('This room is closed.'), { statusCode: 403, code: 'ROOM_CLOSED' });

  // Verify password AND admin key
  const roomRow = await query('SELECT password_hash, admin_key_hash FROM rooms WHERE id = $1', [room.id]);
  const [pwValid, keyValid] = await Promise.all([
    argon2.verify(roomRow.rows[0].password_hash, password),
    argon2.verify(roomRow.rows[0].admin_key_hash, adminKey),
  ]);

  if (!pwValid || !keyValid) {
    throw Object.assign(new Error('Unable to authenticate with the provided credentials.'), {
      statusCode: 403,
      code: 'INVALID_ROOM_CREDENTIALS',
    });
  }

  // Find or create admin membership for this authenticated session
  let membership = await findMembership(room.id, userId);
  if (!membership) {
    const usedNames = await getUsedAnonymousNames(room.id);
    const anonName = generateAnonymousName(usedNames);
    const anonAvatar = generateAnonymousAvatar();

    const result = await query(
      `INSERT INTO room_members (room_id, user_id, anonymous_name, anonymous_avatar, role, identity_visible, status)
       VALUES ($1, $2, $3, $4, 'admin', false, 'active')
       RETURNING *`,
      [room.id, userId, anonName, anonAvatar]
    );
    membership = rowToMember(result.rows[0]);
  } else if (membership.role !== 'admin') {
    await query(`UPDATE room_members SET role = 'admin', updated_at = NOW() WHERE id = $1`, [membership.id]);
    membership.role = 'admin';
  }

  return { room, membership };
}

// ──────────────────────────────────────────────
// Close Room
// ──────────────────────────────────────────────

export async function closeRoom(roomId: string): Promise<void> {
  await query(
    `UPDATE rooms SET status = 'closed', updated_at = NOW() WHERE id = $1`,
    [roomId]
  );
}

// ──────────────────────────────────────────────
// Delete Room (auto-cleanup when empty)
// Permanently destroys the room AND all related data.
// ON DELETE CASCADE on room_id handles: room_members, messages,
// reports, moderation_actions.
// After deletion, any users who are now orphaned (no remaining
// room memberships) are also deleted — this removes their real
// name, anonymous identity, and sessions (via CASCADE on sessions.user_id).
// ──────────────────────────────────────────────

export async function deleteRoom(roomId: string): Promise<void> {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Collect the user IDs that belong to this room BEFORE cascading delete
    const memberRes = await client.query(
      'SELECT DISTINCT user_id FROM room_members WHERE room_id = $1',
      [roomId]
    );
    const userIds: string[] = memberRes.rows.map((r) => r.user_id as string);

    // Delete the room — CASCADE removes room_members, messages, reports,
    // moderation_actions automatically.
    await client.query('DELETE FROM rooms WHERE id = $1', [roomId]);

    // Delete users who are now orphaned (no remaining memberships in any room).
    // This removes their real name (users.name) and cascades to sessions.
    if (userIds.length > 0) {
      await client.query(
        `DELETE FROM users
         WHERE id = ANY($1::uuid[])
           AND NOT EXISTS (
             SELECT 1 FROM room_members WHERE user_id = users.id
           )`,
        [userIds]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ──────────────────────────────────────────────
// Clear All Rooms (Global Admin emergency cleanup)
// Permanently destroys every room and all dependent data.
// Returns the count of deleted rooms.
// ──────────────────────────────────────────────

export async function clearAllRooms(): Promise<number> {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Collect ALL user IDs across ALL rooms before deletion
    const memberRes = await client.query(
      'SELECT DISTINCT user_id FROM room_members'
    );
    const userIds: string[] = memberRes.rows.map((r) => r.user_id as string);

    // Delete all rooms — CASCADE removes all room-dependent data
    const roomRes = await client.query(
      'DELETE FROM rooms RETURNING id'
    );
    const deletedCount = roomRes.rowCount ?? 0;

    // Delete orphaned users (those with no remaining room memberships)
    if (userIds.length > 0) {
      await client.query(
        `DELETE FROM users
         WHERE id = ANY($1::uuid[])
           AND NOT EXISTS (
             SELECT 1 FROM room_members WHERE user_id = users.id
           )`,
        [userIds]
      );
    }

    await client.query('COMMIT');
    return deletedCount;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ──────────────────────────────────────────────
// Update Member Status (mute, ban, remove)
// ──────────────────────────────────────────────

export async function updateMemberStatus(
  membershipId: string,
  status: 'active' | 'muted' | 'removed' | 'banned'
): Promise<void> {
  await query(
    `UPDATE room_members SET status = $1, updated_at = NOW() WHERE id = $2`,
    [status, membershipId]
  );
}

// ──────────────────────────────────────────────
// Identity Reveal / Hide
// ──────────────────────────────────────────────

export async function setIdentityVisible(
  membershipId: string,
  visible: boolean,
  adminId: string,
  roomId: string
): Promise<RoomMember> {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE room_members SET identity_visible = $1, updated_at = NOW() WHERE id = $2`,
      [visible, membershipId]
    );

    await client.query(
      `INSERT INTO moderation_actions (room_id, admin_id, target_user_id, action)
       SELECT $1, $2, user_id, $3 FROM room_members WHERE id = $4`,
      [roomId, adminId, visible ? 'identity_revealed' : 'identity_hidden', membershipId]
    );

    await client.query('COMMIT');

    const result = await query('SELECT * FROM room_members WHERE id = $1', [membershipId]);
    return rowToMember(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ──────────────────────────────────────────────
// Get members with identity resolution for viewers
// ──────────────────────────────────────────────

export interface MemberView {
  id: string;
  displayName: string;
  realName?: string; // Only for admins
  avatar: string;
  role: 'member' | 'admin';
  identityVisible: boolean;
  status: string;
  isCurrentUser: boolean;
}

export async function getMembersForViewer(
  roomId: string,
  viewerUserId: string,
  viewerIsAdmin: boolean
): Promise<MemberView[]> {
  const result = await query(
    `SELECT rm.id, rm.anonymous_name, rm.anonymous_avatar, rm.role,
            rm.identity_visible, rm.status, rm.user_id,
            u.name as real_name
     FROM room_members rm
     JOIN users u ON u.id = rm.user_id
     WHERE rm.room_id = $1 AND rm.status NOT IN ('removed', 'banned')
     ORDER BY rm.joined_at ASC`,
    [roomId]
  );

  return result.rows.map((row) => {
    const isCurrentUser = row.user_id === viewerUserId;
    const isRevealed = row.identity_visible;

    // Display name logic (per SECURITY.md):
    // - If revealed: everyone sees real name
    // - If admin viewing: include realName in addition
    // - Otherwise: show anonymous name
    const displayName = isRevealed ? (row.real_name as string) : (row.anonymous_name as string);

    const view: MemberView = {
      id: row.id as string,
      displayName,
      avatar: row.anonymous_avatar as string,
      role: row.role as 'member' | 'admin',
      identityVisible: row.identity_visible as boolean,
      status: row.status as string,
      isCurrentUser,
    };

    // Admins also see realName for all members
    if (viewerIsAdmin) {
      view.realName = row.real_name as string;
    }

    return view;
  });
}

// ──────────────────────────────────────────────
// Messages
// ──────────────────────────────────────────────

export async function saveMessage(
  roomId: string,
  senderId: string,
  content: string
): Promise<{ id: string; content: string; createdAt: Date }> {
  const result = await query(
    `INSERT INTO messages (room_id, sender_id, content) VALUES ($1, $2, $3) RETURNING id, content, created_at`,
    [roomId, senderId, content]
  );
  return {
    id: result.rows[0].id as string,
    content: result.rows[0].content as string,
    createdAt: result.rows[0].created_at as Date,
  };
}

export async function getMessages(
  roomId: string,
  limit = 50,
  before?: string
): Promise<Array<{
  id: string;
  content: string;
  displayName: string;
  identityVisible: boolean;
  createdAt: Date;
  senderId: string;
}>> {
  let sql = `
    SELECT m.id, m.content, m.created_at, m.sender_id,
           rm.anonymous_name, rm.identity_visible,
           u.name as real_name
    FROM messages m
    JOIN users u ON u.id = m.sender_id
    LEFT JOIN room_members rm ON rm.room_id = m.room_id AND rm.user_id = m.sender_id
    WHERE m.room_id = $1 AND m.deleted_at IS NULL
  `;
  const params: unknown[] = [roomId];

  if (before) {
    sql += ` AND m.created_at < (SELECT created_at FROM messages WHERE id = $2)`;
    params.push(before);
  }

  sql += ` ORDER BY m.created_at DESC LIMIT $${params.length + 1}`;
  params.push(limit);

  const result = await query(sql, params);
  return result.rows
    .reverse()
    .map((row) => ({
      id: row.id as string,
      content: row.content as string,
      senderId: row.sender_id as string,
      displayName: row.identity_visible
        ? (row.real_name as string)
        : (row.anonymous_name as string),
      identityVisible: row.identity_visible as boolean,
      createdAt: row.created_at as Date,
    }));
}

// ──────────────────────────────────────────────
// Log moderation action
// ──────────────────────────────────────────────

export async function logModerationAction(
  roomId: string,
  adminId: string,
  targetUserId: string,
  action: string
): Promise<void> {
  await query(
    `INSERT INTO moderation_actions (room_id, admin_id, target_user_id, action) VALUES ($1, $2, $3, $4)`,
    [roomId, adminId, targetUserId, action]
  );
}
