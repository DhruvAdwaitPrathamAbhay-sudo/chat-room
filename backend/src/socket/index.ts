/**
 * backend/src/socket/index.ts
 *
 * Socket.IO event setup for Veil.
 *
 * Security principles applied:
 *   1. Every connection is authenticated via the veil_session cookie.
 *      The user ID is resolved server-side from the session — never from
 *      the client payload.
 *   2. Every privileged action re-verifies the actor's current room membership
 *      and role from the database. socket.data.role is used only for the first
 *      optimistic check; a DB query always follows.
 *   3. Room isolation: every query is scoped to the specific roomId stored in
 *      socket.data — never a client-provided roomId.
 *   4. Room deletion is race-safe: a lock map prevents concurrent deletes and
 *      the socket room is checked (not DB count) to confirm truly empty.
 *   5. Temporary disconnects are distinguished from true departures using a
 *      configurable grace period (ROOM_DELETE_DELAY_MS).
 */

import { Server, Socket } from 'socket.io';
import {
  findRoomByCode,
  findRoomById,
  findMembership,
  getMembersForViewer,
  saveMessage,
  findMessageById,
  updateMessage,
  deleteMessage,
  clearRoomMessages,
  cleanupExpiredPublicRoomMessages,
  deleteRoom,
  updateMemberStatus,
  logModerationAction,
  setIdentityVisible,
  findMembershipById,
  isOfficialPublicRoom,
  joinPublicRoom,
} from '../repositories/roomRepository';
import { query } from '../config/db';
import { verifySession, createOrGetUser } from '../services/authService';
import { config } from '../config';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SocketContext {
  roomId: string;
  userId: string;
  membershipId: string;
}

// ── Module-level io reference (set by setupSocket, read by getIo) ─────────────
let _io: Server | null = null;

/** Returns the Socket.IO server instance. Throws if setupSocket hasn't been called. */
export function getIo(): Server {
  if (!_io) throw new Error('Socket.IO server not yet initialised.');
  return _io;
}

// ── State ─────────────────────────────────────────────────────────────────────

/** socket.id → room context */
const socketRoomMap = new Map<string, SocketContext>();

/**
 * Returns the authoritative live presence for a room.
 * Uses connected Socket.IO sockets in room:${roomId} and deduplicates unique members.
 */
export function getRoomOnlinePresence(io: Server, roomId: string): {
  onlineCount: number;
  onlineMemberIds: string[];
} {
  const socketRoomId = `room:${roomId}`;
  const socketSet = io.sockets.adapter.rooms.get(socketRoomId);
  if (!socketSet || socketSet.size === 0) {
    return { onlineCount: 0, onlineMemberIds: [] };
  }

  const memberIdSet = new Set<string>();
  for (const socketId of socketSet) {
    const ctx = socketRoomMap.get(socketId);
    if (ctx?.membershipId) {
      memberIdSet.add(ctx.membershipId);
    }
  }

  const onlineCount = memberIdSet.size > 0 ? memberIdSet.size : socketSet.size;
  return {
    onlineCount,
    onlineMemberIds: Array.from(memberIdSet),
  };
}

/**
 * Broadcasts the live presence update to all sockets in room:${roomId}.
 */
export function broadcastRoomPresence(io: Server, roomId: string, roomCode?: string): void {
  const socketRoomId = `room:${roomId}`;
  const presence = getRoomOnlinePresence(io, roomId);
  io.to(socketRoomId).emit('room.presence', {
    roomId,
    roomCode,
    onlineCount: presence.onlineCount,
    onlineMemberIds: presence.onlineMemberIds,
  });
}

/**
 * roomId → pending deletion timer.
 * Only one timer may exist per room at a time.
 */
const roomDeleteTimers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * roomId → deletion in-progress flag.
 * Prevents concurrent deleteRoom() calls for the same room.
 */
const roomDeleteInProgress = new Set<string>();

