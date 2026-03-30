/**
 * @file team.controller.ts
 * @description HTTP handlers for Team endpoints
 *
 * All controllers are thin — extract data, call service, send response.
 * organizationId comes from req.organizationId (set by requireOrganization middleware)
 * NOT from req.body — never trust client for tenant context.
 */

import { Request, Response } from 'express';
import { BaseController } from '@/common/BaseController';
import teamService from './team.service';
import { TeamMemberRole } from '@prisma/client';

class TeamController extends BaseController {

  // ─────────────────────────────────────────
  // TEAM CRUD
  // ─────────────────────────────────────────

  /**
   * POST /api/v1/organizations/:id/teams
   */
  createTeam = this.asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.organizationId!;
    const userId = req.userId!;
    const { name, description, leaderId } = req.body;

    const result = await teamService.createTeam(
      organizationId,
      userId,
      { name, description, leaderId },
    );

    return this.sendCreated(res, result, 'Team created successfully');
  });

  /**
   * GET /api/v1/organizations/:id/teams
   */
  getTeams = this.asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.organizationId!;
    const userId = req.userId!;
    const { page, limit } = this.getPagination(req);
    const search = req.query.search as string | undefined;

    const result = await teamService.getTeams(
      organizationId,
      userId,
      page,
      limit,
      search,
    );

    return this.sendSuccess(res, result, 'Teams retrieved successfully');
  });

  /**
   * GET /api/v1/organizations/:id/teams/:teamId
   */
  getTeam = this.asyncHandler(async (req: Request, res: Response) => {
    const { teamId } = req.params;
    const organizationId = req.organizationId!;
    const userId = req.userId!;

    const result = await teamService.getTeamById(
      teamId as string,
      organizationId,
      userId,
    );

    return this.sendSuccess(res, result, 'Team retrieved successfully');
  });

  /**
   * PATCH /api/v1/organizations/:id/teams/:teamId
   */
  updateTeam = this.asyncHandler(async (req: Request, res: Response) => {
    const { teamId } = req.params;
    const organizationId = req.organizationId!;
    const userId = req.userId!;
    const data = req.body;

    const result = await teamService.updateTeam(
      teamId as string,
      organizationId,
      userId,
      data,
    );

    return this.sendSuccess(res, result, 'Team updated successfully');
  });

  /**
   * DELETE /api/v1/organizations/:id/teams/:teamId
   */
  deleteTeam = this.asyncHandler(async (req: Request, res: Response) => {
    const { teamId } = req.params;
    const organizationId = req.organizationId!;
    const userId = req.userId!;

    const result = await teamService.deleteTeam(
      teamId as string,
      organizationId,
      userId,
    );

    return this.sendSuccess(res, result, 'Team deleted successfully');
  });

  // ─────────────────────────────────────────
  // TEAM MEMBER MANAGEMENT
  // ─────────────────────────────────────────

  /**
   * POST /api/v1/organizations/:id/teams/:teamId/members
   */
  addTeamMember = this.asyncHandler(async (req: Request, res: Response) => {
    const { teamId } = req.params;
    const organizationId = req.organizationId!;
    const userId = req.userId!;
    const { userId: targetUserId, role } = req.body;

    const result = await teamService.addTeamMember(
      teamId as string,
      organizationId,
      userId,
      targetUserId,
      role as TeamMemberRole,
    );

    return this.sendCreated(res, result, 'Team member added successfully');
  });

  /**
   * GET /api/v1/organizations/:id/teams/:teamId/members
   */
  getTeamMembers = this.asyncHandler(async (req: Request, res: Response) => {
    const { teamId } = req.params;
    const organizationId = req.organizationId!;
    const userId = req.userId!;
    const { page, limit } = this.getPagination(req);

    const result = await teamService.getTeamMembers(
      teamId as string,
      organizationId,
      userId,
      page,
      limit,
    );

    return this.sendSuccess(res, result, 'Team members retrieved successfully');
  });

  /**
   * PATCH /api/v1/organizations/:id/teams/:teamId/members/:memberId
   */
  updateTeamMember = this.asyncHandler(async (req: Request, res: Response) => {
    const { teamId, memberId } = req.params;
    const organizationId = req.organizationId!;
    const userId = req.userId!;
    const { role } = req.body;

    const result = await teamService.updateTeamMember(
      teamId as string,
      organizationId,
      userId,
      memberId as string,
      role as TeamMemberRole,
    );

    return this.sendSuccess(res, result, 'Team member role updated successfully');
  });

  /**
   * DELETE /api/v1/organizations/:id/teams/:teamId/members/:memberId
   */
  removeTeamMember = this.asyncHandler(async (req: Request, res: Response) => {
    const { teamId, memberId } = req.params;
    const organizationId = req.organizationId!;
    const userId = req.userId!;

    const result = await teamService.removeTeamMember(
      teamId as string,
      organizationId,
      userId,
      memberId as string,
    );

    return this.sendSuccess(res, result, 'Team member removed successfully');
  });
}

export default new TeamController();