/**
 * backend/src/routes/admin.ts
 *
 * Global admin routes. Protected exclusively by ADMIN_KEYS — no session needed.
 */

import { Router } from 'express';
import { clearRoomsLimiter } from '../middleware/security';
import { clearAllRoomsHandler } from '../controllers/adminController';

const router = Router();

// POST /api/admin/rooms/clear
// Rate-limited to 3 requests per 60 minutes per IP
router.post('/rooms/clear', clearRoomsLimiter, clearAllRoomsHandler);

export default router;