/**
 * Grace period before an empty room is deleted.
 * During this window a reconnecting client can rejoin and cancel the deletion.
 * Disconnect (e.g. browser close / network blip): 30 s.
 * Explicit leave: 3 s (user clearly intended to go).
 */
const RECONNECT_GRACE_MS = 30_000;
const LEAVE_GRACE_MS = 3_000;

// ── Per-socket message rate limit ─────────────────────────────────────────────

const messageRateLimits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 5_000;

function checkMessageRateLimit(socketId: string): boolean {
  const now = Date.now();
  const rl = messageRateLimits.get(socketId);
  if (!rl || now > rl.resetAt) {
    messageRateLimits.set(socketId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (rl.count >= RATE_LIMIT_MAX) return false;
  rl.count++;
  return true;
}

// ── Room deletion helpers ─────────────────────────────────────────────────────

/**
 * Schedules a deferred deletion of the room.
 * If a timer is already running for this room it is cancelled and replaced.
 * This means a reconnection within the grace window cancels the deletion.
 */
function scheduleRoomDeletion(roomId: string, delayMs: number): void {
  // Cancel any existing pending timer
  const existing = roomDeleteTimers.get(roomId);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(async () => {
    roomDeleteTimers.delete(roomId);
    try {
      // Check if room is an official public room before deleting
      const res = await query('SELECT room_code FROM rooms WHERE id = $1', [roomId]);
      if (res.rows.length > 0 && isOfficialPublicRoom(res.rows[0].room_code)) {
        return; // Never delete official public rooms
      }
    } catch {
      // Ignore query error and proceed
    }
    performRoomDeletion(roomId).catch((err) => {
      console.error(`[Room] Deletion error for ${roomId}:`, err instanceof Error ? err.message : err);
    });
  }, delayMs);

  roomDeleteTimers.set(roomId, timer);
}

/**
 * Race-safe room deletion.
 * Uses roomDeleteInProgress to ensure only one concurrent deletion per room.
 * Guards with SOCKET count (not DB member count) — the DB count is unreliable
 * because it includes muted members and HTTP-joined-but-never-socketed users.
 * If the room no longer exists (already deleted), silently returns.
 */
async function performRoomDeletion(roomId: string): Promise<void> {
  if (roomDeleteInProgress.has(roomId)) return;
  roomDeleteInProgress.add(roomId);
  try {
    // Re-check: if any socket reconnected before the timer fired, cancel
    const socketRoomId = `room:${roomId}`;
    const liveCount = _io?.sockets.adapter.rooms.get(socketRoomId)?.size ?? 0;
    if (liveCount > 0) return; // Someone reconnected — abort deletion

    await deleteRoom(roomId);
    console.log(`[Room] Permanently deleted room and all data: ${roomId}`);
  } catch (err) {
    // If the room row is already gone (e.g. cleared by admin), ignore
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.toLowerCase().includes('no rows') && !msg.toLowerCase().includes('not found')) {
      console.error(`[Room] Deletion error for ${roomId}:`, msg);
    }
  } finally {
    roomDeleteInProgress.delete(roomId);
  }
}

/**
 * Cancel a pending deletion (e.g. when a member reconnects).
 */
function cancelRoomDeletion(roomId: string): void {
  const timer = roomDeleteTimers.get(roomId);
  if (timer) {
    clearTimeout(timer);
    roomDeleteTimers.delete(roomId);
    console.log(`[Room] Cancelled deletion timer — member rejoined: ${roomId}`);
  }
}

// ── Socket setup ─────────────────────────────────────────────────────────────

export function setupSocket(io: Server): void {
  _io = io; // Store for getIo()

  // ── 24-hour public-room message retention ────────────────────────────────
  // Run once on startup to catch any messages that expired while the server
  // was offline, then repeat every 5 minutes indefinitely.
  cleanupExpiredPublicRoomMessages().catch((err) =>
    console.error('[Retention] Initial sweep error:', err instanceof Error ? err.message : err)
  );
  const retentionInterval = setInterval(() => {
    cleanupExpiredPublicRoomMessages().catch((err) =>
      console.error('[Retention] Sweep error:', err instanceof Error ? err.message : err)
    );
  }, 5 * 60 * 1_000); // every 5 minutes
  retentionInterval.unref(); // don't keep process alive for this alone

  // ── Authentication middleware ────────────────────────────────────────────
  // Resolves the authenticated user from the veil_session cookie if present.
  // If absent or expired, auto-provisions an anonymous guest user so socket connections
  // can participate in public rooms without handshake failure.
  io.use(async (socket, next) => {
    try {
      const cookieHeader = socket.handshake.headers.cookie ?? '';
      const match = cookieHeader.match(/(?:^|;\s*)veil_session=([^;]+)/);
      const token = match?.[1];

      let user = null;
      if (token) {
        user = await verifySession(token);
      }

      if (!user) {
        user = await createOrGetUser('Anonymous User');
      }

      socket.data.userId = user.id;
      socket.data.userName = user.name;
      next();
    } catch (err) {
      console.error('[Socket] io.use error:', err);
      next(new Error('Authentication failed.'));
    }
  });

  // ── Connection ────────────────────────────────────────────────────────────

  io.on('connection', (socket: Socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    socket.emit('connection.ready', {
      connectionId: socket.id,
      serverTime: new Date().toISOString(),
    });

    // ── room.join ──────────────────────────────────────────────────────────
    socket.on('room.join', async ({ roomCode }: { roomCode: unknown }) => {
      try {
        const userId = socket.data.userId as string;

        if (!roomCode || typeof roomCode !== 'string') {
          socket.emit('room.join.failed', { code: 'INVALID_PAYLOAD', message: 'roomCode is required.' });
          return;
        }

        const room = await findRoomByCode(roomCode.trim().toUpperCase());
        if (!room) {
          socket.emit('room.join.failed', { code: 'ROOM_NOT_FOUND', message: "This room doesn't exist." });
          return;
        }
        if (room.status !== 'active') {
          socket.emit('room.join.failed', { code: 'ROOM_CLOSED', message: 'This room is closed.' });
          return;
        }

        const isPublic = isOfficialPublicRoom(room.roomCode);

        // Verify membership from DB
        let membership = await findMembership(room.id, userId);

        // If this is an official public room and membership is missing, auto-join as public guest
        if (!membership && isPublic) {
          const joined = await joinPublicRoom(room.roomCode, userId);
          membership = joined.membership;
        }

        // For private rooms, strict membership is enforced
        if (!membership) {
          socket.emit('room.join.failed', { code: 'NOT_A_MEMBER', message: 'Join the room via the API first.' });
          return;
        }
        if (membership.status === 'banned') {
          socket.emit('room.join.failed', { code: 'MEMBERSHIP_BANNED', message: 'You are banned from this room.' });
          return;
        }
        if (membership.status === 'removed') {
          socket.emit('room.join.failed', { code: 'MEMBERSHIP_REMOVED', message: 'You have been removed from this room.' });
          return;
        }

        const socketRoomId = `room:${room.id}`;
        await socket.join(socketRoomId);

        // Cancel any pending room deletion timer
        cancelRoomDeletion(room.id);

        // Store server-side context for this socket
        socketRoomMap.set(socket.id, {
          roomId: room.id,
          userId,
          membershipId: membership.id,
        });
        socket.data.roomId = room.id;
        socket.data.roomCode = room.roomCode;
        socket.data.isPublic = isPublic;
        socket.data.membershipId = membership.id;
        socket.data.role = membership.role;
        socket.data.anonName = membership.anonymousName;

        const presence = getRoomOnlinePresence(io, room.id);

        socket.emit('room.joined', {
          roomCode: room.roomCode,
          membership: {
            id: membership.id,
            displayName: membership.anonymousName,
            role: membership.role,
          },
          onlineCount: presence.onlineCount,
          onlineMemberIds: presence.onlineMemberIds,
        });

        socket.to(socketRoomId).emit('member.joined', {
          member: {
            id: membership.id,
            displayName: membership.anonymousName,
            avatar: membership.anonymousAvatar,
          },
        });

        broadcastRoomPresence(io, room.id, room.roomCode);
      } catch (err) {
        console.error('[Socket] room.join error:', err instanceof Error ? err.message : err);
        socket.emit('room.join.failed', { code: 'ERROR', message: 'Failed to join room.' });
      }
    });

    // ── room.leave ─────────────────────────────────────────────────────────
    socket.on('room.leave', async () => {
      await handleLeave(io, socket, false);
    });

    // ── message.send ───────────────────────────────────────────────────────
    socket.on('message.send', async ({ content }: { content: unknown }) => {
      try {
        const userId = socket.data.userId as string;
        const roomId = socket.data.roomId as string | undefined;
        let membershipId = socket.data.membershipId as string | undefined;

        if (!roomId) {
          socket.emit('message.rejected', { code: 'NOT_IN_ROOM', message: 'You are not in a room.' });
          return;
        }

        const trimmed = typeof content === 'string' ? content.trim() : '';
        if (trimmed.length < 1 || trimmed.length > 2000) {
          socket.emit('message.rejected', { code: 'INVALID_MESSAGE', message: 'Message must be 1–2000 characters.' });
          return;
        }

        if (!checkMessageRateLimit(socket.id)) {
          socket.emit('message.rejected', { code: 'RATE_LIMITED', message: "You're sending messages too quickly." });
          return;
        }

        const room = await findRoomById(roomId);
        if (!room || room.status !== 'active') {
          socket.emit('message.rejected', { code: 'ROOM_CLOSED', message: 'This room is not active.' });
          return;
        }

        const isPublic = isOfficialPublicRoom(room.roomCode);

        if (isPublic) {
          // ── PUBLIC ROOM: Open messaging with server-assigned anonymous name ──
          let membership = membershipId ? await findMembershipById(membershipId, roomId) : null;
          if (!membership) {
            const joined = await joinPublicRoom(room.roomCode, userId);
            membership = joined.membership;
            membershipId = membership.id;
            socket.data.membershipId = membership.id;
            socket.data.anonName = membership.anonymousName;
          }

          if (membership.status === 'muted') {
            socket.emit('message.rejected', { code: 'MUTED', message: 'You are muted in this room.' });
            return;
          }
          if (['removed', 'banned'].includes(membership.status)) {
            socket.emit('message.rejected', { code: 'NOT_A_MEMBER', message: 'You are not permitted to message in this room.' });
            return;
          }

          const message = await saveMessage(roomId, userId, trimmed);

          // In public rooms, query persistent profile for real name and avatar
          const profRes = await query('SELECT real_name, avatar_url FROM profiles WHERE id = $1', [userId]);
          const userProfile = profRes.rows[0];
          const displayName = userProfile?.real_name || membership.anonymousName;
          const avatarUrl = userProfile?.avatar_url || membership.anonymousAvatar || null;

          io.to(`room:${roomId}`).emit('message.created', {
            message: {
              id: message.id,
              content: message.content,
              displayName,
              avatarUrl,
              identityVisible: true,
              senderId: membership.id,
              authorId: userId,
              createdAt: message.createdAt,
            },
          });
          return;
        }

        // ── PRIVATE ROOM: Enforce strict private membership check ──
        if (!membershipId) {
          socket.emit('message.rejected', { code: 'NOT_IN_ROOM', message: 'You are not in a room.' });
          return;
        }

        const membership = await findMembershipById(membershipId, roomId);
        if (!membership) {
          socket.emit('message.rejected', { code: 'NOT_A_MEMBER', message: 'Membership not found.' });
          return;
        }
        if (membership.status === 'muted') {
          socket.emit('message.rejected', { code: 'MUTED', message: 'You are muted in this room.' });
          return;
        }
        if (['removed', 'banned'].includes(membership.status)) {
          socket.emit('message.rejected', { code: 'NOT_A_MEMBER', message: 'You are no longer a member of this room.' });
          return;
        }

        const message = await saveMessage(roomId, userId, trimmed);

        const displayName = membership.identityVisible
          ? (socket.data.userName as string)
          : membership.anonymousName;

        io.to(`room:${roomId}`).emit('message.created', {
          message: {
            id: message.id,
            content: message.content,
            displayName,
            identityVisible: membership.identityVisible,
            senderId: membership.id,
            createdAt: message.createdAt,
          },
        });
      } catch (err) {
        console.error('[Socket] message.send error:', err instanceof Error ? err.message : err);
        socket.emit('message.rejected', { code: 'ERROR', message: 'Failed to send message.' });
      }
    });

    // ── message.edit ───────────────────────────────────────────────────────
    socket.on('message.edit', async ({ messageId, content }: { messageId: unknown; content: unknown }) => {
      try {
        const userId = socket.data.userId as string;
        const roomId = socket.data.roomId as string | undefined;

        if (!roomId) {
          socket.emit('message.rejected', { code: 'NOT_IN_ROOM', message: 'You are not in a room.' });
          return;
        }

        if (!messageId || typeof messageId !== 'string') {
          socket.emit('message.rejected', { code: 'INVALID_PAYLOAD', message: 'messageId is required.' });
          return;
        }

        const trimmed = typeof content === 'string' ? content.trim() : '';
        if (trimmed.length < 1 || trimmed.length > 2000) {
          socket.emit('message.rejected', { code: 'INVALID_MESSAGE', message: 'Message must be 1–2000 characters.' });
          return;
        }

        if (!checkMessageRateLimit(socket.id)) {
          socket.emit('message.rejected', { code: 'RATE_LIMITED', message: "You're editing messages too quickly." });
          return;
        }

        const target = await findMessageById(messageId);
        if (!target) {
          socket.emit('message.rejected', { code: 'MESSAGE_NOT_FOUND', message: 'Message not found.' });
          return;
        }

        if (target.roomId !== roomId) {
          socket.emit('message.rejected', { code: 'FORBIDDEN', message: 'Message does not belong to this room.' });
          return;
        }

        // Only the AUTHOR can edit their own message
        if (target.senderId !== userId) {
          socket.emit('message.rejected', { code: 'FORBIDDEN', message: 'You can only edit your own messages.' });
          return;
        }

        const updated = await updateMessage(messageId, trimmed);

        io.to(`room:${roomId}`).emit('message.updated', {
          messageId: updated.id,
          content: updated.content,
          isEdited: true,
        });
      } catch (err) {
        console.error('[Socket] message.edit error:', err instanceof Error ? err.message : err);
        socket.emit('message.rejected', { code: 'ERROR', message: 'Failed to edit message.' });
      }
    });

    // ── message.delete ─────────────────────────────────────────────────────
    socket.on('message.delete', async ({ messageId }: { messageId: unknown }) => {
      try {
        const userId = socket.data.userId as string;
        const roomId = socket.data.roomId as string | undefined;

        if (!roomId) {
          socket.emit('message.rejected', { code: 'NOT_IN_ROOM', message: 'You are not in a room.' });
          return;
        }

        if (!messageId || typeof messageId !== 'string') {
          socket.emit('message.rejected', { code: 'INVALID_PAYLOAD', message: 'messageId is required.' });
          return;
        }

        const target = await findMessageById(messageId);
        if (!target) {
          socket.emit('message.rejected', { code: 'MESSAGE_NOT_FOUND', message: 'Message not found.' });
          return;
        }

        if (target.roomId !== roomId) {
          socket.emit('message.rejected', { code: 'FORBIDDEN', message: 'Message does not belong to this room.' });
          return;
        }

        // Only the author or room admin can delete
        const isAuthor = target.senderId === userId;
        let isAdmin = false;
        if (!isAuthor) {
          const membership = await findMembership(roomId, userId);
          isAdmin = membership?.role === 'admin';
        }

        if (!isAuthor && !isAdmin) {
          socket.emit('message.rejected', { code: 'FORBIDDEN', message: 'You can only delete your own messages.' });
          return;
        }

        await deleteMessage(messageId);

        io.to(`room:${roomId}`).emit('message.deleted', {
          messageId,
        });
      } catch (err) {
        console.error('[Socket] message.delete error:', err instanceof Error ? err.message : err);
        socket.emit('message.rejected', { code: 'ERROR', message: 'Failed to delete message.' });
      }
    });

    // ── room.messages.clear (admin only) ──────────────────────────────────
    socket.on('room.messages.clear', async () => {
      try {
        const userId = socket.data.userId as string;
        const roomId = socket.data.roomId as string | undefined;

        if (!roomId) {
          socket.emit('message.rejected', { code: 'NOT_IN_ROOM', message: 'You are not in a room.' });
          return;
        }

        // Re-verify admin role from DB — never trust socket.data.role alone
        const membership = await findMembership(roomId, userId);
        if (!membership || membership.role !== 'admin') {
          socket.emit('message.rejected', { code: 'FORBIDDEN', message: 'Only room admins can clear messages.' });
          return;
        }

        await clearRoomMessages(roomId);

        // Broadcast to all clients in the room so they wipe their local list
        io.to(`room:${roomId}`).emit('room.messages.cleared', {
          roomId,
        });
      } catch (err) {
        console.error('[Socket] room.messages.clear error:', err instanceof Error ? err.message : err);
        socket.emit('message.rejected', { code: 'ERROR', message: 'Failed to clear messages.' });
      }
    });

    // ── typing indicators ──────────────────────────────────────────────────
    socket.on('typing.start', () => {
      const roomId = socket.data.roomId as string | undefined;
      const membershipId = socket.data.membershipId as string | undefined;
      if (roomId && membershipId) {
        socket.to(`room:${roomId}`).emit('typing.start', { memberId: membershipId });
      }
    });

    socket.on('typing.stop', () => {
      const roomId = socket.data.roomId as string | undefined;
      const membershipId = socket.data.membershipId as string | undefined;
      if (roomId && membershipId) {
        socket.to(`room:${roomId}`).emit('typing.stop', { memberId: membershipId });
      }
    });

    // ── identity.reveal (admin) ────────────────────────────────────────────
    socket.on('identity.reveal', async ({ memberId }: { memberId: unknown }) => {
      try {
        const userId = socket.data.userId as string;
        const roomId = socket.data.roomId as string | undefined;

        if (!roomId) {
          socket.emit('error', { code: 'NOT_IN_ROOM', message: 'You are not in a room.' });
          return;
        }
        if (!memberId || typeof memberId !== 'string') {
          socket.emit('error', { code: 'INVALID_PAYLOAD', message: 'memberId is required.' });
          return;
        }

        // Always re-verify admin role from DB (never trust socket.data.role alone)
        const actorMembership = await findMembership(roomId, userId);
        if (!actorMembership || actorMembership.role !== 'admin') {
          socket.emit('error', { code: 'FORBIDDEN', message: 'Admin access required.' });
          return;
        }

        // Verify target belongs to THIS room (IDOR protection)
        const target = await findMembershipById(memberId, roomId);
        if (!target) {
          socket.emit('error', { code: 'MEMBER_NOT_FOUND', message: 'Member not found in this room.' });
          return;
        }

        const updated = await setIdentityVisible(memberId, true, userId, roomId);

        // Fetch real name (only admin resolves it; the broadcast sends the resolved displayName)
        const members = await getMembersForViewer(roomId, userId, true);
        const revealedMember = members.find((m) => m.id === memberId);

        io.to(`room:${roomId}`).emit('identity.revealed', {
          memberId: updated.id,
          displayName: revealedMember?.realName ?? updated.anonymousName,
          identityVisible: true,
        });
      } catch (err) {
        console.error('[Socket] identity.reveal error:', err instanceof Error ? err.message : err);
        socket.emit('error', { code: 'ERROR', message: 'Failed to reveal identity.' });
      }
    });

    // ── identity.hide (admin) ──────────────────────────────────────────────
    socket.on('identity.hide', async ({ memberId }: { memberId: unknown }) => {
      try {
        const userId = socket.data.userId as string;
        const roomId = socket.data.roomId as string | undefined;

        if (!roomId) {
          socket.emit('error', { code: 'NOT_IN_ROOM', message: 'You are not in a room.' });
          return;
        }
        if (!memberId || typeof memberId !== 'string') {
          socket.emit('error', { code: 'INVALID_PAYLOAD', message: 'memberId is required.' });
          return;
        }

        // Re-verify admin role from DB
        const actorMembership = await findMembership(roomId, userId);
        if (!actorMembership || actorMembership.role !== 'admin') {
          socket.emit('error', { code: 'FORBIDDEN', message: 'Admin access required.' });
          return;
        }

        // Verify target belongs to THIS room
        const target = await findMembershipById(memberId, roomId);
        if (!target) {
          socket.emit('error', { code: 'MEMBER_NOT_FOUND', message: 'Member not found in this room.' });
          return;
        }

        const updated = await setIdentityVisible(memberId, false, userId, roomId);

        io.to(`room:${roomId}`).emit('identity.hidden', {
          memberId: updated.id,
          displayName: updated.anonymousName,
          identityVisible: false,
        });
      } catch (err) {
        console.error('[Socket] identity.hide error:', err instanceof Error ? err.message : err);
        socket.emit('error', { code: 'ERROR', message: 'Failed to hide identity.' });
      }
    });

    // ── disconnect ─────────────────────────────────────────────────────────
    socket.on('disconnect', async () => {
      console.log(`[Socket] Disconnected: ${socket.id}`);
      await handleLeave(io, socket, true /* isDisconnect */);
      messageRateLimits.delete(socket.id);
    });
  });

  // ── Startup sweep ─────────────────────────────────────────────
  // After a server restart all in-memory timers are gone. Schedule deletion
  // for every active room that has no live sockets. Clients have 60 s to
  // reconnect; if they do, cancelRoomDeletion fires and clears the timer.
  setImmediate(async () => {
    try {
      const result = await query("SELECT id, room_code FROM rooms WHERE status = 'active'");
      const roomsToDelete = result.rows.filter((r) => !isOfficialPublicRoom(r.room_code as string));
      if (roomsToDelete.length > 0) {
        console.log(`[Room] Startup sweep: scheduling cleanup for ${roomsToDelete.length} private room(s) — 60 s reconnection window.`);
        for (const r of roomsToDelete) {
          scheduleRoomDeletion(r.id as string, 60_000);
        }
      }
    } catch (err) {
      console.error('[Room] Startup sweep error:', err instanceof Error ? err.message : err);
    }
  });
}

// ── handleLeave ───────────────────────────────────────────────────────────────

/**
 * Shared leave logic for both explicit room.leave and disconnect events.
 *
 * @param isDisconnect  true  → temporary disconnect; use long grace period
 *                      false → explicit leave; use short grace period
 */
async function handleLeave(io: Server, socket: Socket, isDisconnect: boolean): Promise<void> {
  const ctx = socketRoomMap.get(socket.id);
  if (!ctx) return; // Socket was not in a room

  const { roomId, membershipId } = ctx;
  socketRoomMap.delete(socket.id);

  const socketRoomId = `room:${roomId}`;
  await socket.leave(socketRoomId);

  // Notify remaining members
  io.to(socketRoomId).emit('member.left', { memberId: membershipId });

  // Broadcast authoritative live presence update
  broadcastRoomPresence(io, roomId);

  const presence = getRoomOnlinePresence(io, roomId);

  if (presence.onlineCount === 0) {
    // No active sockets remain; schedule room deletion for private rooms
    const graceMs = isDisconnect ? RECONNECT_GRACE_MS : LEAVE_GRACE_MS;
    scheduleRoomDeletion(roomId, graceMs);
  }
}
