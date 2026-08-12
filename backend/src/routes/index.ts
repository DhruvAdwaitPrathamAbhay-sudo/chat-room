import { Router } from 'express';
import authRoutes from './auth';
import roomRoutes from './rooms';
import adminRoutes from './admin';

const router = Router();

router.use('/auth', authRoutes);
router.use('/rooms', roomRoutes);
router.use('/admin', adminRoutes);

export default router;
