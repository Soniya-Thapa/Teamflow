/**
 * @file task.controller.ts
 * @description Thin controller for task and comment endpoints.
 *
 * KEY CONCEPTS:
 * - Always extracts userId from req.userId! and organizationId from req.organizationId!
 * - memberRole extracted from req.memberRole for project-visibility checks
 * - No business logic here — delegates entirely to taskService
 * - Bulk endpoints use req.body arrays
 * - Comment endpoints scoped under task (taskId from params)
 *
 * Handlers:
 *   Tasks: create, findById, list, update, remove
 *   Bulk:  bulkUpdateStatus, bulkAssign, bulkDelete
 *   Overdue/Activity: getOverdue, getActivity
 *   Watchers: addWatcher, removeWatcher, listWatchers
 *   Comments: createComment, listComments, updateComment, deleteComment
 *   Subtasks: createSubtask, listSubtasks
 */

import { Request, Response } from 'express';
import { BaseController } from '@/common/BaseController';
import taskService from './task.service';

class TaskController extends BaseController {
  // ─────────────────────────────────────────
  // TASK CRUD
  // ─────────────────────────────────────────

  /** POST /organizations/:id/tasks */
  create = this.asyncHandler(async (req: Request, res: Response) => {
    const userId = req.userId!;
    const organizationId = req.organizationId!;
    const memberRole = req.memberRole!;
    const { projectId, title, description, status, priority, assignedTo, dueDate, estimatedHours, parentTaskId } = req.body;

    const result = await taskService.create(userId, organizationId, memberRole, {
      projectId,
      title,
      description,
      status,
      priority,
      assignedTo,
      dueDate,
      estimatedHours,
      parentTaskId,
    });

    return this.sendCreated(res, result, 'Task created successfully');
  });

  /** GET /organizations/:id/tasks/:taskId */
  findById = this.asyncHandler(async (req: Request, res: Response) => {
    const userId = req.userId!;
    const organizationId = req.organizationId!;
    const memberRole = req.memberRole!;
    const { taskId } = req.params;

    const result = await taskService.findById(userId, organizationId, taskId as string, memberRole);
    return this.sendSuccess(res, result, 'Task retrieved successfully');
  });

  /** GET /organizations/:id/tasks */
  list = this.asyncHandler(async (req: Request, res: Response) => {
    const userId = req.userId!;
    const organizationId = req.organizationId!;
    const {
      page,
      limit,
      projectId,
      status,
      priority,
      assignedTo,
      createdBy,
      dueBefore,
      dueAfter,
      isOverdue,
      search,
      parentTaskId,
      sortBy,
      sortOrder,
    } = req.query as Record<string, string>;

    const result = await taskService.list(userId, organizationId, {
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      projectId,
      status: status as any,
      priority: priority as any,
      assignedTo,
      createdBy,
      dueBefore,
      dueAfter,
      isOverdue: isOverdue === 'true',
      search,
      parentTaskId: parentTaskId === 'null' ? null : parentTaskId,
      sortBy,
      sortOrder: sortOrder as 'asc' | 'desc',
    });

    return this.sendSuccess(res, result, 'Tasks retrieved successfully');
  });

  /** PATCH /organizations/:id/tasks/:taskId */
  update = this.asyncHandler(async (req: Request, res: Response) => {
    const userId = req.userId!;
    const organizationId = req.organizationId!;
    const memberRole = req.memberRole!; 
    const { taskId } = req.params;
    const { title, description, status, priority, assignedTo, dueDate, estimatedHours, actualHours, parentTaskId } = req.body;

    const result = await taskService.update(userId, organizationId, taskId as string, {
      title,
      description,
      status,
      priority,
      assignedTo,
      dueDate,
      estimatedHours,
      actualHours,
      parentTaskId,
    }, memberRole);

    return this.sendSuccess(res, result, 'Task updated successfully');
  });

