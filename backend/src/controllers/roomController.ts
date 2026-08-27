import { Request, Response } from 'express';
import { verifyGlobalAdminKey } from '../utils/adminAuth';
import {
  createRoom,
  joinRoomAsMember,
  joinPublicRoom,
  isOfficialPublicRoom,
  authenticateAdmin,
  findRoomByCode,
  findRoomByName,
  findMembershipById,
  getMembersForViewer,
  getMessages,
  findMessageById,
  updateMessage,
  deleteMessage,
  clearRoomMessages,
  setIdentityVisible,
  updateMemberStatus,
  closeRoom,
  logModerationAction,
  findMembership,
} from '../repositories/roomRepository';

function getParam(param: string | string[]): string {
  return Array.isArray(param) ? param[0] : param;
}

// ──────────────────────────────────────────────
// Helper: verify current user is admin in room
// ──────────────────────────────────────────────
async function requireRoomAdmin(
  roomCode: string,
  userId: string
): Promise<{ roomId: string; membershipId: string }> {
  const room = await findRoomByCode(roomCode);
  if (!room) {
    throw Object.assign(new Error('Room not found.'), { statusCode: 404, code: 'ROOM_NOT_FOUND' });
  }
  const membership = await findMembership(room.id, userId);
  if (!membership || membership.role !== 'admin') {
    throw Object.assign(new Error('Admin access required.'), { statusCode: 403, code: 'FORBIDDEN' });
  }
  return { roomId: room.id, membershipId: membership.id };
}

// ──────────────────────────────────────────────
// POST /api/rooms — Create Room
// ──────────────────────────────────────────────
export async function createRoomHandler(req: Request, res: Response): Promise<void> {
  const { name, description, password, adminKey, maxMembers, globalAdminKey } = req.body;
  const userId = req.sessionUser!.userId;

  // 1. Validate Global Admin Key
  if (!globalAdminKey || typeof globalAdminKey !== 'string') {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Invalid admin key.' } });
    return;
  }

  if (!verifyGlobalAdminKey(globalAdminKey)) {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Invalid admin key.' } });
    return;
  }

  // 2. Validate standard room fields
  if (!name || typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 100) {
    res.status(400).json({ success: false, error: { code: 'INVALID_NAME', message: 'Room name must be 1–100 characters.' } });
    return;
  }
  if (!password || typeof password !== 'string' || password.length < 1) {
    res.status(400).json({ success: false, error: { code: 'INVALID_PASSWORD', message: 'A room password is required.' } });
    return;
  }
  if (maxMembers !== undefined && (typeof maxMembers !== 'number' || maxMembers < 2 || maxMembers > 200)) {
    res.status(400).json({ success: false, error: { code: 'INVALID_MAX_MEMBERS', message: 'maxMembers must be between 2 and 200.' } });
    return;
  }

  const result = await createRoom({
    name: name.trim(),
    description: description?.trim(),
    password,
    adminKey,
    maxMembers,
    ownerId: userId,
  });

  res.status(201).json({
    success: true,
    data: {
      room: {
        id: result.room.id,
        roomCode: result.room.roomCode,
        name: result.room.name,
        description: result.room.description,
        maxMembers: result.room.maxMembers,
        status: result.room.status,
      },
      membership: {
        id: result.membership.id,
        anonymousName: result.membership.anonymousName,
        anonymousAvatar: result.membership.anonymousAvatar,
        role: result.membership.role,
        identityVisible: result.membership.identityVisible,
      },
      // Plaintext admin key — shown ONCE to the creator
      adminKey: result.adminKey,
    },
  });
}

