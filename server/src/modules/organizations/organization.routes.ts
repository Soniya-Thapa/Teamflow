/**
 * @file organization.routes.ts
 * @description Express routes for Organization endpoints
 *
 * IMPORTANT — WHY NO requireOrganization MIDDLEWARE HERE?
 * Access control (membership + role verification) is handled entirely
 * inside organization.service.ts via private helper methods.
 * This avoids double-checking and keeps the service self-contained.
 *
 * MIDDLEWARE CHAIN:
 *   authenticate     → Verify JWT, attach req.userId
 *   validate(schema) → Validate request data with Zod
 *   controller       → Extract data, call service, send response
 *
 * ROUTE SUMMARY:
 *   GET    /api/v1/organizations       → List user's organizations
 *   POST   /api/v1/organizations       → Create new organization
 *   GET    /api/v1/organizations/:id   → Get organization details
 *   PATCH  /api/v1/organizations/:id   → Update organization
 *   DELETE /api/v1/organizations/:id   → Delete organization
 */

import { Router } from 'express';
import { authenticate } from '@/middleware/auth.middleware';
import { validate } from '@/middleware/validation.middleware';
import organizationController from './organization.controller';
import {
  createOrganizationSchema,
  updateOrganizationSchema,
  getOrganizationSchema,
  deleteOrganizationSchema,
  listOrganizationsSchema,
} from './organization.validation';

const router = Router();

// Apply authentication to ALL organization routes
router.use(authenticate);

// GET /api/v1/organizations
router.get( '/', validate(listOrganizationsSchema),organizationController.getUserOrganizations);

// POST /api/v1/organizations
router.post('/',validate(createOrganizationSchema),organizationController.createOrganization);

// GET /api/v1/organizations/:id
router.get('/:id',validate(getOrganizationSchema),organizationController.getOrganization);

// PATCH /api/v1/organizations/:id
router.patch('/:id',validate(updateOrganizationSchema),organizationController.updateOrganization);

// DELETE /api/v1/organizations/:id
router.delete('/:id',validate(deleteOrganizationSchema),organizationController.deleteOrganization);

export default router;