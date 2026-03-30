/**
 * @file team.routes.ts
 * @description Routes for Team management
 *
 * MIDDLEWARE CHAIN:
 *   authenticate        → verify JWT
 *   requireOrganization → verify org membership, attach organizationId
 *   requirePermission   → check RBAC permission
 *   requireTeamAccess   → check resource ownership (Day 9 middleware)
 *   controller          → execute
 *
 * WHY requireOrganization ON ALL ROUTES?
 * Teams are always scoped to an org. Without requireOrganization,
 * req.organizationId would be undefined and all service methods would fail.
 *
 * ROUTES:
 *   GET    /organizations/:id/teams                          → List teams
 *   POST   /organizations/:id/teams                          → Create team
 *   GET    /organizations/:id/teams/:teamId                  → Get team
 *   PATCH  /organizations/:id/teams/:teamId                  → Update team
 *   DELETE /organizations/:id/teams/:teamId                  → Delete team
 *   GET    /organizations/:id/teams/:teamId/members          → List members
 *   POST   /organizations/:id/teams/:teamId/members          → Add member
 *   PATCH  /organizations/:id/teams/:teamId/members/:memberId → Update member role
 *   DELETE /organizations/:id/teams/:teamId/members/:memberId → Remove member
 */

import { Router } from 'express';
import { authenticate } from '@/middleware/auth.middleware';
import { requireOrganization } from '@/middleware/tenant.middleware';
import { requirePermission } from '@/middleware/permission.middleware';
import { validate } from '@/middleware/validation.middleware';
import teamController from './team.controller';
import {
  createTeamSchema,
  updateTeamSchema,
  listTeamsSchema,
  teamParamSchema,
  addTeamMemberSchema,
  updateTeamMemberSchema,
  removeTeamMemberSchema,
} from './team.validation';

const router = Router({ mergeParams: true });

// Apply auth + org context to ALL team routes
router.use(authenticate, requireOrganization);

// ─────────────────────────────────────────
// TEAM CRUD
// ─────────────────────────────────────────

router.get(
  '/',
  validate(listTeamsSchema),
  requirePermission('team:read'),
  teamController.getTeams,
);

router.post(
  '/',
  validate(createTeamSchema),
  requirePermission('team:create'),
  teamController.createTeam,
);

router.get(
  '/:teamId',
  validate(teamParamSchema),
  requirePermission('team:read'),
  teamController.getTeam,
);

router.patch(
  '/:teamId',
  validate(updateTeamSchema),
  requirePermission('team:update'),
  teamController.updateTeam,
);

router.delete(
  '/:teamId',
  validate(teamParamSchema),
  requirePermission('team:delete'),
  teamController.deleteTeam,
);

// ─────────────────────────────────────────
// TEAM MEMBERS
// ─────────────────────────────────────────

router.get(
  '/:teamId/members',
  validate(teamParamSchema),
  requirePermission('team:read'),
  teamController.getTeamMembers,
);

router.post(
  '/:teamId/members',
  validate(addTeamMemberSchema),
  requirePermission('team:update'),
  teamController.addTeamMember,
);

router.patch(
  '/:teamId/members/:memberId',
  validate(updateTeamMemberSchema),
  requirePermission('team:update'),
  teamController.updateTeamMember,
);

router.delete(
  '/:teamId/members/:memberId',
  validate(removeTeamMemberSchema),
  requirePermission('team:update'),
  teamController.removeTeamMember,
);

export default router;