  /** DELETE /organizations/:id/tasks/:taskId */
  remove = this.asyncHandler(async (req: Request, res: Response) => {
    const userId = req.userId!;
    const organizationId = req.organizationId!;
    const { taskId } = req.params;

    const result = await taskService.delete(userId, organizationId, taskId as string);
    return this.sendSuccess(res, result, 'Task deleted successfully');
  });

  // ─────────────────────────────────────────
// ASSIGNEES
// ─────────────────────────────────────────

/** GET /organizations/:id/tasks/:taskId/assignees */
listAssignees = this.asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organizationId!;
  const { taskId } = req.params;

  const result = await taskService.listAssignees(organizationId, taskId as string);
  return this.sendSuccess(res, result, 'Assignees retrieved successfully');
});

/** POST /organizations/:id/tasks/:taskId/assignees */
assignTask = this.asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const organizationId = req.organizationId!;
  const { taskId } = req.params;
  const { userId: targetUserId, isPrimary, replacePrevious } = req.body;

  const result = await taskService.assignTask(
    userId,
    organizationId,
    taskId as string,
    targetUserId,
    isPrimary,
    replacePrevious,
  );

  return this.sendCreated(res, result, 'Task assigned successfully');
});

/** DELETE /organizations/:id/tasks/:taskId/assignees/:userId */
removeAssignee = this.asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const organizationId = req.organizationId!;
  const { taskId, userId: targetUserId } = req.params;

  const result = await taskService.removeAssignee(
    userId,
    organizationId,
    taskId as string,
    targetUserId as string,
  );

  return this.sendSuccess(res, result, 'Assignee removed successfully');
});

  // ─────────────────────────────────────────
  // BULK OPERATIONS
  // ─────────────────────────────────────────

  /** PATCH /organizations/:id/tasks/bulk/status */
  bulkUpdateStatus = this.asyncHandler(async (req: Request, res: Response) => {
    const userId = req.userId!;
    const organizationId = req.organizationId!;
    const { taskIds, status } = req.body;

    const result = await taskService.bulkUpdateStatus(userId, organizationId, taskIds, status);
    return this.sendSuccess(res, result, `${result.updated} tasks updated to ${status}`);
  });

  /** PATCH /organizations/:id/tasks/bulk/assign */
  bulkAssign = this.asyncHandler(async (req: Request, res: Response) => {
    const userId = req.userId!;
    const organizationId = req.organizationId!;
    const { taskIds, assignedTo } = req.body;

    const result = await taskService.bulkAssign(userId, organizationId, taskIds, assignedTo);
    return this.sendSuccess(res, result, `${result.updated} tasks assigned`);
  });

  /** DELETE /organizations/:id/tasks/bulk */
  bulkDelete = this.asyncHandler(async (req: Request, res: Response) => {
    const userId = req.userId!;
    const organizationId = req.organizationId!;
    const { taskIds } = req.body;

    const result = await taskService.bulkDelete(userId, organizationId, taskIds);
    return this.sendSuccess(res, result, `${result.deleted} tasks deleted`);
  });

  // ─────────────────────────────────────────
  // OVERDUE & ACTIVITY
  // ─────────────────────────────────────────

  /** GET /organizations/:id/tasks/overdue */
  getOverdue = this.asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.organizationId!;
    const { projectId, assignedTo, page, limit } = req.query as Record<string, string>;

    const result = await taskService.getOverdue(organizationId, {
      projectId,
      assignedTo,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });

    return this.sendSuccess(res, result, 'Overdue tasks retrieved successfully');
  });

  /** GET /organizations/:id/tasks/:taskId/activity */
  getActivity = this.asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.organizationId!;
    const { taskId } = req.params;
    const { page, limit } = req.query as Record<string, string>;

    const result = await taskService.getActivity(organizationId, taskId as string, {
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });

    return this.sendSuccess(res, result, 'Task activity retrieved successfully');
  });

  // ─────────────────────────────────────────
  // WATCHERS
  // ─────────────────────────────────────────

  /** GET /organizations/:id/tasks/:taskId/watchers */
  listWatchers = this.asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.organizationId!;
    const { taskId } = req.params;

    const result = await taskService.listWatchers(organizationId, taskId as string);
    return this.sendSuccess(res, result, 'Watchers retrieved successfully');
  });

  /** POST /organizations/:id/tasks/:taskId/watchers */
  addWatcher = this.asyncHandler(async (req: Request, res: Response) => {
    const userId = req.userId!;
    const organizationId = req.organizationId!;
    const { taskId } = req.params;
    const { userId: watcherUserId } = req.body;

    const result = await taskService.addWatcher(userId, organizationId, taskId as string, watcherUserId);
    return this.sendCreated(res, result, 'Watcher added successfully');
  });

  /** DELETE /organizations/:id/tasks/:taskId/watchers/:userId */
  removeWatcher = this.asyncHandler(async (req: Request, res: Response) => {
    const userId = req.userId!;
    const organizationId = req.organizationId!;
    const { taskId, userId: watcherUserId } = req.params;

    const result = await taskService.removeWatcher(userId, organizationId, taskId as string, watcherUserId as string);
    return this.sendSuccess(res, result, 'Watcher removed successfully');
  });

  // ─────────────────────────────────────────
  // COMMENTS
  // ─────────────────────────────────────────

  /** POST /organizations/:id/tasks/:taskId/comments */
  createComment = this.asyncHandler(async (req: Request, res: Response) => {
    const userId = req.userId!;
    const organizationId = req.organizationId!;
    const { taskId } = req.params;
    const { content } = req.body;

    const result = await taskService.createComment(userId, organizationId, taskId as string, content);
    return this.sendCreated(res, result, 'Comment created successfully');
  });

  /** GET /organizations/:id/tasks/:taskId/comments */
  listComments = this.asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.organizationId!;
    const { taskId } = req.params;
    const { page, limit } = req.query as Record<string, string>;

    const result = await taskService.listComments(organizationId, taskId as string, {
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });

    return this.sendSuccess(res, result, 'Comments retrieved successfully');
  });

  /** PATCH /organizations/:id/tasks/:taskId/comments/:commentId */
  updateComment = this.asyncHandler(async (req: Request, res: Response) => {
    const userId = req.userId!;
    const organizationId = req.organizationId!;
    const { commentId } = req.params;
    const { content } = req.body;

    const result = await taskService.updateComment(userId, organizationId, commentId as string, content);
    return this.sendSuccess(res, result, 'Comment updated successfully');
  });

  /** DELETE /organizations/:id/tasks/:taskId/comments/:commentId */
  deleteComment = this.asyncHandler(async (req: Request, res: Response) => {
    const userId = req.userId!;
    const organizationId = req.organizationId!;
    const { commentId } = req.params;

    const result = await taskService.deleteComment(userId, organizationId, commentId as string);
    return this.sendSuccess(res, result, 'Comment deleted successfully');
  });

  // ─────────────────────────────────────────
  // SUBTASKS
  // ─────────────────────────────────────────

  /** POST /organizations/:id/tasks/:taskId/subtasks */
  createSubtask = this.asyncHandler(async (req: Request, res: Response) => {
    const userId = req.userId!;
    const organizationId = req.organizationId!;
    const memberRole = req.memberRole!;
    const { taskId } = req.params;
    const { title, description, status, priority, assignedTo, dueDate, estimatedHours } = req.body;

    const result = await taskService.createSubtask(userId, organizationId, memberRole, taskId as string, {
      title,
      description,
      status,
      priority,
      assignedTo,
      dueDate,
      estimatedHours,
    });

    return this.sendCreated(res, result, 'Subtask created successfully');
  });

  /** GET /organizations/:id/tasks/:taskId/subtasks */
  listSubtasks = this.asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.organizationId!;
    const { taskId } = req.params;

    const result = await taskService.listSubtasks(organizationId, taskId as string);
    return this.sendSuccess(res, result, 'Subtasks retrieved successfully');
  });
}

export default new TaskController();