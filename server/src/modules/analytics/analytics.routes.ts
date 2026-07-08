import { Router } from 'express';
import { authenticate } from '@/middleware/auth.middleware';
import { requireOrganization } from '@/middleware/tenant.middleware';
import analyticsController from './analytics.controller';

const router = Router({ mergeParams: true });
router.use(authenticate, requireOrganization);

router.get('/overview', analyticsController.getOverview);
router.get('/tasks-by-status', analyticsController.getTasksByStatus);
router.get('/velocity', analyticsController.getVelocity);
router.get('/member-activity', analyticsController.getMemberActivity);
router.get('/project-progress', analyticsController.getProjectProgress);

export default router;