// ──────────────────────────────────────────────
// POST /api/rooms/join — Join as Member
// ──────────────────────────────────────────────
export async function joinRoomHandler(req: Request, res: Response): Promise<void> {
  const { realName, roomName, password } = req.body;
  const userId = req.sessionUser!.userId;

  if (!realName || typeof realName !== 'string' || realName.trim().length < 1 || realName.trim().length > 100) {
    res.status(400).json({ success: false, error: { code: 'INVALID_REAL_NAME', message: 'Real Name is required (1–100 characters).' } });
    return;
  }

  if (!roomName || typeof roomName !== 'string' || roomName.trim().length < 1) {
    res.status(400).json({ success: false, error: { code: 'INVALID_ROOM_NAME', message: 'Room name is required.' } });
    return;
  }

  if (!password || typeof password !== 'string' || password.length < 1) {
    res.status(400).json({ success: false, error: { code: 'INVALID_PASSWORD', message: 'Room password is required.' } });
    return;
  }

  const room = await findRoomByName(roomName.trim());
  if (!room) {
    res.status(403).json({ success: false, error: { code: 'INVALID_ROOM_CREDENTIALS', message: 'Invalid room name or password.' } });
    return;
  }

  try {
    const { membership } = await joinRoomAsMember(room.id, userId, password, realName.trim());
    req.sessionUser!.name = realName.trim();

    res.json({
      success: true,
      data: {
        room: {
          id: room.id,
          roomCode: room.roomCode,
          name: room.name,
          description: room.description,
        },
        membership: {
          id: membership.id,
          anonymousName: membership.anonymousName,
          anonymousAvatar: membership.anonymousAvatar,
          role: membership.role,
          identityVisible: membership.identityVisible,
        },
      },
    });
  } catch (err: unknown) {
    const errorObj = err as { code?: string };
    if (
      errorObj.code === 'INVALID_ROOM_CREDENTIALS' ||
      errorObj.code === 'ROOM_CLOSED' ||
      errorObj.code === 'ROOM_NOT_FOUND'
    ) {
      res.status(403).json({
        success: false,
        error: { code: 'INVALID_ROOM_CREDENTIALS', message: 'Invalid room name or password.' },
      });
      return;
    }
    throw err;
  }
}

// ──────────────────────────────────────────────
// POST /api/rooms/:roomCode/admin-access
// ──────────────────────────────────────────────
export async function adminAccessHandler(req: Request, res: Response): Promise<void> {
  const roomCode = Array.isArray(req.params.roomCode) ? req.params.roomCode[0] : req.params.roomCode;
  const { password, adminKey } = req.body;
  const userId = req.sessionUser!.userId;

  if (!password || !adminKey) {
    res.status(400).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Password and Admin Key are required.' } });
    return;
  }

  const { room, membership } = await authenticateAdmin(roomCode, userId, password, adminKey);

  res.json({
    success: true,
    data: {
      room: {
        id: room.id,
        roomCode: room.roomCode,
        name: room.name,
        description: room.description,
      },
      membership: {
        id: membership.id,
        anonymousName: membership.anonymousName,
        anonymousAvatar: membership.anonymousAvatar,
        role: membership.role,
        identityVisible: membership.identityVisible,
      },
    },
  });
}

// ──────────────────────────────────────────────
// POST /api/rooms/public/:slug/join — Join Public Room (Guest)
// ──────────────────────────────────────────────
export async function joinPublicRoomHandler(req: Request, res: Response): Promise<void> {
  const rawParam = req.params.slug || req.body?.slug || req.body?.roomCode;
  const slug = getParam(rawParam || '');
  const userId = req.sessionUser!.userId;

  if (!slug || !isOfficialPublicRoom(slug)) {
    res.status(404).json({ success: false, error: { code: 'ROOM_NOT_FOUND', message: 'Public room not found.' } });
    return;
  }

  const result = await joinPublicRoom(slug, userId);
  res.json({
    success: true,
    data: {
      room: {
        id: result.room.id,
        roomCode: result.room.roomCode,
        name: result.room.name,
        description: result.room.description,
        isPublic: true,
      },
      membership: {
        id: result.membership.id,
        anonymousName: result.membership.anonymousName,
        anonymousAvatar: result.membership.anonymousAvatar,
        role: result.membership.role,
        identityVisible: result.membership.identityVisible,
      },
    },
  });
}

