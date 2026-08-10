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
 *      the DB row is only removed when the active member count is confirmed 0.
 *   5. Temporary disconnects are distinguished from true departures using a
 *      configurable grace period (ROOM_DELETE_DELAY_MS).
 */

import { Server, Socket } from 'socket.io';
import {
  findRoomByCode,
  findMembership,
  getMembersForViewer,
  saveMessage,
  deleteRoom,
  getActiveMemberCount,
  updateMemberStatus,
  logModerationAction,
  setIdentityVisible,
  findMembershipById,
} from '../repositories/roomRepository';
import { verifySession } from '../services/authService';
import { config } from '../config';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SocketContext {
  roomId: string;
  userId: string;
  membershipId: string;
}

// ── State ─────────────────────────────────────────────────────────────────────

/** socket.id → room context */
const socketRoomMap = new Map<string, SocketContext>();

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

  const timer = setTimeout(() => {
    roomDeleteTimers.delete(roomId);
    performRoomDeletion(roomId).catch((err) => {
      console.error(`[Room] Deletion error for ${roomId}:`, err instanceof Error ? err.message : err);
    });
  }, delayMs);

  roomDeleteTimers.set(roomId, timer);
}

/**
 * Race-safe room deletion.
 * Uses roomDeleteInProgress to ensure only one concurrent deletion per room.
 * Re-checks the active member count inside the guard.
 */
async function performRoomDeletion(roomId: string): Promise<void> {
  if (roomDeleteInProgress.has(roomId)) return;
  roomDeleteInProgress.add(roomId);
  try {
    const count = await getActiveMemberCount(roomId);
    if (count === 0) {
      await deleteRoom(roomId);
      console.log(`[Room] Deleted empty room: ${roomId}`);
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

  // ── Authentication middleware ────────────────────────────────────────────
  // All connections must present a valid veil_session cookie.
  // The user ID is resolved server-side from the DB session — never trusted
  // from a client payload.
  io.use(async (socket, next) => {
    try {
      // Parse the veil_session cookie from the handshake headers
      const cookieHeader = socket.handshake.headers.cookie ?? '';
      const match = cookieHeader.match(/(?:^|;\s*)veil_session=([^;]+)/);
      const token = match?.[1];

      if (!token) {
        return next(new Error('Authentication required.'));
      }

      const user = await verifySession(token);
      if (!user) {
        return next(new Error('Invalid or expired session.'));
      }

      // Attach server-resolved identity — client payload is never trusted
      socket.data.userId = user.id;
      socket.data.userName = user.name;
      next();
    } catch {
      next(new Error('Authentication failed.'));
    }
  });

  // ── Connection ────────────────────────────────────────────────────────────

  io.on('connection', (socket: Socket) => {
    // Do not log userId to avoid leaking identity in plain logs
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

        // Verify membership from DB — never trust client-provided role/status
        const membership = await findMembership(room.id, userId);
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

        // If a deletion was pending (e.g. all members briefly disconnected),
        // cancel it now that a member has rejoined
        cancelRoomDeletion(room.id);

        // Store server-side context for this socket
        socketRoomMap.set(socket.id, {
          roomId: room.id,
          userId,
          membershipId: membership.id,
        });
        socket.data.roomId = room.id;
        socket.data.membershipId = membership.id;
        // Store role as a hint — always re-verified from DB for privileged ops
        socket.data.role = membership.role;

        socket.emit('room.joined', {
          roomCode: room.roomCode,
          membership: {
            id: membership.id,
            displayName: membership.anonymousName,
            role: membership.role,
          },
        });

        socket.to(socketRoomId).emit('member.joined', {
          member: {
            id: membership.id,
            displayName: membership.anonymousName,
            avatar: membership.anonymousAvatar,
          },
        });
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
        const membershipId = socket.data.membershipId as string | undefined;

        if (!roomId || !membershipId) {
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

        // Re-verify membership status on every message (mute / ban / remove may
        // have happened since the socket connected)
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

        // Sender comes from the authenticated session — never from the client
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
            senderId: membership.id, // membership id, NOT user id
            createdAt: message.createdAt,
          },
        });
      } catch (err) {
        console.error('[Socket] message.send error:', err instanceof Error ? err.message : err);
        socket.emit('message.rejected', { code: 'ERROR', message: 'Failed to send message.' });
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

  // Count currently online members (sockets in the room namespace)
  // We use getActiveMemberCount (DB) as the source of truth for deletion
  // but check socket room size first for a quick short-circuit
  const roomSockets = io.sockets.adapter.rooms.get(socketRoomId);
  const onlineCount = roomSockets ? roomSockets.size : 0;

  if (onlineCount === 0) {
    // No sockets remain; check DB count and schedule deletion
    const graceMs = isDisconnect ? RECONNECT_GRACE_MS : LEAVE_GRACE_MS;
    scheduleRoomDeletion(roomId, graceMs);
  }
}
