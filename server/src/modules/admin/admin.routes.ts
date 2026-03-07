
// @file admin.routes.ts
// @description Routes for super admin endpoints

// ALL routes here require:
//   1. authenticate     → valid JWT
//   2. requireSuperAdmin → isSuperAdmin flag on user

// These routes are intentionally undocumented in public API docs.
// Only platform operators should know they exist.

// ROUTES:
//   GET   /api/v1/admin/stats                        → Platform stats
//   GET   /api/v1/admin/organizations                → List all orgs
//   PATCH /api/v1/admin/organizations/:id/status     → Update org status

import { Router } from 'express';
import { authenticate } from '@/middleware/auth.middleware';
import { requireSuperAdmin } from '@/middleware/admin.middleware';
import { validate } from '@/middleware/validation.middleware';
import {
  adminListOrganizationsSchema,
  updateOrganizationStatusSchema,
} from '@/modules/organizations/organization.validation';
import adminController from './admin.controller';

const router = Router();

// Apply both middlewares to ALL admin routes
router.use(authenticate, requireSuperAdmin);

// GET /api/v1/admin/stats
router.get('/stats', adminController.getPlatformStats);

// GET /api/v1/admin/organizations
router.get('/organizations', validate(adminListOrganizationsSchema), adminController.getAllOrganizations);

// PATCH /api/v1/admin/organizations/:id/status
router.patch('/organizations/:id/status', validate(updateOrganizationStatusSchema), adminController.updateOrganizationStatus);

export default router;