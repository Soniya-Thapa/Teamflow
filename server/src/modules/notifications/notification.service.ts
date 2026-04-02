/**
 * @file notification.service.ts
 * @description Notification system + Activity feed service
 *
 * NOTIFICATION SYSTEM:
 * Notifications are per-user messages about events that affect them.
 * Example: "Soniya assigned you to task X"
 *
 * ACTIVITY FEED:
 * Activity logs are org-level audit records of all actions.
 * Example: "Soniya created project X at 2:30pm"
 *
 * DIFFERENCE:
 *   Notification → directed at ONE specific user (personal)
 *   ActivityLog  → visible to org members (organizational)
 *
 * HOW NOTIFICATIONS ARE CREATED:
 * Other services call createNotification() after their mutations.
 * Example: task.service calls it after assigning a task.
 * This service does NOT create notifications itself — it only manages them.
 *
 * Methods:
 *   - createNotification()      → create one notification for one user
 *   - createBulkNotifications() → notify multiple users at once
 *   - listNotifications()       → paginated list, unread first
 *   - markAsRead()              → mark single notification read
 *   - markAllAsRead()           → mark all unread as read
 *   - deleteNotification()      → delete single notification
 *   - getUnreadCount()          → badge count for UI
 *   - getActivityFeed()         → org/user/resource level activity
 */

import { BaseService } from '@/common/BaseService';
import ApiError from '@/utils/ApiError';
import { NotificationType } from '@prisma/client';

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────

export interface CreateNotificationData {
  userId: string;
  organizationId: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Record<string, any>;
}

class NotificationService extends BaseService {

  // ─────────────────────────────────────────
  // CREATE NOTIFICATION
  // ─────────────────────────────────────────

  /**
   * Create a single notification for one user.
   * Called by other services after relevant mutations.
   *
   * Never throws — notification failure should never block the main action.
   * Errors are logged and swallowed.
   *
   * @example
   * // In task.service.ts after assigning a task:
   * await notificationService.createNotification({
   *   userId: assigneeId,
   *   organizationId,
   *   type: NotificationType.TASK_ASSIGNED,
   *   title: 'New task assigned',
   *   message: `${assignerName} assigned "${taskTitle}" to you`,
   *   metadata: { taskId, projectId }
   * });
   */
  async createNotification(data: CreateNotificationData) {
    try {
      const notification = await this.prisma.notification.create({
        data: {
          userId: data.userId,
          organizationId: data.organizationId,
          type: data.type,
          title: data.title,
          message: data.message,
          metadata: data.metadata ?? {},
        },
      });

      this.log('Notification created', {
        userId: data.userId,
        type: data.type,
      });

      return notification;
    } catch (error) {
      // Never throw — notification failure must not block the main action
      this.logError('Failed to create notification', error);
      return null;
    }
  }

  // ─────────────────────────────────────────
  // CREATE BULK NOTIFICATIONS
  // ─────────────────────────────────────────

  /**
   * Create the same notification for multiple users at once.
   * Used when an action affects multiple users simultaneously.
   *
   * @example
   * // Notify all org members when org is suspended
   * await notificationService.createBulkNotifications(
   *   memberUserIds,
   *   organizationId,
   *   NotificationType.ORG_SUSPENDED,
   *   'Organization suspended',
   *   'Your organization has been suspended. Contact support.',
   * );
   */
  async createBulkNotifications(
    userIds: string[],
    organizationId: string,
    type: NotificationType,
    title: string,
    message: string,
    metadata?: Record<string, any>,
  ) {
    if (userIds.length === 0) return;

    try {
      await this.prisma.notification.createMany({
        data: userIds.map(userId => ({
          userId,
          organizationId,
          type,
          title,
          message,
          metadata: metadata ?? {},
        })),
        skipDuplicates: true,
      });

      this.log('Bulk notifications created', {
        count: userIds.length,
        type,
      });
    } catch (error) {
      this.logError('Failed to create bulk notifications', error);
    }
  }

  // ─────────────────────────────────────────
  // LIST NOTIFICATIONS
  // ─────────────────────────────────────────