// ──────────────────────────────────────────────
// GET /api/rooms/:roomCode — Get Room
// ──────────────────────────────────────────────
export async function getRoomHandler(req: Request, res: Response): Promise<void> {
  const roomCode = Array.isArray(req.params.roomCode) ? req.params.roomCode[0] : req.params.roomCode;
  const userId = req.sessionUser!.userId;

  const room = await findRoomByCode(roomCode);
  if (!room) {
    res.status(404).json({ success: false, error: { code: 'ROOM_NOT_FOUND', message: "This room doesn't exist." } });
    return;
  }

  let membership = await findMembership(room.id, userId);

  // If this is an official public room and the user doesn't have membership yet, auto-join them
  if (!membership && isOfficialPublicRoom(room.roomCode)) {
    const joined = await joinPublicRoom(room.roomCode, userId);
    membership = joined.membership;
  }

  if (!membership || ['removed', 'banned'].includes(membership.status)) {
    res.status(403).json({ success: false, error: { code: 'NOT_A_MEMBER', message: 'You are not a member of this room.' } });
    return;
  }

  let onlineCount = 0;
  try {
    const { getIo, getRoomOnlinePresence } = await import('../socket');
    const presence = getRoomOnlinePresence(getIo(), room.id);
    onlineCount = presence.onlineCount;
  } catch {
    // Socket not yet initialized
  }

  res.json({
    success: true,
    data: {
      room: {
        id: room.id,
        roomCode: room.roomCode,
        name: room.name,
        description: room.description,
        maxMembers: room.maxMembers,
        status: room.status,
      },
      membership: {
        id: membership.id,
        anonymousName: membership.anonymousName,
        anonymousAvatar: membership.anonymousAvatar,
        role: membership.role,
        identityVisible: membership.identityVisible,
        status: membership.status,
      },
      onlineCount,
    },
  });
}

// ──────────────────────────────────────────────
// GET /api/rooms/:roomCode/members
// ──────────────────────────────────────────────
export async function getMembersHandler(req: Request, res: Response): Promise<void> {
  const roomCode = Array.isArray(req.params.roomCode) ? req.params.roomCode[0] : req.params.roomCode;
  const userId = req.sessionUser!.userId;

  const room = await findRoomByCode(roomCode);
  if (!room) {
    res.status(404).json({ success: false, error: { code: 'ROOM_NOT_FOUND', message: "This room doesn't exist." } });
    return;
  }

  let onlineCount = 0;
  let onlineMemberIds = new Set<string>();
  try {
    const { getIo, getRoomOnlinePresence } = await import('../socket');
    const presence = getRoomOnlinePresence(getIo(), room.id);
    onlineCount = presence.onlineCount;
    onlineMemberIds = new Set(presence.onlineMemberIds);
  } catch {
    // Socket not yet initialized
  }

  const isPublic = isOfficialPublicRoom(room.roomCode);

  // ── PUBLIC ROOM: Any visitor is permitted to see active members ──
  if (isPublic) {
    const rawMembers = await getMembersForViewer(room.id, userId, false);
    const members = rawMembers.map((m) => ({
      ...m,
      isOnline: onlineMemberIds.has(m.id),
    }));
    res.json({ success: true, data: { members, onlineCount } });
    return;
  }

  // ── PRIVATE ROOM: Enforce strict private membership check ──
  const viewerMembership = await findMembership(room.id, userId);
  if (!viewerMembership || ['removed', 'banned'].includes(viewerMembership.status)) {
    res.status(403).json({ success: false, error: { code: 'NOT_A_MEMBER', message: 'You are not a member of this room.' } });
    return;
  }

  const isAdmin = viewerMembership.role === 'admin';
  const rawMembers = await getMembersForViewer(room.id, userId, isAdmin);
  const members = rawMembers.map((m) => ({
    ...m,
    isOnline: onlineMemberIds.has(m.id),
  }));

  res.json({ success: true, data: { members, onlineCount } });
}

