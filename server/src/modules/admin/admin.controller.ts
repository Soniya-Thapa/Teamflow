
// @file admin.controller.ts
// @description HTTP handlers for super admin endpoints

// All routes prefixed with /api/v1/admin
// All routes protected by authenticate + requireSuperAdmin middleware

import { Request, Response } from 'express';
import { BaseController } from '@/common/BaseController';
import adminService from './admin.service';

class AdminController extends BaseController {

  //----------------------------- PLATFORM STATS ---------------------------------------------------------------------------------------

  // GET /api/v1/admin/stats
  // Platform-wide statistics

  getPlatformStats = this.asyncHandler(async (req: Request, res: Response) => {
    const userId = req.userId!;

    const stats = await adminService.getPlatformStats(userId);

    return this.sendSuccess(res, stats, 'Platform stats retrieved successfully');
  });

  //----------------------------- LIST ALL ORGANIZATIONS ---------------------------------------------------------------------------------------

  // GET /api/v1/admin/organizations
  // List all organizations with optional filters

  // Query: ?status=ACTIVE&plan=FREE&search=acme&page=1&limit=10

  getAllOrganizations = this.asyncHandler(async (req: Request, res: Response) => {
    const userId = req.userId!;
    const { page, limit } = this.getPagination(req);
    const { status, plan, search } = req.query as {
      status?: any;
      plan?: string;
      search?: string;
    };

    const result = await adminService.getAllOrganizations(
      userId,
      { status, plan, search },
      page,
      limit,
    );

    return this.sendSuccess(res, result, 'Organizations retrieved successfully');
  });

  //----------------------------- UPDATE ORGANIZATION STATUS ---------------------------------------------------------------------------------------

  // PATCH / api / v1 / admin / organizations /: id / status
  // Suspend, reactivate, or cancel any organization

  updateOrganizationStatus = this.asyncHandler(async (req: Request, res: Response) => {
    const adminUserId = req.userId!;
    const { id } = req.params;
    const { status, reason } = req.body;

    const result = await adminService.updateOrganizationStatus(adminUserId, id as string, status, reason);

    return this.sendSuccess(res, result, `Organization ${status.toLowerCase()} successfully`);
  });
}

export default new AdminController();