/**
 * @file task.routes.ts
 * @description Express router for task and comment endpoints.
 *
 * KEY CONCEPTS:
 * - All routes require authenticate + requireOrganization (applied at top)
 * - Bulk routes defined BEFORE /:taskId to avoid param conflicts
 * - /overdue defined before /:taskId for same reason
 * - requireTaskAccess('delete') enforces ownership for delete
 * - requireCommentAccess() enforces comment ownership for update/delete
 * - Watchers: any org member can watch; only self or ADMIN+ can remove
 *
 * Route Tree:
 *   GET    /                             → list tasks
 *   POST   /                             → create task
 *   GET    /overdue                      → get overdue tasks
 *   PATCH  /bulk/status                  → bulk update status
 *   PATCH  /bulk/assign                  → bulk assign
 *   DELETE /bulk                         → bulk delete
 *   GET    /:taskId                      → get task
 *   PATCH  /:taskId                      → update task
 *   DELETE /:taskId                      → delete task
 *   GET    /:taskId/activity             → task activity log
 *   GET    /:taskId/watchers             → list watchers
 *   POST   /:taskId/watchers             → add watcher
 *   DELETE /:taskId/watchers/:userId     → remove watcher
 *   GET    /:taskId/comments             → list comments
 *   POST   /:taskId/comments             → create comment
 *   PATCH  /:taskId/comments/:commentId  → update comment (owner only)
 *   DELETE /:taskId/comments/:commentId  → delete comment (owner or admin)
 *   GET    /:taskId/subtasks             → list subtasks
 *   POST   /:taskId/subtasks             → create subtask
 */

import { Router } from 'express';
import { authenticate } from '@/middleware/auth.middleware';
import { requireOrganization } from '@/middleware/tenant.middleware';
import { requirePermission } from '@/middleware/permission.middleware';
import { validate } from '@/middleware/validation.middleware';
import taskController from './task.controller';
import {
  createTaskSchema,
  updateTaskSchema,
  listTasksSchema,
  taskParamSchema,
  bulkUpdateStatusSchema,
  bulkAssignSchema,
  bulkDeleteSchema,
  createCommentSchema,
  updateCommentSchema,
  listCommentsSchema,
  commentParamSchema,
  addWatcherSchema,
  watcherParamSchema,
  createSubtaskSchema,
   assignTaskSchema,
  removeAssigneeSchema,
} from './task.validation';
import { requireCommentAccess, requireTaskAccess } from '@/middleware/resource.middleware';

const router = Router({ mergeParams: true });

// Apply auth + tenant middleware to all routes
router.use(authenticate, requireOrganization);

// ─────────────────────────────────────────
// TASK COLLECTION ROUTES
// ─────────────────────────────────────────

router.get(
  '/',
  validate(listTasksSchema),
  requirePermission('task:read'),
  taskController.list,
);

router.post(
  '/',
  validate(createTaskSchema),
  requirePermission('task:create'),
  taskController.create,
);

// ─────────────────────────────────────────
// SPECIAL COLLECTION ROUTES (before /:taskId)
// ─────────────────────────────────────────

router.get('/overdue', requirePermission('task:read'), taskController.getOverdue);

router.patch(
  '/bulk/status',
  validate(bulkUpdateStatusSchema),
  requirePermission('task:update'),
  taskController.bulkUpdateStatus,
);

router.patch(
  '/bulk/assign',
  validate(bulkAssignSchema),
  requirePermission('task:update'),
  taskController.bulkAssign,
);

router.delete(
  '/bulk',
  validate(bulkDeleteSchema),
  requirePermission('task:delete'),
  taskController.bulkDelete,
);

// ─────────────────────────────────────────
// ASSIGNEES (before /:taskId to avoid conflicts)
// ─────────────────────────────────────────

router.get(
  '/:taskId/assignees',
  validate(taskParamSchema),
  requirePermission('task:read'),
  taskController.listAssignees,
);

router.post(
  '/:taskId/assignees',
  validate(assignTaskSchema),
  requirePermission('task:assign'),
  taskController.assignTask,
);

router.delete(
  '/:taskId/assignees/:userId',
  validate(removeAssigneeSchema),
  requirePermission('task:assign'),
  taskController.removeAssignee,
);

// ─────────────────────────────────────────
// TASK ITEM ROUTES
// ─────────────────────────────────────────

router.get(
  '/:taskId',
  validate(taskParamSchema),
  requirePermission('task:read'),
  taskController.findById,
);

router.patch(
  '/:taskId',
  validate(updateTaskSchema),
  requirePermission('task:update'),
  taskController.update,
);

router.delete(
  '/:taskId',
  validate(taskParamSchema),
  requirePermission('task:delete'),
  requireTaskAccess('delete'), // ← only OWNER/ADMIN or creator can delete
  taskController.remove,
);

// ─────────────────────────────────────────
// TASK ACTIVITY
// ─────────────────────────────────────────

router.get(
  '/:taskId/activity',
  validate(taskParamSchema),
  requirePermission('task:read'),
  taskController.getActivity,
);

// ─────────────────────────────────────────
// TASK WATCHERS
// ─────────────────────────────────────────

router.get(
  '/:taskId/watchers',
  validate(taskParamSchema),
  requirePermission('task:read'),
  taskController.listWatchers,
);

router.post(
  '/:taskId/watchers',
  validate(addWatcherSchema),
  requirePermission('task:read'),
  taskController.addWatcher,
);

router.delete(
  '/:taskId/watchers/:userId',
  validate(watcherParamSchema),
  requirePermission('task:read'),
  taskController.removeWatcher,
);

// ─────────────────────────────────────────
// TASK COMMENTS
// ─────────────────────────────────────────

router.get(
  '/:taskId/comments',
  validate(listCommentsSchema),
  requirePermission('comment:read'),
  taskController.listComments,
);

router.post(
  '/:taskId/comments',
  validate(createCommentSchema),
  requirePermission('comment:create'),
  taskController.createComment,
);

router.patch(
  '/:taskId/comments/:commentId',
  validate(updateCommentSchema),
  requirePermission('comment:update'),
    requireCommentAccess('update'),
  taskController.updateComment,
);

router.delete(
  '/:taskId/comments/:commentId',
  validate(commentParamSchema),
  requirePermission('comment:delete'),
  requireCommentAccess('delete'),
  taskController.deleteComment,
);

// ─────────────────────────────────────────
// SUBTASKS
// ─────────────────────────────────────────

router.get(
  '/:taskId/subtasks',
  validate(taskParamSchema),
  requirePermission('task:read'),
  taskController.listSubtasks,
);

router.post(
  '/:taskId/subtasks',
  validate(createSubtaskSchema),
  requirePermission('task:create'),
  taskController.createSubtask,
);

export default router;



// **Test tenant isolation** (access task from wrong org — should fail):
// ```
// GET /api/v1/organizations/<org-B-id>/tasks/<org-A-task-id>
// Authorization: Bearer {{orgB_token}}

// Expected: 404 Task not found