// ──────────────────────────────────────────────
// GET /api/rooms/:roomCode/messages
// ──────────────────────────────────────────────
export async function getMessagesHandler(req: Request, res: Response): Promise<void> {
  const roomCode = getParam(req.params.roomCode);
  const userId = req.sessionUser!.userId;
  const before = req.query.before as string | undefined;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 50);

  const room = await findRoomByCode(roomCode);
  if (!room) {
    res.status(404).json({ success: false, error: { code: 'ROOM_NOT_FOUND', message: "This room doesn't exist." } });
    return;
  }

  const isPublic = isOfficialPublicRoom(room.roomCode);

  // ── PUBLIC ROOM: Any visitor is permitted to read permitted messages ──
  if (isPublic) {
    const messages = await getMessages(room.id, limit, before, true /* isPublic: filter >= 24h */);
    const nextCursor = messages.length > 0 ? messages[0].id : null;
    res.json({ success: true, data: { messages, nextCursor } });
    return;
  }

  // ── PRIVATE ROOM: Enforce strict private membership check ──
  const membership = await findMembership(room.id, userId);
  if (!membership || ['removed', 'banned'].includes(membership.status)) {
    res.status(403).json({ success: false, error: { code: 'NOT_A_MEMBER', message: 'You are not a member of this room.' } });
    return;
  }

  const messages = await getMessages(room.id, limit, before, false);
  const nextCursor = messages.length > 0 ? messages[0].id : null;

  res.json({ success: true, data: { messages, nextCursor } });
}

// ──────────────────────────────────────────────
// POST /api/rooms/:roomCode/members/:memberId/reveal
// ──────────────────────────────────────────────
export async function revealIdentityHandler(req: Request, res: Response): Promise<void> {
  const roomCode = getParam(req.params.roomCode);
  const memberId = getParam(req.params.memberId);
  const userId = req.sessionUser!.userId;

  const { roomId } = await requireRoomAdmin(roomCode, userId);

  // Target member must belong to THIS room
  const target = await findMembershipById(memberId, roomId);
  if (!target) {
    res.status(404).json({ success: false, error: { code: 'MEMBER_NOT_FOUND', message: 'Member not found in this room.' } });
    return;
  }

  const updated = await setIdentityVisible(memberId, true, userId, roomId);
  await logModerationAction(roomId, userId, target.userId, 'identity_revealed');

  // Fetch real name for the broadcast (admin-resolved; not exposed to normal members
  // before this action, but now officially revealed to all room participants)
  const viewerMembers = await getMembersForViewer(roomId, userId, true);
  const revealedMember = viewerMembers.find((m) => m.id === memberId);
  const displayName = revealedMember?.realName ?? updated.anonymousName;

  const io = req.app.get('io');
  io.to(`room:${roomId}`).emit('identity.revealed', {
    memberId: updated.id,
    displayName,
    identityVisible: true,
  });

  res.json({ success: true, data: { member: updated } });
}

// ──────────────────────────────────────────────
// POST /api/rooms/:roomCode/members/:memberId/hide
// ──────────────────────────────────────────────
export async function hideIdentityHandler(req: Request, res: Response): Promise<void> {
  const roomCode = getParam(req.params.roomCode);
  const memberId = getParam(req.params.memberId);
  const userId = req.sessionUser!.userId;

  const { roomId } = await requireRoomAdmin(roomCode, userId);

  // Target member must belong to THIS room
  const target = await findMembershipById(memberId, roomId);
  if (!target) {
    res.status(404).json({ success: false, error: { code: 'MEMBER_NOT_FOUND', message: 'Member not found in this room.' } });
    return;
  }

  const updated = await setIdentityVisible(memberId, false, userId, roomId);
  await logModerationAction(roomId, userId, target.userId, 'identity_hidden');

  const io = req.app.get('io');
  io.to(`room:${roomId}`).emit('identity.hidden', {
    memberId: updated.id,
    displayName: updated.anonymousName,
    identityVisible: false,
  });

  res.json({ success: true, data: { member: updated } });
}

