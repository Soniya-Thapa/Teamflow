/**
 * @file member.validation.ts
 * @description Zod validation schemas for organization member endpoints
 *
 * Member management is org-scoped — all routes live under
 * /organizations/:id/members and require active org membership.
 *
 * ROLE RULES:
 * - OWNER cannot be assigned via update — use transfer ownership endpoint
 * - Only OWNER can transfer ownership
 * - OWNER/ADMIN can manage roles
 * - Any member can view members (member:read permission)
 */

import { z } from 'zod';

// ─────────────────────────────────────────
// LIST MEMBERS
// ─────────────────────────────────────────

/**
 * GET /organizations/:id/members
 */
export const listMembersSchema = z.object({
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
    role: z
      .enum(['OWNER', 'ADMIN', 'MEMBER', 'GUEST'])
      .optional(),
    status: z
      .enum(['ACTIVE', 'INVITED', 'SUSPENDED'])
      .optional()
      .default('ACTIVE'),
  }),
});

// ─────────────────────────────────────────
// GET SINGLE MEMBER
// ─────────────────────────────────────────

/**
 * GET /organizations/:id/members/:memberId
 */
export const getMemberSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid organization ID'),
    memberId: z.string().uuid('Invalid member ID'),
  }),
});

// ─────────────────────────────────────────
// UPDATE MEMBER ROLE
// ─────────────────────────────────────────

/**
 * PATCH /organizations/:id/members/:memberId/role
 * Only OWNER or ADMIN can update roles.
 * OWNER role cannot be assigned via this endpoint.
 */
export const updateMemberRoleSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid organization ID'),
    memberId: z.string().uuid('Invalid member ID'),
  }),
  body: z.object({
    role: z.enum(['ADMIN', 'MEMBER', 'GUEST'], {
      message: 'Role must be ADMIN, MEMBER, or GUEST. Use transfer-ownership to change OWNER.',
    }),
  }),
});

// ─────────────────────────────────────────
// REMOVE MEMBER
// ─────────────────────────────────────────

/**
 * DELETE /organizations/:id/members/:memberId
 */
export const removeMemberSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid organization ID'),
    memberId: z.string().uuid('Invalid member ID'),
  }),
});

// ─────────────────────────────────────────
// TRANSFER OWNERSHIP
// ─────────────────────────────────────────

/**
 * POST /organizations/:id/members/transfer-ownership
 * Only the current OWNER can transfer ownership.
 * Target must be an active ADMIN.
 */
export const transferOwnershipSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid organization ID'),
  }),
  body: z.object({
    newOwnerUserId: z
      .string()
      .uuid('Invalid user ID'),
  }),
});

// ─────────────────────────────────────────
// MEMBER PROFILE
// ─────────────────────────────────────────

/**
 * GET /organizations/:id/members/:memberId/profile
 */
export const memberProfileSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid organization ID'),
    memberId: z.string().uuid('Invalid member ID'),
  }),
});