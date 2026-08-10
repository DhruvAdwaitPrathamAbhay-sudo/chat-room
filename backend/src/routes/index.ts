import { Router } from 'express';
import authRoutes from './auth';
import roomRoutes from './rooms';

const router = Router();

router.use('/auth', authRoutes);
router.use('/rooms', roomRoutes);

export default router;
