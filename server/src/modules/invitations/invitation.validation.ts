/**
 * @file invitation.validation.ts
 * @description Zod validation schemas for invitation endpoints
 *
 * Invitation flow:
 *   OWNER/ADMIN sends invite → invitee receives email →
 *   invitee accepts via token → becomes org member
 *
 * Token travels in email link (raw).
 * Token stored in DB (hashed) — same pattern as password reset.
 */

import { z } from 'zod';
import { idParamSchema } from '@/common/validators';

// ─────────────────────────────────────────
// CREATE INVITATION
// ─────────────────────────────────────────

/**
 * POST /organizations/:id/invitations
 * Send invitation to an email address
 */
export const createInvitationSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid organization ID'),
  }),
  body: z.object({
    email: z
      .string()
      .email('Invalid email address')
      .toLowerCase(),
    role: z
      .enum(['ADMIN', 'MEMBER', 'GUEST'], {
        message: 'Role must be ADMIN, MEMBER, or GUEST',
      })
      .default('MEMBER'),
  }),
});

// ─────────────────────────────────────────
// ACCEPT INVITATION
// ─────────────────────────────────────────

/**
 * POST /invitations/accept
 * Accept an invitation using the token from email link
 * Public endpoint — no auth required
 * User may or may not have an account yet
 */
export const acceptInvitationSchema = z.object({
  body: z.object({
    token: z
      .string()
      .min(1, 'Invitation token is required'),
    // If user doesn't have account, they register while accepting
    firstName: z.string().min(1).max(50).optional(),
    lastName: z.string().min(1).max(50).optional(),
    password: z
      .string()
      .min(8)
      .regex(/[A-Z]/, 'Password must contain uppercase')
      .regex(/[a-z]/, 'Password must contain lowercase')
      .regex(/[0-9]/, 'Password must contain a number')
      .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain special character')
      .optional(),
  }),
});

// ─────────────────────────────────────────
// REVOKE INVITATION
// ─────────────────────────────────────────

/**
 * DELETE /organizations/:id/invitations/:invitationId
 * Revoke a pending invitation
 */
export const revokeInvitationSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid organization ID'),
    invitationId: z.string().uuid('Invalid invitation ID'),
  }),
});

// ─────────────────────────────────────────
// RESEND INVITATION
// ─────────────────────────────────────────

/**
 * POST /organizations/:id/invitations/:invitationId/resend
 * Resend invitation email with a fresh token
 */
export const resendInvitationSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid organization ID'),
    invitationId: z.string().uuid('Invalid invitation ID'),
  }),
});

// ─────────────────────────────────────────
// LIST INVITATIONS
// ─────────────────────────────────────────

/**
 * GET /organizations/:id/invitations
 * List all pending invitations for an org
 */
export const listInvitationsSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid organization ID'),
  }),
  query: z.object({
    page: z.string().optional().transform(val => parseInt(val || '1')),
    limit: z.string().optional().transform(val => parseInt(val || '10')),
    status: z.enum(['pending', 'accepted', 'all']).optional().default('pending'),
  }),
});