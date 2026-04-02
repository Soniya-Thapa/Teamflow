/**
 * @file notification.controller.ts
 * @description HTTP handlers for Notification and Activity Feed endpoints
 */

import { Request, Response } from 'express';
import { BaseController } from '@/common/BaseController';
import notificationService from './notification.service';

class NotificationController extends BaseController {

  // ─────────────────────────────────────────
  // NOTIFICATIONS
  // ─────────────────────────────────────────

  /**
   * GET /api/v1/notifications
   */
  listNotifications = this.asyncHandler(
    async (req: Request, res: Response) => {
      const userId = req.userId!;
      const organizationId = req.organizationId!;
      const { page, limit } = this.getPagination(req);
      const unreadOnly = req.query.unreadOnly === 'true';

      const result = await notificationService.listNotifications(
        userId,
        organizationId,
        page,
        limit,
        unreadOnly,
      );

      return this.sendSuccess(
        res,
        result,
        'Notifications retrieved successfully',
      );
    },
  );

  /**
   * GET /api/v1/notifications/unread-count
   */
  getUnreadCount = this.asyncHandler(
    async (req: Request, res: Response) => {
      const userId = req.userId!;
      const organizationId = req.organizationId!;

      const result = await notificationService.getUnreadCount(
        userId,
        organizationId,
      );

      return this.sendSuccess(res, result, 'Unread count retrieved');
    },
  );

  /**
   * PATCH /api/v1/notifications/:notificationId/read
   */
  markAsRead = this.asyncHandler(async (req: Request, res: Response) => {
    const { notificationId } = req.params;
    const userId = req.userId!;
    const organizationId = req.organizationId!;

    const result = await notificationService.markAsRead(
      notificationId as string,
      userId,
      organizationId,
    );

    return this.sendSuccess(res, result, 'Notification marked as read');
  });

  /**
   * PATCH /api/v1/notifications/read-all
   */
  markAllAsRead = this.asyncHandler(async (req: Request, res: Response) => {
    const userId = req.userId!;
    const organizationId = req.organizationId!;

    const result = await notificationService.markAllAsRead(
      userId,
      organizationId,
    );

    return this.sendSuccess(res, result, result.message);
  });

  /**
   * DELETE /api/v1/notifications/:notificationId
   */
  deleteNotification = this.asyncHandler(
    async (req: Request, res: Response) => {
      const { notificationId } = req.params;
      const userId = req.userId!;
      const organizationId = req.organizationId!;

      const result = await notificationService.deleteNotification(
        notificationId as string,
        userId,
        organizationId,
      );

      return this.sendSuccess(res, result, 'Notification deleted');
    },
  );

  // ─────────────────────────────────────────
  // ACTIVITY FEED
  // ─────────────────────────────────────────

  /**
   * GET /api/v1/activity
   * Supports: ?userId=, ?resourceType=, ?resourceId=
   */
  getActivityFeed = this.asyncHandler(
    async (req: Request, res: Response) => {
      const organizationId = req.organizationId!;
      const requesterId = req.userId!;
      const { page, limit } = this.getPagination(req);
      const { userId, resourceType, resourceId } = req.query as {
        userId?: string;
        resourceType?: string;
        resourceId?: string;
      };

      const result = await notificationService.getActivityFeed(
        organizationId,
        requesterId,
        { userId, resourceType, resourceId },
        page,
        limit,
      );

      return this.sendSuccess(
        res,
        result,
        'Activity feed retrieved successfully',
      );
    },
  );
}

export default new NotificationController();