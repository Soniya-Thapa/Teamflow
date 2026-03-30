/**
 * @file invitation.routes.ts
 * @description Routes for the User Invitation System
 *
 * TWO ROUTE GROUPS:
 *
 * 1. Org-scoped routes (require auth + org membership):
 *    POST   /organizations/:id/invitations                    → send invite
 *    GET    /organizations/:id/invitations                    → list invites
 *    DELETE /organizations/:id/invitations/:invitationId      → revoke invite
 *    POST   /organizations/:id/invitations/:invitationId/resend → resend invite
 *
 * 2. Public routes (NO auth required — token authenticates):
 *    GET    /invitations/:token    → preview invitation details
 *    POST   /invitations/accept    → accept invitation + login
 *
 * WHY PUBLIC ROUTES?
 * The invitee may not have an account yet.
 * They follow a link from email — they have no JWT token.
 * The invitation token itself proves they are the intended recipient.
 */

import { Router } from 'express';
import { authenticate } from '@/middleware/auth.middleware';
import { requireOrganization } from '@/middleware/tenant.middleware';
import { requirePermission } from '@/middleware/permission.middleware';
import { validate } from '@/middleware/validation.middleware';
import { authRateLimit } from '@/middleware/rateLimit.middleware';
import invitationController from './invitation.controller';
import {
  createInvitationSchema,
  acceptInvitationSchema,
  revokeInvitationSchema,
  resendInvitationSchema,
  listInvitationsSchema,
} from './invitation.validation';

// ─────────────────────────────────────────
// ORG-SCOPED ROUTER
// Mounted at: /api/v1/organizations/:id/invitations
// ─────────────────────────────────────────

export const orgInvitationRouter = Router({ mergeParams: true });

orgInvitationRouter.use(authenticate, requireOrganization);

orgInvitationRouter.get(
  '/',
  validate(listInvitationsSchema),
  requirePermission('member:invite'),
  invitationController.listInvitations,
);

orgInvitationRouter.post(
  '/',
  validate(createInvitationSchema),
  requirePermission('member:invite'),
  invitationController.createInvitation,
);

orgInvitationRouter.delete(
  '/:invitationId',
  validate(revokeInvitationSchema),
  requirePermission('member:invite'),
  invitationController.revokeInvitation,
);

orgInvitationRouter.post(
  '/:invitationId/resend',
  validate(resendInvitationSchema),
  requirePermission('member:invite'),
  invitationController.resendInvitation,
);

// ─────────────────────────────────────────
// PUBLIC ROUTER
// Mounted at: /api/v1/invitations
// ─────────────────────────────────────────

export const publicInvitationRouter = Router();

// Rate limit acceptance to prevent token brute-forcing
publicInvitationRouter.get(
  '/:token',
  authRateLimit,
  invitationController.getInvitationByToken,
);

publicInvitationRouter.post(
  '/accept',
  authRateLimit,
  validate(acceptInvitationSchema),
  invitationController.acceptInvitation,
);