/**
 * @file notification.routes.ts
 * @description Routes for Notifications and Activity Feed
 *
 * All routes require authentication + organization context.
 * organizationId comes from X-Organization-ID header
 * (these routes are NOT nested under /organizations/:id)
 *
 * ROUTES:
 *   GET    /notifications                        → list notifications
 *   GET    /notifications/unread-count           → badge count
 *   PATCH  /notifications/read-all              → mark all read
 *   PATCH  /notifications/:notificationId/read  → mark one read
 *   DELETE /notifications/:notificationId       → delete one
 *   GET    /activity                            → activity feed
 */

import { Router } from 'express';
import { authenticate } from '@/middleware/auth.middleware';
import { requireOrganization } from '@/middleware/tenant.middleware';
import notificationController from './notification.controller';

const router = Router({ mergeParams: true });

// All notification routes require auth + org context
router.use(authenticate, requireOrganization);

// ─────────────────────────────────────────
// NOTIFICATIONS
// IMPORTANT: static paths before /:notificationId
// ─────────────────────────────────────────

router.get('/', notificationController.listNotifications);

// Static paths defined BEFORE /:notificationId
router.get('/unread-count', notificationController.getUnreadCount);
router.patch('/read-all', notificationController.markAllAsRead);

// Dynamic paths after static ones
router.patch('/:notificationId/read', notificationController.markAsRead);
router.delete('/:notificationId', notificationController.deleteNotification);

export default router;