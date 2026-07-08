/**
 * @file analytics.controller.ts
 * @description Analytics endpoint handlers.
 * All endpoints require authentication and org context.
 * All accept ?days=7|30|90 for date range filtering.
 */

import { Request, Response } from 'express';
import { BaseController } from '@/common/BaseController';
import analyticsService from './analytics.service';

class AnalyticsController extends BaseController {

  /** GET /organizations/:id/analytics/overview?days=30 */
  getOverview = this.asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.organizationId!;
    const days = parseInt(req.query.days as string) || 30;

    const result = await analyticsService.getOrgOverview(organizationId, days);
    return this.sendSuccess(res, result, 'Overview retrieved');
  });

  /** GET /organizations/:id/analytics/tasks-by-status?projectId= */
  getTasksByStatus = this.asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.organizationId!;
    const projectId = req.query.projectId as string | undefined;

    const result = await analyticsService.getTasksByStatus(
      organizationId,
      projectId,
    );
    return this.sendSuccess(res, result, 'Task breakdown retrieved');
  });

  /** GET /organizations/:id/analytics/velocity?days=30 */
  getVelocity = this.asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.organizationId!;
    const days = parseInt(req.query.days as string) || 30;

    const result = await analyticsService.getTaskVelocity(organizationId, days);
    return this.sendSuccess(res, result, 'Velocity retrieved');
  });

  /** GET /organizations/:id/analytics/member-activity?days=30 */
  getMemberActivity = this.asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.organizationId!;
    const days = parseInt(req.query.days as string) || 30;

    const result = await analyticsService.getMemberActivity(organizationId, days);
    return this.sendSuccess(res, result, 'Member activity retrieved');
  });

  /** GET /organizations/:id/analytics/project-progress */
  getProjectProgress = this.asyncHandler(
    async (req: Request, res: Response) => {
      const organizationId = req.organizationId!;
      const result = await analyticsService.getProjectProgress(organizationId);
      return this.sendSuccess(res, result, 'Project progress retrieved');
    },
  );
}

export default new AnalyticsController();