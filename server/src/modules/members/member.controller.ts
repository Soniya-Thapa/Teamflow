/**
 * @file member.controller.ts
 * @description HTTP handlers for organization member management endpoints
 *
 * Controllers are thin — extract data, call service, send response.
 * All business logic and permission validation lives in member.service.ts.
 */

import { Request, Response } from 'express';
import { BaseController } from '@/common/BaseController';
import memberService from './member.service';
import { MemberRole, MemberStatus } from '@prisma/client';

class MemberController extends BaseController {

  // ─────────────────────────────────────────
  // LIST MEMBERS
  // ─────────────────────────────────────────

  /**
   * GET /api/v1/organizations/:id/members
   */
  listMembers = this.asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.organizationId!;
    const userId = req.userId!;
    const { page, limit } = this.getPagination(req);
    const { search, role, status } = req.query as {
      search?: string;
      role?: MemberRole;
      status?: MemberStatus;
    };

    const result = await memberService.listMembers(
      organizationId,
      userId,
      { search, role, status },
      page,
      limit,
    );

    return this.sendSuccess(res, result, 'Members retrieved successfully');
  });

  // ─────────────────────────────────────────
  // GET SINGLE MEMBER
  // ─────────────────────────────────────────

  /**
   * GET /api/v1/organizations/:id/members/:memberId
   */
  getMember = this.asyncHandler(async (req: Request, res: Response) => {
    const { memberId } = req.params;
    const organizationId = req.organizationId!;
    const userId = req.userId!;

    const result = await memberService.getMember(
      memberId as string,
      organizationId,
      userId,
    );

    return this.sendSuccess(res, result, 'Member retrieved successfully');
  });

  // ─────────────────────────────────────────
  // UPDATE MEMBER ROLE
  // ─────────────────────────────────────────

  /**
   * PATCH /api/v1/organizations/:id/members/:memberId/role
   */
  updateMemberRole = this.asyncHandler(async (req: Request, res: Response) => {
    const { memberId } = req.params;
    const organizationId = req.organizationId!;
    const requesterId = req.userId!;
    const { role } = req.body;

    const result = await memberService.updateMemberRole(
      memberId as string,
      organizationId,
      requesterId,
      role as MemberRole,
    );

    return this.sendSuccess(res, result, 'Member role updated successfully');
  });

  // ─────────────────────────────────────────
  // REMOVE MEMBER
  // ─────────────────────────────────────────

  /**
   * DELETE /api/v1/organizations/:id/members/:memberId
   */
  removeMember = this.asyncHandler(async (req: Request, res: Response) => {
    const { memberId } = req.params;
    const organizationId = req.organizationId!;
    const requesterId = req.userId!;

    const result = await memberService.removeMember(
      memberId as string,
      organizationId,
      requesterId,
    );

    return this.sendSuccess(res, result, result.message);
  });

  // ─────────────────────────────────────────
  // MEMBER PROFILE
  // ─────────────────────────────────────────

  /**
   * GET /api/v1/organizations/:id/members/:memberId/profile
   */
  getMemberProfile = this.asyncHandler(async (req: Request, res: Response) => {
    const { memberId } = req.params;
    const organizationId = req.organizationId!;
    const userId = req.userId!;

    const result = await memberService.getMemberProfile(
      memberId as string,
      organizationId,
      userId,
    );

    return this.sendSuccess(res, result, 'Member profile retrieved successfully');
  });

  // ─────────────────────────────────────────
  // TRANSFER OWNERSHIP
  // ─────────────────────────────────────────

  /**
   * POST /api/v1/organizations/:id/members/transfer-ownership
   */
  transferOwnership = this.asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.organizationId!;
    const requesterId = req.userId!;
    const { newOwnerUserId } = req.body;

    const result = await memberService.transferOwnership(
      organizationId,
      requesterId,
      newOwnerUserId,
    );

    return this.sendSuccess(res, result, result.message);
  });

  // ─────────────────────────────────────────
  // SEARCH MEMBERS
  // ─────────────────────────────────────────

  /**
   * GET /api/v1/organizations/:id/members/search?q=
   */
  searchMembers = this.asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.organizationId!;
    const userId = req.userId!;
    const query = (req.query.q as string) || '';

    const result = await memberService.searchMembers(
      organizationId,
      userId,
      query,
    );

    return this.sendSuccess(res, result, 'Members search results');
  });
}

export default new MemberController();