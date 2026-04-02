/**
 * @file member.routes.ts
 * @description Routes for Organization Member management
 *
 * PERMISSION MAPPING:
 *   GET  /                       → member:read
 *   GET  /search                 → member:read
 *   GET  /:memberId              → member:read
 *   GET  /:memberId/profile      → member:read
 *   PATCH /:memberId/role        → member:manage
 *   DELETE /:memberId            → member:remove
 *   POST /transfer-ownership     → OWNER only (checked in service)
 *
 * NOTE ON ORDERING:
 * /search and /transfer-ownership must be defined BEFORE /:memberId
 * otherwise Express matches them as :memberId = 'search'.
 *
 * ROUTES:
 *   GET    /organizations/:id/members                          → list members
 *   GET    /organizations/:id/members/search                   → search members
 *   POST   /organizations/:id/members/transfer-ownership       → transfer ownership
 *   GET    /organizations/:id/members/:memberId                → get member
 *   GET    /organizations/:id/members/:memberId/profile        → member profile
 *   PATCH  /organizations/:id/members/:memberId/role           → update role
 *   DELETE /organizations/:id/members/:memberId                → remove member
 */

import { Router } from 'express';
import { authenticate } from '@/middleware/auth.middleware';
import { requireOrganization } from '@/middleware/tenant.middleware';
import { requirePermission } from '@/middleware/permission.middleware';
import { validate } from '@/middleware/validation.middleware';
import memberController from './member.controller';
import {
  listMembersSchema,
  getMemberSchema,
  updateMemberRoleSchema,
  removeMemberSchema,
  transferOwnershipSchema,
  memberProfileSchema,
} from './member.validation';

const router = Router({ mergeParams: true });

// Apply auth + org context to ALL member routes
router.use(authenticate, requireOrganization);

// ─────────────────────────────────────────
// LIST + SEARCH (defined before /:memberId)
// ─────────────────────────────────────────

router.get(
  '/',
  validate(listMembersSchema),
  requirePermission('member:read'),
  memberController.listMembers,
);

// IMPORTANT: /search before /:memberId to avoid Express matching 'search' as memberId
router.get(
  '/search',
  requirePermission('member:read'),
  memberController.searchMembers,
);

// IMPORTANT: /transfer-ownership before /:memberId
router.post(
  '/transfer-ownership',
  validate(transferOwnershipSchema),
  memberController.transferOwnership,
);

// ─────────────────────────────────────────
// SINGLE MEMBER
// ─────────────────────────────────────────

router.get(
  '/:memberId',
  validate(getMemberSchema),
  requirePermission('member:read'),
  memberController.getMember,
);

router.get(
  '/:memberId/profile',
  validate(memberProfileSchema),
  requirePermission('member:read'),
  memberController.getMemberProfile,
);

router.patch(
  '/:memberId/role',
  validate(updateMemberRoleSchema),
  requirePermission('member:manage'),
  memberController.updateMemberRole,
);

router.delete(
  '/:memberId',
  validate(removeMemberSchema),
  requirePermission('member:remove'),
  memberController.removeMember,
);

export default router;