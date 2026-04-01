/**
 * @file task.validation.ts
 * @description Zod validation schemas for task and comment endpoints.
 *
 * KEY CONCEPTS:
 * - Reuses idParamSchema and paginationSchema from common/validators.ts
 * - Task status transitions validated at service layer (not schema level)
 * - Bulk operations accept arrays with min/max length constraints
 * - Comment ownership checked via requireCommentAccess middleware
 *
 * Schemas:
 * - createTaskSchema         POST /tasks
 * - updateTaskSchema         PATCH /tasks/:taskId
 * - listTasksSchema          GET /tasks
 * - bulkUpdateStatusSchema   PATCH /tasks/bulk/status
 * - bulkAssignSchema         PATCH /tasks/bulk/assign
 * - bulkDeleteSchema         DELETE /tasks/bulk
 * - createCommentSchema      POST /tasks/:taskId/comments
 * - updateCommentSchema      PATCH /tasks/:taskId/comments/:commentId
 * - listCommentsSchema       GET /tasks/:taskId/comments
 * - addWatcherSchema         POST /tasks/:taskId/watchers
 * - createSubtaskSchema      POST /tasks/:taskId/subtasks
 */

import { z } from 'zod';
import { idParamSchema, paginationSchema } from '@/common/validators';

// ─────────────────────────────────────────
// TASK SCHEMAS
// ─────────────────────────────────────────

export const createTaskSchema = z.object({
  params: z.object({
    id: z.string().uuid('Organization ID must be a valid UUID'),
  }),
  body: z.object({
    projectId: z.string().uuid('Project ID must be a valid UUID'),
    title: z
      .string()
      .min(1, 'Title is required')
      .max(255, 'Title must be at most 255 characters')
      .trim(),
    description: z.string().max(10000, 'Description too long').trim().optional(),
    status: z
      .enum(['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'])
      .optional()
      .default('TODO'),
    priority: z
      .enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
      .optional()
      .default('MEDIUM'),
    assignedTo: z
      .string()
      .uuid('Assignee must be a valid UUID')
      .optional()
      .nullable(),
    dueDate: z.string().datetime().optional().nullable(),
    estimatedHours: z
      .number()
      .int()
      .min(0)
      .max(10000)
      .optional()
      .nullable(),
    parentTaskId: z
      .string()
      .uuid('Parent task ID must be a valid UUID')
      .optional()
      .nullable(),
  }),
});

export const updateTaskSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
    taskId: z.string().uuid(),
  }),
  body: z
    .object({
      title: z
        .string()
        .min(1)
        .max(255)
        .trim()
        .optional(),
      description: z.string().max(10000).trim().optional().nullable(),
      status: z
        .enum(['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'])
        .optional(),
      priority: z
        .enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
        .optional(),
      assignedTo: z
        .string()
        .uuid()
        .optional()
        .nullable(),
      dueDate: z.string().datetime().optional().nullable(),
      estimatedHours: z.number().int().min(0).max(10000).optional().nullable(),
      actualHours: z.number().int().min(0).max(10000).optional().nullable(),
      parentTaskId: z.string().uuid().optional().nullable(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided',
    }),
});

export const listTasksSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  query: paginationSchema.shape.query.extend({
    projectId: z.string().uuid().optional(),
    status: z.enum(['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE']).optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
    assignedTo: z.string().uuid().optional(),
    createdBy: z.string().uuid().optional(),
    dueBefore: z.string().datetime().optional(),
    dueAfter: z.string().datetime().optional(),
    isOverdue: z
      .string()
      .transform((val) => val === 'true')
      .optional(),
    search: z.string().max(100).trim().optional(),
    parentTaskId: z.string().uuid().optional().nullable(),
    sortBy: z
      .enum(['createdAt', 'updatedAt', 'dueDate', 'priority', 'title'])
      .optional()
      .default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  }),
});

export const taskParamSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
    taskId: z.string().uuid(),
  }),
});

// ─────────────────────────────────────────
// BULK OPERATION SCHEMAS
// ─────────────────────────────────────────

export const bulkUpdateStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    taskIds: z
      .array(z.string().uuid())
      .min(1, 'At least one task is required')
      .max(100, 'Cannot update more than 100 tasks at once'),
    status: z.enum(['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE']),
  }),
});

export const bulkAssignSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    taskIds: z
      .array(z.string().uuid())
      .min(1, 'At least one task is required')
      .max(100, 'Cannot assign more than 100 tasks at once'),
    assignedTo: z.string().uuid().nullable(),
  }),
});

export const bulkDeleteSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    taskIds: z
      .array(z.string().uuid())
      .min(1, 'At least one task is required')
      .max(100, 'Cannot delete more than 100 tasks at once'),
  }),
});

// ─────────────────────────────────────────
// COMMENT SCHEMAS
// ─────────────────────────────────────────

export const createCommentSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
    taskId: z.string().uuid(),
  }),
  body: z.object({
    content: z
      .string()
      .min(1, 'Comment content is required')
      .max(5000, 'Comment must be at most 5000 characters')
      .trim(),
  }),
});

export const updateCommentSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
    taskId: z.string().uuid(),
    commentId: z.string().uuid(),
  }),
  body: z
    .object({
      content: z
        .string()
        .min(1)
        .max(5000)
        .trim()
        .optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided',
    }),
});

export const listCommentsSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
    taskId: z.string().uuid(),
  }),
  query: paginationSchema.shape.query,
});

export const commentParamSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
    taskId: z.string().uuid(),
    commentId: z.string().uuid(),
  }),
});

// ─────────────────────────────────────────
// WATCHER SCHEMAS
// ─────────────────────────────────────────

export const addWatcherSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
    taskId: z.string().uuid(),
  }),
  body: z.object({
    userId: z.string().uuid('User ID must be a valid UUID'),
  }),
});

export const watcherParamSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
    taskId: z.string().uuid(),
    userId: z.string().uuid(),
  }),
});

// ─────────────────────────────────────────
// SUBTASK SCHEMAS
// ─────────────────────────────────────────

export const createSubtaskSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
    taskId: z.string().uuid(),
  }),
  body: z.object({
    title: z
      .string()
      .min(1, 'Subtask title is required')
      .max(255)
      .trim(),
    description: z.string().max(10000).trim().optional(),
    status: z.enum(['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE']).optional().default('TODO'),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional().default('MEDIUM'),
    assignedTo: z.string().uuid().optional().nullable(),
    dueDate: z.string().datetime().optional().nullable(),
    estimatedHours: z.number().int().min(0).max(10000).optional().nullable(),
  }),
});

// POST /organizations/:id/tasks/:taskId/assignees
export const assignTaskSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
    taskId: z.string().uuid(),
  }),
  body: z.object({
    userId: z.string().uuid('User ID must be a valid UUID'),
    isPrimary: z.boolean().default(true),
    // true  = Scenario 1: replace previous assignees (Soniya replaced by Ram)
    // false = Scenario 2: add alongside existing (Ram added to help Soniya)
    replacePrevious: z.boolean().default(true),
  }),
});

// DELETE /organizations/:id/tasks/:taskId/assignees/:userId
export const removeAssigneeSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
    taskId: z.string().uuid(),
    userId: z.string().uuid(),
  }),
});