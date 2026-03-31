/**
 * @file project.validation.ts
 * @description Zod validation schemas for project endpoints
 *
 * Projects are always scoped to an organization.
 * organizationId comes from req.organizationId (set by requireOrganization)
 * never from request body — tenant context always comes from middleware.
 *
 * VISIBILITY:
 *   PUBLIC  → all active org members can read
 *   PRIVATE → only ProjectMember records can read (plus OWNER/ADMIN)
 */

import { z } from 'zod';

// ─────────────────────────────────────────
// SHARED
// ─────────────────────────────────────────

const projectParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid organization ID'),
    projectId: z.string().uuid('Invalid project ID'),
  }),
});

// ─────────────────────────────────────────
// PROJECT CRUD
// ─────────────────────────────────────────

/**
 * POST /organizations/:id/projects
 */
export const createProjectSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid organization ID'),
  }),
  body: z.object({
    name: z
      .string()
      .min(2, 'Project name must be at least 2 characters')
      .max(100, 'Project name cannot exceed 100 characters'),
    description: z
      .string()
      .max(1000, 'Description cannot exceed 1000 characters')
      .optional(),
    teamId: z
      .string()
      .uuid('Invalid team ID')
      .optional(),
    visibility: z
      .enum(['PUBLIC', 'PRIVATE'])
      .default('PUBLIC'),
    startDate: z
      .string()
      .datetime('Invalid date format')
      .optional(),
    endDate: z
      .string()
      .datetime('Invalid date format')
      .optional(),
  }),
});

/**
 * PATCH /organizations/:id/projects/:projectId
 */
export const updateProjectSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid organization ID'),
    projectId: z.string().uuid('Invalid project ID'),
  }),
  body: z.object({
    name: z
      .string()
      .min(2)
      .max(100)
      .optional(),
    description: z
      .string()
      .max(1000)
      .nullable()
      .optional(),
    teamId: z
      .string()
      .uuid('Invalid team ID')
      .nullable()
      .optional(),
    visibility: z
      .enum(['PUBLIC', 'PRIVATE'])
      .optional(),
    startDate: z
      .string()
      .datetime()
      .nullable()
      .optional(),
    endDate: z
      .string()
      .datetime()
      .nullable()
      .optional(),
  }).refine(
    (data) => Object.keys(data).length > 0,
    { message: 'At least one field must be provided for update' },
  ),
});

/**
 * GET /organizations/:id/projects
 */
export const listProjectsSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid organization ID'),
  }),
  query: z.object({
    page: z
      .string()
      .optional()
      .transform(val => parseInt(val || '1')),
    limit: z
      .string()
      .optional()
      .transform(val => parseInt(val || '10')),
    search: z.string().optional(),
    status: z
      .enum(['ACTIVE', 'ARCHIVED', 'COMPLETED'])
      .optional(),
    teamId: z
      .string()
      .uuid()
      .optional(),
    visibility: z
      .enum(['PUBLIC', 'PRIVATE'])
      .optional(),
    sortBy: z
      .enum(['name', 'createdAt', 'updatedAt', 'status'])
      .optional()
      .default('createdAt'),
    sortOrder: z
      .enum(['asc', 'desc'])
      .optional()
      .default('desc'),
    favorites: z
      .string()
      .optional()
      .transform(val => val === 'true'),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  }),
});

/**
 * GET /organizations/:id/projects/:projectId
 * DELETE /organizations/:id/projects/:projectId
 */
export const projectParamOnlySchema = projectParamSchema;

// ─────────────────────────────────────────
// PROJECT MEMBERS
// ─────────────────────────────────────────

/**
 * POST /organizations/:id/projects/:projectId/members
 */
export const addProjectMemberSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid organization ID'),
    projectId: z.string().uuid('Invalid project ID'),
  }),
  body: z.object({
    userId: z.string().uuid('Invalid user ID'),
  }),
});

/**
 * DELETE /organizations/:id/projects/:projectId/members/:memberId
 */
export const removeProjectMemberSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid organization ID'),
    projectId: z.string().uuid('Invalid project ID'),
    memberId: z.string().uuid('Invalid member ID'),
  }),
});

// ─────────────────────────────────────────
// PROJECT DUPLICATION
// ─────────────────────────────────────────

/**
 * POST /organizations/:id/projects/:projectId/duplicate
 */
export const duplicateProjectSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid organization ID'),
    projectId: z.string().uuid('Invalid project ID'),
  }),
  body: z.object({
    name: z
      .string()
      .min(2)
      .max(100)
      .optional(), // If not provided, uses "Copy of <original name>"
    includeTasks: z
      .boolean()
      .default(true), // Whether to copy tasks skeleton
  }),
});