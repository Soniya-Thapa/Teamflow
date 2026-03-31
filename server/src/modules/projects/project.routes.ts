/**
 * @file project.routes.ts
 * @description Routes for Project management
 *
 * MIDDLEWARE CHAIN ON EVERY ROUTE:
 *   authenticate        → verify JWT, attach req.userId
 *   requireOrganization → verify org membership, attach req.organizationId
 *   requirePermission   → check RBAC permission
 *   requireProjectAccess → check resource ownership (write routes only)
 *
 * VISIBILITY ENFORCEMENT:
 * Done inside project.service.ts — verifyProjectAccess() method.
 * Private projects return 404 (not 403) to non-members
 * to avoid leaking that the project exists.
 *
 * ROUTES:
 *   GET    /                           → list projects (with filters)
 *   POST   /                           → create project
 *   GET    /:projectId                 → get project
 *   PATCH  /:projectId                 → update project
 *   DELETE /:projectId                 → delete project
 *   PATCH  /:projectId/archive         → archive project
 *   PATCH  /:projectId/unarchive       → restore project
 *   POST   /:projectId/duplicate       → duplicate project
 *   POST   /:projectId/favorite        → toggle favorite
 *   GET    /:projectId/stats           → project statistics
 *   GET    /:projectId/activity        → project activity timeline
 *   POST   /:projectId/members         → add project member
 *   DELETE /:projectId/members/:memberId → remove project member
 */

import { Router } from 'express';
import { authenticate } from '@/middleware/auth.middleware';
import { requireOrganization } from '@/middleware/tenant.middleware';
import { requirePermission } from '@/middleware/permission.middleware';
import { requireProjectAccess } from '@/middleware/resource.middleware';
import { validate } from '@/middleware/validation.middleware';
import projectController from './project.controller';
import {
  createProjectSchema,
  updateProjectSchema,
  listProjectsSchema,
  projectParamOnlySchema,
  addProjectMemberSchema,
  removeProjectMemberSchema,
  duplicateProjectSchema,
} from './project.validation';

const router = Router({ mergeParams: true });

// Apply auth + org context to ALL project routes
router.use(authenticate, requireOrganization);

// ─────────────────────────────────────────
// LIST + CREATE
// ─────────────────────────────────────────

router.get(
  '/',
  validate(listProjectsSchema),
  requirePermission('project:read'),
  projectController.getProjects,
);

router.post(
  '/',
  validate(createProjectSchema),
  requirePermission('project:create'),
  projectController.createProject,
);

// ─────────────────────────────────────────
// SINGLE PROJECT
// ─────────────────────────────────────────

router.get(
  '/:projectId',
  validate(projectParamOnlySchema),
  requirePermission('project:read'),
  requireProjectAccess('read'),
  projectController.getProject,
);

router.patch(
  '/:projectId',
  validate(updateProjectSchema),
  requirePermission('project:update'),
  requireProjectAccess('update'),
  projectController.updateProject,
);

router.delete(
  '/:projectId',
  validate(projectParamOnlySchema),
  requirePermission('project:delete'),
  requireProjectAccess('delete'),
  projectController.deleteProject,
);

// ─────────────────────────────────────────
// ARCHIVE / UNARCHIVE
// ─────────────────────────────────────────

router.patch(
  '/:projectId/archive',
  validate(projectParamOnlySchema),
  requirePermission('project:update'),
  requireProjectAccess('update'),
  projectController.archiveProject,
);

router.patch(
  '/:projectId/unarchive',
  validate(projectParamOnlySchema),
  requirePermission('project:update'),
  requireProjectAccess('update'),
  projectController.unarchiveProject,
);

// ─────────────────────────────────────────
// DUPLICATE
// ─────────────────────────────────────────

router.post(
  '/:projectId/duplicate',
  validate(duplicateProjectSchema),
  requirePermission('project:create'),
  requireProjectAccess('read'),
  projectController.duplicateProject,
);

// ─────────────────────────────────────────
// FAVORITE
// ─────────────────────────────────────────

router.post(
  '/:projectId/favorite',
  validate(projectParamOnlySchema),
  requirePermission('project:read'),
  projectController.toggleFavorite,
);

// ─────────────────────────────────────────
// STATS + ACTIVITY
// ─────────────────────────────────────────

router.get(
  '/:projectId/stats',
  validate(projectParamOnlySchema),
  requirePermission('project:read'),
  requireProjectAccess('read'),
  projectController.getProjectStats,
);

router.get(
  '/:projectId/activity',
  validate(projectParamOnlySchema),
  requirePermission('project:read'),
  requireProjectAccess('read'),
  projectController.getProjectActivity,
);

// ─────────────────────────────────────────
// PROJECT MEMBERS
// ─────────────────────────────────────────

router.post(
  '/:projectId/members',
  validate(addProjectMemberSchema),
  requirePermission('project:update'),
  requireProjectAccess('update'),
  projectController.addProjectMember,
);

router.delete(
  '/:projectId/members/:memberId',
  validate(removeProjectMemberSchema),
  requirePermission('project:update'),
  requireProjectAccess('update'),
  projectController.removeProjectMember,
);

export default router;