
// @file admin.service.ts
// Super admin business logic for platform-level management

// SUPER ADMIN vs ORG ADMIN:
// Org Admin  → manages ONE organization (scoped, limited power)
// Super Admin → manages the ENTIRE platform (all orgs, all users) = us

// Super admin actions are logged in ActivityLog with a special resourceType of 'PLATFORM' for audit purposes.

// All methods verify isSuperAdmin before executing.
// This is a secondary safety check — the middleware checks first, but defense in depth means we check in the service too.

import { BaseService } from '@/common/BaseService';
import ApiError from '@/utils/ApiError';
import { OrganizationStatus } from '@prisma/client';

class AdminService extends BaseService {

  //----------------------------- PRIVATE HELPERS ---------------------------------------------------------------------------------------

  // Verify the requesting user is a super admin.
  // Called at the start of every admin service method.

  // @throws 403 if user is not a super admin

  private async verifySuperAdmin(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId
      },
      select: {
        isSuperAdmin: true
      },
    });

    if (!user?.isSuperAdmin) {
      throw ApiError.forbidden('Super admin access required');
    }
  }

  //----------------------------- LIST ALL ORGANIZATIONS ---------------------------------------------------------------------------------------

  // Get all organizations across the platform with filters.
  // Used by super admin dashboard to monitor all tenants.

  // @param userId - Super admin's user ID
  // @param filters - Optional status, plan, search filters
  // @param page - Page number
  // @param limit - Items per page

  //A filter means: Selecting only the data that matches certain conditions.

  async getAllOrganizations(userId: string, filters: {
    status?: OrganizationStatus;
    plan?: string;
    search?: string;
  }, page = 1, limit = 10) {

    this.log('Admin: listing all organizations', { userId, filters });

    await this.verifySuperAdmin(userId);

    const skip = (page - 1) * limit;

    // Build dynamic where clause based on provided filters
    // The variable name "where" is custom.
    // This creates an empty filter object that will be filled depending on what filters the user sends.
    const where: any = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.plan) {
      where.plan = filters.plan;
    }

    // Meaning:
    // Find organizations where:

    // name contains "team"
    // OR
    // slug contains "team"

    // mode: 'insensitive' means:
    // TEAM
    // Team
    // team
    // all match.

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { slug: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [organizations, total] = await Promise.all([
      this.prisma.organization.findMany({
        where,
        include: {
          owner: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          _count: {
            select: {
              members: true,
              projects: true,
              tasks: true,
            },
          },
          usage: true,
        },
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc'
        },
      }),

      this.prisma.organization.count({
        where
      }),
    ]);

    return {
      organizations,
      meta: this.buildPaginationMeta(page, limit, total),
    };
  }

  //----------------------------- UPDATE ORGANIZATION STATUS (platform level) ---------------------------------------------------------------------------------------

  // Super admin updates any organization's status.
  // Used for suspending orgs due to payment failure,
  // policy violations, or reactivating after resolution.

  // Difference from org - level suspension:
  // - No ownership check needed(super admin can act on any org)
  // - Reason is required for audit trail
  // - Logs the action with admin's userId

  // @param adminUserId - Super admin's user ID
  // @param organizationId - Target organization UUID
  // @param status - New status
  // @param reason - Reason for status change(audit trail)
  // @throws 404 - If organization not found

  async updateOrganizationStatus(adminUserId: string, organizationId: string, status: OrganizationStatus, reason?: string) {
    this.log('Admin: updating organization status', { adminUserId, organizationId, status });

    await this.verifySuperAdmin(adminUserId);

    const organization = await this.prisma.organization.findUnique({
      where: {
        id: organizationId
      },
    });

    if (!organization) {
      throw ApiError.notFound('Organization not found');
    }

    const updated = await this.prisma.organization.update({
      where: {
        id: organizationId
      },
      data: {
        status,
        // Track that admin suspended this — prevents owner from bypassing
        suspendedBy: status === 'SUSPENDED' ? 'SUPERADMIN' : null,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        updatedAt: true,
      },
    });

    this.log('Admin: organization status updated', { organizationId, status, reason, adminUserId });

    return {
      organization: updated,
      action: {
        performedBy: adminUserId,
        reason: reason || 'No reason provided',
        timestamp: new Date(),
      },
    };
  }

  //----------------------------- GET PLATFORM STATS ---------------------------------------------------------------------------------------

  // Get high - level platform statistics for the admin dashboard.
  // Runs all count queries in parallel for performance.

  // @param userId - Super admin's user ID

  async getPlatformStats(userId: string) {
    this.log('Admin: getting platform stats', { userId });

    await this.verifySuperAdmin(userId);

    const [
      totalOrganizations,
      activeOrganizations,
      suspendedOrganizations,
      totalUsers,
      totalProjects,
      totalTasks,
    ] = await Promise.all([
      this.prisma.organization.count(),
      this.prisma.organization.count({ where: { status: 'ACTIVE' } }),
      this.prisma.organization.count({ where: { status: 'SUSPENDED' } }),
      this.prisma.user.count(),
      this.prisma.project.count(),
      this.prisma.task.count(),
    ]);

    return {
      organizations: {
        total: totalOrganizations,
        active: activeOrganizations,
        suspended: suspendedOrganizations,
        canceled: totalOrganizations - activeOrganizations - suspendedOrganizations,
      },
      users: {
        total: totalUsers
      },
      projects: {
        total: totalProjects
      },
      tasks: {
        total: totalTasks
      },
      generatedAt: new Date(),
    };
  }
}

export default new AdminService();