// ──────────────────────────────────────────────
// POST /api/rooms/:roomCode/members/:memberId/mute
// ──────────────────────────────────────────────
export async function muteMemberHandler(req: Request, res: Response): Promise<void> {
  const roomCode = getParam(req.params.roomCode);
  const memberId = getParam(req.params.memberId);
  const userId = req.sessionUser!.userId;

  const { roomId } = await requireRoomAdmin(roomCode, userId);

  // Target member must belong to THIS room
  const target = await findMembershipById(memberId, roomId);
  if (!target) {
    res.status(404).json({ success: false, error: { code: 'MEMBER_NOT_FOUND', message: 'Member not found in this room.' } });
    return;
  }

  // Cannot mute another admin
  if (target.role === 'admin') {
    res.status(403).json({ success: false, error: { code: 'CANNOT_MUTE_ADMIN', message: 'Cannot mute the room admin.' } });
    return;
  }

  await updateMemberStatus(memberId, 'muted');
  await logModerationAction(roomId, userId, target.userId, 'member_muted');

  const io = req.app.get('io');
  io.to(`room:${roomId}`).emit('member.muted', { memberId });

  res.json({ success: true, data: { memberId } });
}

// ──────────────────────────────────────────────
// POST /api/rooms/:roomCode/members/:memberId/unmute
// ──────────────────────────────────────────────
export async function unmuteMemberHandler(req: Request, res: Response): Promise<void> {
  const roomCode = getParam(req.params.roomCode);
  const memberId = getParam(req.params.memberId);
  const userId = req.sessionUser!.userId;

  const { roomId } = await requireRoomAdmin(roomCode, userId);

  // Target member must belong to THIS room
  const target = await findMembershipById(memberId, roomId);
  if (!target) {
    res.status(404).json({ success: false, error: { code: 'MEMBER_NOT_FOUND', message: 'Member not found in this room.' } });
    return;
  }

  await updateMemberStatus(memberId, 'active');
  await logModerationAction(roomId, userId, target.userId, 'member_unmuted');

  const io = req.app.get('io');
  io.to(`room:${roomId}`).emit('member.unmuted', { memberId });

  res.json({ success: true, data: { memberId } });
}

// ──────────────────────────────────────────────
// POST /api/rooms/:roomCode/members/:memberId/remove
// ──────────────────────────────────────────────
export async function removeMemberHandler(req: Request, res: Response): Promise<void> {
  const roomCode = getParam(req.params.roomCode);
  const memberId = getParam(req.params.memberId);
  const userId = req.sessionUser!.userId;

  const { roomId } = await requireRoomAdmin(roomCode, userId);

  // Target member must belong to THIS room
  const target = await findMembershipById(memberId, roomId);
  if (!target) {
    res.status(404).json({ success: false, error: { code: 'MEMBER_NOT_FOUND', message: 'Member not found in this room.' } });
    return;
  }

  // Cannot remove another admin
  if (target.role === 'admin') {
    res.status(403).json({ success: false, error: { code: 'CANNOT_REMOVE_ADMIN', message: 'Cannot remove the admin.' } });
    return;
  }

  await updateMemberStatus(memberId, 'removed');
  await logModerationAction(roomId, userId, target.userId, 'member_removed');

  const io = req.app.get('io');
  io.to(`room:${roomId}`).emit('member.removed', { memberId });

  res.json({ success: true, data: { memberId } });
}

// ──────────────────────────────────────────────
// POST /api/rooms/:roomCode/members/:memberId/ban
// ──────────────────────────────────────────────
export async function banMemberHandler(req: Request, res: Response): Promise<void> {
  const roomCode = getParam(req.params.roomCode);
  const memberId = getParam(req.params.memberId);
  const userId = req.sessionUser!.userId;

  const { roomId } = await requireRoomAdmin(roomCode, userId);

  // Target member must belong to THIS room
  const target = await findMembershipById(memberId, roomId);
  if (!target) {
    res.status(404).json({ success: false, error: { code: 'MEMBER_NOT_FOUND', message: 'Member not found in this room.' } });
    return;
  }

  // Cannot ban another admin
  if (target.role === 'admin') {
    res.status(403).json({ success: false, error: { code: 'CANNOT_BAN_ADMIN', message: 'Cannot ban the admin.' } });
    return;
  }

  await updateMemberStatus(memberId, 'banned');
  await logModerationAction(roomId, userId, target.userId, 'member_banned');

  const io = req.app.get('io');
  io.to(`room:${roomId}`).emit('member.banned', { memberId });

  res.json({ success: true });
}

