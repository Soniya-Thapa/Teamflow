/**
 * @file team.validation.ts
 * @description Zod validation schemas for team endpoints
 *
 * All team operations are scoped to an organization.
 * organizationId comes from the X-Organization-ID header (req.organizationId)
 * not from the request body — never trust the client for tenant context.
 */

import { z } from 'zod';
import { paginationSchema } from '@/common/validators';

// ─────────────────────────────────────────
// SHARED
// ─────────────────────────────────────────

const teamIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid organization ID'),
    teamId: z.string().uuid('Invalid team ID'),
  }),
});

// ─────────────────────────────────────────
// TEAM CRUD
// ─────────────────────────────────────────

/**
 * POST /organizations/:id/teams
 * Create a new team
 */
export const createTeamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid organization ID'),
  }),
  body: z.object({
    name: z
      .string()
      .min(2, 'Team name must be at least 2 characters')
      .max(100, 'Team name cannot exceed 100 characters'),
    description: z
      .string()
      .max(500, 'Description cannot exceed 500 characters')
      .optional(),
    leaderId: z
      .string()
      .uuid('Invalid leader ID')
      .optional(),
  }),
});

/**
 * PATCH /organizations/:id/teams/:teamId
 * Update team details
 */
export const updateTeamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid organization ID'),
    teamId: z.string().uuid('Invalid team ID'),
  }),
  body: z.object({
    name: z
      .string()
      .min(2, 'Team name must be at least 2 characters')
      .max(100)
      .optional(),
    description: z
      .string()
      .max(500)
      .nullable()
      .optional(),
    leaderId: z
      .string()
      .uuid('Invalid leader ID')
      .nullable()
      .optional(),
  }).refine(
    (data) => Object.keys(data).length > 0,
    { message: 'At least one field must be provided for update' },
  ),
});

/**
 * GET /organizations/:id/teams
 * List teams with pagination and optional search
 */
export const listTeamsSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid organization ID'),
  }),
  query: z.object({
    page: z.string().optional().transform(val => parseInt(val || '1')),
    limit: z.string().optional().transform(val => parseInt(val || '10')),
    search: z.string().optional(),
  }),
});

/**
 * GET /organizations/:id/teams/:teamId
 * DELETE /organizations/:id/teams/:teamId
 */
export const teamParamSchema = teamIdParamSchema;

// ─────────────────────────────────────────
// TEAM MEMBER MANAGEMENT
// ─────────────────────────────────────────

/**
 * POST /organizations/:id/teams/:teamId/members
 * Add a member to a team
 */
export const addTeamMemberSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid organization ID'),
    teamId: z.string().uuid('Invalid team ID'),
  }),
  body: z.object({
    userId: z.string().uuid('Invalid user ID'),
    role: z.enum(['TEAM_LEAD', 'MEMBER']).default('MEMBER'),
  }),
});

/**
 * PATCH /organizations/:id/teams/:teamId/members/:memberId
 * Update a team member's role
 */
export const updateTeamMemberSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid organization ID'),
    teamId: z.string().uuid('Invalid team ID'),
    memberId: z.string().uuid('Invalid member ID'),
  }),
  body: z.object({
    role: z.enum(['TEAM_LEAD', 'MEMBER']),
  }),
});

/**
 * DELETE /organizations/:id/teams/:teamId/members/:memberId
 * Remove a member from a team
 */
export const removeTeamMemberSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid organization ID'),
    teamId: z.string().uuid('Invalid team ID'),
    memberId: z.string().uuid('Invalid member ID'),
  }),
});