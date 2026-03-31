/**
 * @file project.controller.ts
 * @description HTTP handlers for Project endpoints
 *
 * Controllers are thin — extract data, call service, send response.
 * All business logic and access control lives in project.service.ts.
 * organizationId always comes from req.organizationId (middleware).
 */

import { Request, Response } from 'express';
import { BaseController } from '@/common/BaseController';
import projectService from './project.service';
import { ProjectStatus, ProjectVisibility } from '@prisma/client';

class ProjectController extends BaseController {

  // ─────────────────────────────────────────
  // PROJECT CRUD
  // ─────────────────────────────────────────

  /**
   * POST /api/v1/organizations/:id/projects
   */
  createProject = this.asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.organizationId!;
    const userId = req.userId!;
    const { name, description, teamId, visibility, startDate, endDate } = req.body;

    const result = await projectService.createProject(
      organizationId,
      userId,
      { name, description, teamId, visibility, startDate, endDate },
    );

    return this.sendCreated(res, result, 'Project created successfully');
  });

  /**
   * GET /api/v1/organizations/:id/projects
   */
  getProjects = this.asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.organizationId!;
    const userId = req.userId!;
    const { page, limit } = this.getPagination(req);
    const {
      search,
      status,
      teamId,
      visibility,
      sortBy,
      sortOrder,
      favorites,
      startDate,
      endDate,
    } = req.query as any;

    const result = await projectService.getProjects(
      organizationId,
      userId,
      {
        search,
        status: status as ProjectStatus,
        teamId,
        visibility: visibility as ProjectVisibility,
        sortBy,
        sortOrder,
        favorites: favorites === 'true',
        startDate,
        endDate,
      },
      page,
      limit,
    );

    return this.sendSuccess(res, result, 'Projects retrieved successfully');
  });

  /**
   * GET /api/v1/organizations/:id/projects/:projectId
   */
  getProject = this.asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const organizationId = req.organizationId!;
    const userId = req.userId!;

    const result = await projectService.getProjectById(
      projectId as string,
      organizationId,
      userId,
    );

    return this.sendSuccess(res, result, 'Project retrieved successfully');
  });

  /**
   * PATCH /api/v1/organizations/:id/projects/:projectId
   */
  updateProject = this.asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const organizationId = req.organizationId!;
    const userId = req.userId!;

    const result = await projectService.updateProject(
      projectId as string,
      organizationId,
      userId,
      req.body,
    );

    return this.sendSuccess(res, result, 'Project updated successfully');
  });

  /**
   * PATCH /api/v1/organizations/:id/projects/:projectId/archive
   */
  archiveProject = this.asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const organizationId = req.organizationId!;
    const userId = req.userId!;

    const result = await projectService.archiveProject(
      projectId as string,
      organizationId,
      userId,
    );

    return this.sendSuccess(res, result, 'Project archived successfully');
  });

  /**
   * PATCH /api/v1/organizations/:id/projects/:projectId/unarchive
   */
  unarchiveProject = this.asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const organizationId = req.organizationId!;
    const userId = req.userId!;

    const result = await projectService.unarchiveProject(
      projectId as string,
      organizationId,
      userId,
    );

    return this.sendSuccess(res, result, 'Project unarchived successfully');
  });

  /**
   * DELETE /api/v1/organizations/:id/projects/:projectId
   */
  deleteProject = this.asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const organizationId = req.organizationId!;
    const userId = req.userId!;

    const result = await projectService.deleteProject(
      projectId as string,
      organizationId,
      userId,
    );

    return this.sendSuccess(res, result, 'Project deleted successfully');
  });

  // ─────────────────────────────────────────
  // PROJECT MEMBERS
  // ─────────────────────────────────────────

  /**
   * POST /api/v1/organizations/:id/projects/:projectId/members
   */
  addProjectMember = this.asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const organizationId = req.organizationId!;
    const userId = req.userId!;
    const { userId: targetUserId } = req.body;

    const result = await projectService.addProjectMember(
      projectId as string,
      organizationId,
      userId,
      targetUserId,
    );

    return this.sendCreated(res, result, 'Project member added successfully');
  });

  /**
   * DELETE /api/v1/organizations/:id/projects/:projectId/members/:memberId
   */
  removeProjectMember = this.asyncHandler(
    async (req: Request, res: Response) => {
      const { projectId, memberId } = req.params;
      const organizationId = req.organizationId!;
      const userId = req.userId!;

      const result = await projectService.removeProjectMember(
        projectId as string,
        organizationId,
        userId,
        memberId as string,
      );

      return this.sendSuccess(res, result, 'Project member removed successfully');
    },
  );

  // ─────────────────────────────────────────
  // FAVORITES
  // ─────────────────────────────────────────

  /**
   * POST /api/v1/organizations/:id/projects/:projectId/favorite
   */
  toggleFavorite = this.asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const organizationId = req.organizationId!;
    const userId = req.userId!;

    const result = await projectService.toggleFavorite(
      projectId as string,
      organizationId,
      userId,
    );

    return this.sendSuccess(res, result, result.message);
  });

  // ─────────────────────────────────────────
  // STATISTICS + ACTIVITY
  // ─────────────────────────────────────────

  /**
   * GET /api/v1/organizations/:id/projects/:projectId/stats
   */
  getProjectStats = this.asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const organizationId = req.organizationId!;
    const userId = req.userId!;

    const result = await projectService.getProjectStats(
      projectId as string,
      organizationId,
      userId,
    );

    return this.sendSuccess(res, result, 'Project stats retrieved successfully');
  });

  /**
   * GET /api/v1/organizations/:id/projects/:projectId/activity
   */
  getProjectActivity = this.asyncHandler(
    async (req: Request, res: Response) => {
      const { projectId } = req.params;
      const organizationId = req.organizationId!;
      const userId = req.userId!;
      const { page, limit } = this.getPagination(req);

      const result = await projectService.getProjectActivity(
        projectId as string,
        organizationId,
        userId,
        page,
        limit,
      );

      return this.sendSuccess(
        res,
        result,
        'Project activity retrieved successfully',
      );
    },
  );

  // ─────────────────────────────────────────
  // DUPLICATE
  // ─────────────────────────────────────────

  /**
   * POST /api/v1/organizations/:id/projects/:projectId/duplicate
   */
  duplicateProject = this.asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const organizationId = req.organizationId!;
    const userId = req.userId!;
    const { name, includeTasks } = req.body;

    const result = await projectService.duplicateProject(
      projectId as string,
      organizationId,
      userId,
      name,
      includeTasks,
    );

    return this.sendCreated(res, result, 'Project duplicated successfully');
  });
}

export default new ProjectController();