// ──────────────────────────────────────────────
// POST /api/rooms/:roomCode/close — Admin Close Room
// ──────────────────────────────────────────────
export async function closeRoomHandler(req: Request, res: Response): Promise<void> {
  const roomCode = Array.isArray(req.params.roomCode) ? req.params.roomCode[0] : req.params.roomCode;
  const userId = req.sessionUser!.userId;

  const room = await findRoomByCode(roomCode);
  if (!room) {
    res.status(404).json({ success: false, error: { code: 'ROOM_NOT_FOUND', message: "This room doesn't exist." } });
    return;
  }

  // Idempotent — if already closed, succeed silently
  if (room.status === 'closed') {
    res.json({ success: true });
    return;
  }

  // Verify the requesting user is the room admin
  const membership = await findMembership(room.id, userId);
  if (!membership || membership.role !== 'admin') {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Only the room admin can close the room.' } });
    return;
  }

  // Mark room as CLOSED in the database FIRST
  await closeRoom(room.id);
  await logModerationAction(room.id, userId, userId, 'room_closed');

  // Notify all connected members AFTER the DB update so they receive an
  // authoritative status. The socket layer will handle final deletion when
  // the last member disconnects (natural lifecycle).
  const io = req.app.get('io');
  io.to(`room:${room.id}`).emit('room.closed', {
    roomCode: room.roomCode,
    message: 'The room has been closed by the admin.',
  });

  // Do NOT delete the room here — deletion is handled by the socket disconnect
  // handler once all members have left, ensuring no data loss for in-flight
  // messages and proper cleanup ordering.

  res.json({ success: true });
}

// ──────────────────────────────────────────────
// POST /api/rooms/:roomCode/reports
// ──────────────────────────────────────────────
export async function reportMemberHandler(req: Request, res: Response): Promise<void> {
  const roomCode = Array.isArray(req.params.roomCode) ? req.params.roomCode[0] : req.params.roomCode;
  const { reportedMemberId, messageId, reason } = req.body;
  const userId = req.sessionUser!.userId;

  if (!reason || typeof reason !== 'string') {
    res.status(400).json({ success: false, error: { code: 'INVALID_REASON', message: 'A reason is required.' } });
    return;
  }

  const room = await findRoomByCode(roomCode);
  if (!room) {
    res.status(404).json({ success: false, error: { code: 'ROOM_NOT_FOUND', message: "This room doesn't exist." } });
    return;
  }

  const reporterMembership = await findMembership(room.id, userId);
  if (!reporterMembership) {
    res.status(403).json({ success: false, error: { code: 'NOT_A_MEMBER', message: 'You are not a member of this room.' } });
    return;
  }

  // Get target user_id from membership id
  const targetMembership = reportedMemberId
    ? await findMembershipById(reportedMemberId, room.id)
    : null;

  const { query: dbQuery } = await import('../config/db');
  await dbQuery(
    `INSERT INTO reports (room_id, reporter_id, reported_user_id, message_id, reason)
     VALUES ($1, $2, $3, $4, $5)`,
    [room.id, userId, targetMembership?.userId || null, messageId || null, reason.trim()]
  );

  res.json({ success: true, message: 'Report submitted.' });
}

