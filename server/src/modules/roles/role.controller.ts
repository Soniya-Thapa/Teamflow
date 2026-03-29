
// file :  role.controller.ts
// description : HTTP handlers for RBAC role management endpoints

import { Request, Response } from 'express';
import { BaseController } from '@/common/BaseController';
import roleService from './role.service';

class RoleController extends BaseController {

  // GET /api/v1/organizations/:id/roles
  // Get all roles available in an organization

  getRoles = this.asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.userId!;

    const result = await roleService.getRoles(id as string, userId);

    return this.sendSuccess(res, result, 'Roles retrieved successfully');
  });

  // GET /api/v1/organizations/:id/permissions
  // Get all available permissions grouped by resource

  getPermissions = this.asyncHandler(async (req: Request, res: Response) => {
    const result = await roleService.getPermissions();

    return this.sendSuccess(res, result, 'Permissions retrieved successfully');
  });

  // POST /api/v1/organizations/:id/roles
  // Create a custom role for the organization

  createRole = this.asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.userId!;
    const { name, displayName, description, permissionIds } = req.body;

    const result = await roleService.createRole(id as string, userId, {
      name,
      displayName,
      description,
      permissionIds,
    });

    return this.sendCreated(res, result, 'Role created successfully');
  });

  // POST /api/v1/organizations/:id/members/:memberId/roles
  // Assign a role to a member

  assignRole = this.asyncHandler(async (req: Request, res: Response) => {
    const { id, memberId } = req.params;
    const userId = req.userId!;
    const { roleId } = req.body;

    const result = await roleService.assignRole(id as string, userId, memberId as string, roleId);

    return this.sendSuccess(res, result, 'Role assigned successfully');
  });


  // DELETE /api/v1/organizations/:id/members/:memberId/roles/:roleId
  // Remove a role from a member

  removeRole = this.asyncHandler(async (req: Request, res: Response) => {
    const { id, memberId, roleId } = req.params;
    const userId = req.userId!;

    const result = await roleService.removeRole(id as string, userId, memberId as string, roleId as string);

    return this.sendSuccess(res, result, 'Role removed successfully');
  });


  // DELETE /api/v1/organizations/:id/roles/:roleId
  // Delete a custom role

  deleteRole = this.asyncHandler(async (req: Request, res: Response) => {
    const { id, roleId } = req.params;
    const userId = req.userId!;

    const result = await roleService.deleteRole(id as string, userId, roleId as string);

    return this.sendSuccess(res, result, 'Role deleted successfully');
  });

  // GET /api/v1/organizations/:id/members/:memberId/permissions
  // Get all permissions a specific member has

  getMemberPermissions = this.asyncHandler(
    async (req: Request, res: Response) => {
      const { id, memberId } = req.params;
      const userId = req.userId!;

      const result = await roleService.getMemberPermissions(
        id as string,
        userId,
        memberId as string,
      );

      return this.sendSuccess(
        res,
        result,
        'Member permissions retrieved successfully',
      );
    },
  );
}

export default new RoleController();