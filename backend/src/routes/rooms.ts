import { Router } from 'express';
import { requireAuth, ensureAuth } from '../middleware/requireAuth';
import {
  createRoomHandler,
  joinRoomHandler,
  adminAccessHandler,
  getRoomHandler,
  getMembersHandler,
  getMessagesHandler,
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
router.post('/:roomCode/admin-access', ensureAuth, adminAccessHandler);

// Protected room routes require existing active session
router.get('/:roomCode', requireAuth, getRoomHandler);
router.post('/:roomCode/close', requireAuth, closeRoomHandler);

// Room data
router.get('/:roomCode/members', requireAuth, getMembersHandler);
router.get('/:roomCode/messages', requireAuth, getMessagesHandler);

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
