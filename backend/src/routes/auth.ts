import { Router } from 'express';
import { join, me, logout } from '../controllers/authController';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

// POST /api/auth/join — create/get user and set session cookie
router.post('/join', join);

// GET /api/auth/me — return current authenticated user
router.get('/me', requireAuth, me);

// POST /api/auth/logout — destroy session
router.post('/logout', requireAuth, logout);

export default router;
