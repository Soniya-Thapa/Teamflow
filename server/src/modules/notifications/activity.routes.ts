/**
 * @file activity.routes.ts
 * @description Routes for Activity Feed
 */

import { Router } from 'express';
import { authenticate } from '@/middleware/auth.middleware';
import { requireOrganization } from '@/middleware/tenant.middleware';
import notificationController from './notification.controller';

const router = Router({ mergeParams: true });

router.use(authenticate, requireOrganization);

router.get('/', notificationController.getActivityFeed);

export default router;