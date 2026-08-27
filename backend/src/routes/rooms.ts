import { Router } from 'express';
import { requireAuth, ensureAuth } from '../middleware/requireAuth';
import {
  createRoomHandler,
  joinRoomHandler,
  joinPublicRoomHandler,
  adminAccessHandler,
  getRoomHandler,
  getMembersHandler,
  getMessagesHandler,
  updateMessageHandler,
  deleteMessageHandler,
  revealIdentityHandler,
  hideIdentityHandler,
  muteMemberHandler,
  unmuteMemberHandler,
  removeMemberHandler,
  banMemberHandler,
  closeRoomHandler,
  reportMemberHandler,
} from '../controllers/roomController';

const router = Router();

// Room Creation & Joins auto-provision user session if absent
router.post('/', ensureAuth, createRoomHandler);
router.post('/join', ensureAuth, joinRoomHandler);
router.post('/public/:slug/join', ensureAuth, joinPublicRoomHandler);
router.post('/:roomCode/admin-access', ensureAuth, adminAccessHandler);

// Protected room routes (ensureAuth auto-creates anonymous session for new public guests)
router.get('/:roomCode', ensureAuth, getRoomHandler);
router.post('/:roomCode/close', requireAuth, closeRoomHandler);

// Room data
router.get('/:roomCode/members', ensureAuth, getMembersHandler);
router.get('/:roomCode/messages', ensureAuth, getMessagesHandler);
router.patch('/:roomCode/messages/:messageId', ensureAuth, updateMessageHandler);
router.delete('/:roomCode/messages/:messageId', ensureAuth, deleteMessageHandler);

// Identity management (admin only — verified in controller + DB)
router.post('/:roomCode/members/:memberId/reveal', requireAuth, revealIdentityHandler);
router.post('/:roomCode/members/:memberId/hide', requireAuth, hideIdentityHandler);

// Moderation (admin only — verified in controller + DB)
router.post('/:roomCode/members/:memberId/mute', requireAuth, muteMemberHandler);
router.post('/:roomCode/members/:memberId/unmute', requireAuth, unmuteMemberHandler);
router.post('/:roomCode/members/:memberId/remove', requireAuth, removeMemberHandler);
router.post('/:roomCode/members/:memberId/ban', requireAuth, banMemberHandler);

// Reports
router.post('/:roomCode/reports', requireAuth, reportMemberHandler);

export default router;