  /**
   * List notifications for the authenticated user.
   * Unread notifications appear first, then read, ordered by recency.
   *
   * @param userId         - The authenticated user
   * @param organizationId - Filter to current org context
   * @param page           - Page number
   * @param limit          - Items per page
   * @param unreadOnly     - Show only unread notifications
   */
  async listNotifications(
    userId: string,
    organizationId: string,
    page = 1,
    limit = 20,
    unreadOnly = false,
  ) {
    const skip = (page - 1) * limit;

    const where: any = {
      userId,
      organizationId,
      ...(unreadOnly && { isRead: false }),
    };

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { isRead: 'asc' },    // Unread first
          { createdAt: 'desc' }, // Then by recency
        ],
      }),

      this.prisma.notification.count({ where }),
    ]);

    return {
      notifications,
      meta: this.buildPaginationMeta(page, limit, total),
    };
  }

  // ─────────────────────────────────────────
  // MARK AS READ
  // ─────────────────────────────────────────

  /**
   * Mark a single notification as read.
   *
   * @throws 404 - If notification not found or belongs to different user
   */
  async markAsRead(
    notificationId: string,
    userId: string,
    organizationId: string,
  ) {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId,          // Ensure user owns this notification
        organizationId,
      },
    });

    if (!notification) {
      throw ApiError.notFound('Notification not found');
    }

    if (notification.isRead) {
      return { notification }; // Already read — no-op
    }

    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });

    return { notification: updated };
  }

  // ─────────────────────────────────────────
  // MARK ALL AS READ
  // ─────────────────────────────────────────

  /**
   * Mark all unread notifications as read for the current user in this org.
   * Returns count of notifications that were marked read.
   */
  async markAllAsRead(userId: string, organizationId: string) {
    const result = await this.prisma.notification.updateMany({
      where: {
        userId,
        organizationId,
        isRead: false,
      },
      data: { isRead: true },
    });

    return {
      markedCount: result.count,
      message: `${result.count} notification${result.count !== 1 ? 's' : ''} marked as read`,
    };
  }

  // ─────────────────────────────────────────
  // DELETE NOTIFICATION
  // ─────────────────────────────────────────

  /**
   * Delete a single notification.
   *
   * @throws 404 - If notification not found or belongs to different user
   */
  async deleteNotification(
    notificationId: string,
    userId: string,
    organizationId: string,
  ) {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId,
        organizationId,
      },
    });

    if (!notification) {
      throw ApiError.notFound('Notification not found');
    }

    await this.prisma.notification.delete({
      where: { id: notificationId },
    });

    return { message: 'Notification deleted' };
  }

  // ─────────────────────────────────────────
  // GET UNREAD COUNT
  // ─────────────────────────────────────────

  /**
   * Get the count of unread notifications for the badge indicator.
   * Lightweight query — only returns a number, no pagination needed.
   */
  async getUnreadCount(userId: string, organizationId: string) {
    const count = await this.prisma.notification.count({
      where: {
        userId,
        organizationId,
        isRead: false,
      },
    });

    return { unreadCount: count };
  }

  // ─────────────────────────────────────────
  // ACTIVITY FEED
  // ─────────────────────────────────────────

  /**
   * Get activity feed from ActivityLog.
   * Supports three levels:
   *   org-level      → all activity in the org
   *   user-level     → activity by a specific user
   *   resource-level → activity on a specific resource (project, task, etc.)
   *
   * @param organizationId - Organization UUID (always required for tenant isolation)
   * @param filters        - userId, resourceType, resourceId
   * @param page           - Page number
   * @param limit          - Items per page
   */
  async getActivityFeed(
    organizationId: string,
    requesterId: string,
    filters: {
      userId?: string;
      resourceType?: string;
      resourceId?: string;
    },
    page = 1,
    limit = 20,
  ) {
    // Verify requester is an org member
    const member = await this.prisma.organizationMember.findFirst({
      where: {
        userId: requesterId,
        organizationId,
        status: 'ACTIVE',
      },
    });

    if (!member) {
      throw ApiError.forbidden('You are not a member of this organization');
    }

    const skip = (page - 1) * limit;

    const where: any = {
      organizationId, // Always scoped to org — tenant isolation
      ...(filters.userId && { userId: filters.userId }),
      ...(filters.resourceType && { resourceType: filters.resourceType }),
      ...(filters.resourceId && { resourceId: filters.resourceId }),
    };

    const [activities, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),

      this.prisma.activityLog.count({ where }),
    ]);

    return {
      activities,
      meta: this.buildPaginationMeta(page, limit, total),
    };
  }
}

export { NotificationService }; // named export (class)

export const notificationService = new NotificationService(); // instance

export default notificationService; // default export