// ──────────────────────────────────────────────
// PATCH /api/rooms/:roomCode/messages/:messageId
// ──────────────────────────────────────────────
export async function updateMessageHandler(req: Request, res: Response): Promise<void> {
  const roomCode = getParam(req.params.roomCode);
  const messageId = getParam(req.params.messageId);
  const userId = req.sessionUser!.userId;
  const { content } = req.body;

  if (!content || typeof content !== 'string' || content.trim().length < 1 || content.trim().length > 2000) {
    res.status(400).json({ success: false, error: { code: 'INVALID_MESSAGE', message: 'Message must be 1–2000 characters.' } });
    return;
  }

  const room = await findRoomByCode(roomCode);
  if (!room) {
    res.status(404).json({ success: false, error: { code: 'ROOM_NOT_FOUND', message: "This room doesn't exist." } });
    return;
  }

  const target = await findMessageById(messageId);
  if (!target) {
    res.status(404).json({ success: false, error: { code: 'MESSAGE_NOT_FOUND', message: 'Message not found.' } });
    return;
  }

  if (target.roomId !== room.id) {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Message does not belong to this room.' } });
    return;
  }

  // Only the AUTHOR can edit their own message
  if (target.senderId !== userId) {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You can only edit your own messages.' } });
    return;
  }

  const updated = await updateMessage(messageId, content.trim());

  // Broadcast update via Socket.IO if initialized
  try {
    const { getIo } = await import('../socket');
    getIo().to(`room:${room.id}`).emit('message.updated', {
      messageId: updated.id,
      content: updated.content,
      isEdited: true,
    });
  } catch {
    // Socket broadcast is best-effort for REST
  }

  res.json({
    success: true,
    data: {
      message: {
        id: updated.id,
        content: updated.content,
        isEdited: true,
      },
    },
  });
}

// ──────────────────────────────────────────────
// DELETE /api/rooms/:roomCode/messages/:messageId
// ──────────────────────────────────────────────
export async function deleteMessageHandler(req: Request, res: Response): Promise<void> {
  const roomCode = getParam(req.params.roomCode);
  const messageId = getParam(req.params.messageId);
  const userId = req.sessionUser!.userId;

  const room = await findRoomByCode(roomCode);
  if (!room) {
    res.status(404).json({ success: false, error: { code: 'ROOM_NOT_FOUND', message: "This room doesn't exist." } });
    return;
  }

  const target = await findMessageById(messageId);
  if (!target) {
    res.status(404).json({ success: false, error: { code: 'MESSAGE_NOT_FOUND', message: 'Message not found.' } });
    return;
  }

  if (target.roomId !== room.id) {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Message does not belong to this room.' } });
    return;
  }

  // Only the author or room admin can delete
  const isAuthor = target.senderId === userId;
  let isAdmin = false;
  if (!isAuthor) {
    const membership = await findMembership(room.id, userId);
    isAdmin = membership?.role === 'admin';
  }

  if (!isAuthor && !isAdmin) {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You can only delete your own messages.' } });
    return;
  }

  await deleteMessage(messageId);

  // Broadcast deletion via Socket.IO if initialized
  try {
    const { getIo } = await import('../socket');
    getIo().to(`room:${room.id}`).emit('message.deleted', {
      messageId,
    });
  } catch {
    // Socket broadcast is best-effort for REST
  }

  res.json({ success: true, message: 'Message deleted.' });
}

// ──────────────────────────────────────────────
// POST /api/rooms/:roomCode/clear-messages  (Admin — clear all messages)
// ──────────────────────────────────────────────
export async function clearRoomMessagesHandler(req: Request, res: Response): Promise<void> {
  const roomCode = getParam(req.params.roomCode);
  const userId = req.sessionUser!.userId;

  const room = await findRoomByCode(roomCode);
  if (!room) {
    res.status(404).json({ success: false, error: { code: 'ROOM_NOT_FOUND', message: "This room doesn't exist." } });
    return;
  }

  // Verify requester is an admin of this specific room
  const membership = await findMembership(room.id, userId);
  if (!membership || membership.role !== 'admin') {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Only room admins can clear messages.' } });
    return;
  }

  const count = await clearRoomMessages(room.id);
  await logModerationAction(room.id, userId, userId, 'room_messages_cleared');

  // Broadcast to room: all clients should wipe their local message list
  try {
    const { getIo } = await import('../socket');
    getIo().to(`room:${room.id}`).emit('room.messages.cleared', {
      roomId: room.id,
      roomCode: room.roomCode,
    });
  } catch {
    // best-effort
  }

  res.json({
    success: true,
    data: { clearedCount: count, message: 'All messages in this room have been cleared.' },
  });
}
