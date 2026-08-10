import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
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

// All room routes require authentication
router.use(requireAuth);

// Room CRUD
router.post('/', createRoomHandler);
router.get('/:roomCode', getRoomHandler);
router.post('/:roomCode/join', joinRoomHandler);
router.post('/:roomCode/admin-access', adminAccessHandler);
router.post('/:roomCode/close', closeRoomHandler);

// Room data
router.get('/:roomCode/members', getMembersHandler);
router.get('/:roomCode/messages', getMessagesHandler);

// Identity management (admin only — verified in controller)
router.post('/:roomCode/members/:memberId/reveal', revealIdentityHandler);
router.post('/:roomCode/members/:memberId/hide', hideIdentityHandler);

// Moderation (admin only — verified in controller)
router.post('/:roomCode/members/:memberId/mute', muteMemberHandler);
router.post('/:roomCode/members/:memberId/unmute', unmuteMemberHandler);
router.post('/:roomCode/members/:memberId/remove', removeMemberHandler);
router.post('/:roomCode/members/:memberId/ban', banMemberHandler);

// Reports
router.post('/:roomCode/reports', reportMemberHandler);

export default router;
