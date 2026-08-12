/**
 * backend/src/controllers/adminController.ts
 *
 * Global admin operations protected exclusively by ADMIN_KEYS.
 * No session/room authorization — only the Global Admin Key is accepted.
 *
 * Security:
 *  - Key verified via constant-time comparison (verifyGlobalAdminKey)
 *  - Key is NEVER logged, NEVER returned in any response
 *  - Returns only a count — no deleted content, no user data
 */

import { Request, Response } from 'express';
import { verifyGlobalAdminKey } from '../utils/adminAuth';
import { clearAllRooms } from '../repositories/roomRepository';
import { getIo } from '../socket';

// ──────────────────────────────────────────────
// POST /api/admin/rooms/clear
// ──────────────────────────────────────────────

export async function clearAllRoomsHandler(req: Request, res: Response): Promise<void> {
  const { globalAdminKey } = req.body;

  // 1. Validate and verify the Global Admin Key
  if (!globalAdminKey || typeof globalAdminKey !== 'string') {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Invalid admin key.' } });
    return;
  }

  if (!verifyGlobalAdminKey(globalAdminKey)) {
    // Generic response — does NOT indicate which key is valid or how many exist
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Invalid admin key.' } });
    return;
  }

  try {
    // 2. Notify all connected clients BEFORE deletion so they can redirect
    const io = getIo();
    const adapterRooms = io.sockets.adapter.rooms;

    // Emit room.closed to every socket room that looks like 'room:<uuid>'
    const roomPattern = /^room:[0-9a-f-]+$/i;
    for (const [socketRoomId] of adapterRooms) {
      if (roomPattern.test(socketRoomId)) {
        io.to(socketRoomId).emit('room.closed', {
          roomCode: null,
          message: 'This room has been cleared by the global administrator.',
        });
      }
    }

    // 3. Permanently destroy all rooms and dependent data (transaction)
    const deletedRooms = await clearAllRooms();

    console.log(`[Admin] Cleared all rooms. Deleted: ${deletedRooms}`);

    // 4. Return only the count — no deleted content
    res.json({ success: true, deletedRooms });
  } catch (err) {
    console.error('[Admin] clearAllRooms error:', err instanceof Error ? err.message : err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to clear rooms.' } });
  }
}
