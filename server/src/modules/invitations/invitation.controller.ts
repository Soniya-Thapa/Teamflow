/**
 * @file invitation.controller.ts
 * @description HTTP handlers for invitation endpoints
 *
 * Thin controllers — extract data, call service, send response.
 *
 * NOTE: acceptInvitation and getInvitationByToken are PUBLIC endpoints.
 * They do NOT use authenticate middleware.
 * The invitation token itself authenticates the request.
 */

import { Request, Response } from 'express';
import { BaseController } from '@/common/BaseController';
import invitationService from './invitation.service';

class InvitationController extends BaseController {

  // ─────────────────────────────────────────
  // CREATE INVITATION
  // ─────────────────────────────────────────

  /**
   * POST /api/v1/organizations/:id/invitations
   */
  createInvitation = this.asyncHandler(
    async (req: Request, res: Response) => {
      const { id: organizationId } = req.params;
      const inviterId = req.userId!;
      const { email, role } = req.body;

      const result = await invitationService.createInvitation(
        organizationId as string,
        inviterId,
        email,
        role,
      );

      return this.sendCreated(res, result, 'Invitation sent successfully');
    },
  );

  // ─────────────────────────────────────────
  // LIST INVITATIONS
  // ─────────────────────────────────────────

  /**
   * GET /api/v1/organizations/:id/invitations
   */
  listInvitations = this.asyncHandler(
    async (req: Request, res: Response) => {
      const { id: organizationId } = req.params;
      const userId = req.userId!;
      const { page, limit } = this.getPagination(req);
      const status = (req.query.status as 'pending' | 'accepted' | 'all') || 'pending';

      const result = await invitationService.listInvitations(
        organizationId as string,
        userId,
        page,
        limit,
        status,
      );

      return this.sendSuccess(res, result, 'Invitations retrieved successfully');
    },
  );

  // ─────────────────────────────────────────
  // GET BY TOKEN (public)
  // ─────────────────────────────────────────

  /**
   * GET /api/v1/invitations/:token
   * Public — used by frontend to show invitation preview page
   */
  getInvitationByToken = this.asyncHandler(
    async (req: Request, res: Response) => {
      const { token } = req.params;

      const result = await invitationService.getInvitationByToken(token as string);

      return this.sendSuccess(res, result, 'Invitation details retrieved');
    },
  );

  // ─────────────────────────────────────────
  // ACCEPT INVITATION (public)
  // ─────────────────────────────────────────

  /**
   * POST /api/v1/invitations/accept
   * Public — invitee accepts invitation and gets logged in
   */
  acceptInvitation = this.asyncHandler(
    async (req: Request, res: Response) => {
      const { token, firstName, lastName, password } = req.body;

      const result = await invitationService.acceptInvitation(token, {
        firstName,
        lastName,
        password,
      });

      return this.sendSuccess(res, result, result.message);
    },
  );

  // ─────────────────────────────────────────
  // REVOKE INVITATION
  // ─────────────────────────────────────────

  /**
   * DELETE /api/v1/organizations/:id/invitations/:invitationId
   */
  revokeInvitation = this.asyncHandler(
    async (req: Request, res: Response) => {
      const { id: organizationId, invitationId } = req.params;
      const userId = req.userId!;

      const result = await invitationService.revokeInvitation(
        organizationId as string,
        userId,
        invitationId as string,
      );

      return this.sendSuccess(res, result, 'Invitation revoked successfully');
    },
  );

  // ─────────────────────────────────────────
  // RESEND INVITATION
  // ─────────────────────────────────────────

  /**
   * POST /api/v1/organizations/:id/invitations/:invitationId/resend
   */
  resendInvitation = this.asyncHandler(
    async (req: Request, res: Response) => {
      const { id: organizationId, invitationId } = req.params;
      const userId = req.userId!;

      const result = await invitationService.resendInvitation(
        organizationId as string,
        userId,
        invitationId as string,
      );

      return this.sendSuccess(res, result, 'Invitation resent successfully');
    },
  );
}

export default new InvitationController();