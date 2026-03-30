
// file:role.service.ts
// description: Business logic for RBAC role management

// Two types of roles:
//   System roles  → created by seed script, apply to all orgs, cannot be deleted
//   Custom roles  → created by org OWNER/ADMIN, specific to one org

// System roles: OWNER, ADMIN, MEMBER, GUEST
// Custom roles: e.g. "Developer", "Designer", "QA Engineer"

// It handles:
// roles (OWNER, ADMIN, custom roles)
// permissions
// assigning/removing roles
// checking permissions

import { BaseService } from '@/common/BaseService';
import ApiError from '@/utils/ApiError';
import { clearPermissionCache } from '@/middleware/permission.middleware';

class RoleService extends BaseService {

  // ───────────────────────────────────────── GET ALL ROLES FOR ORG ─────────────────────────────────────────

  // Get all roles available in an organization.
  // Returns both system roles and org-specific custom roles.

  // param organizationId - Organization UUID
  // param userId         - Requesting user's ID

  async getRoles(organizationId: string, userId: string) {
    this.log('Getting roles', { organizationId });

    // Verify membership (Check if user belongs to org)
    const member = await this.prisma.organizationMember.findFirst({
      where: {
        userId,
        organizationId,
        status: 'ACTIVE'
      },
    });

    if (!member) {
      throw ApiError.forbidden('You do not have access to this organization');
    }

    //      It returns:
    // System roles (OWNER, ADMIN, etc.)
    // Custom roles (created inside this org)

    const roles = await this.prisma.role.findMany({
      where: {
        OR: [
          { isSystem: true, organizationId: null },  // system roles
          { organizationId },                        // custom org roles
        ],
      },
      include: {
        rolePermissions: {
          include: {
            permission: {
              select: {
                id: true,
                name: true,
                displayName: true,
                resource: true,
                action: true,
              },
            },
          },
        },
        _count: {
          select: {
            memberRoles: true
          },
        },
      },
      orderBy: {
        createdAt: 'asc'
      },
    });

    return { roles };
  }

  // ───────────────────────────────────────── GET ALL PERMISSIONS ─────────────────────────────────────────


  // Get all available permissions grouped by resource.
  // Used by frontend to build permission assignment UI.

  //   First: What is resource?
  // In your system:
  // permission = resource : action

  // Resource = “WHAT thing you are controlling”
  // Examples from your code:

  // organization
  // member
  // team
  // project
  // task
  // comment
  // attachment

  // Action = “WHAT you can do with it”
  // create
  // read
  // update
  // delete
  // assign

  // Combine them:
  // project:create → create a project
  // task:update    → update a task
  // member:invite  → invite a member

  async getPermissions() {
    const permissions = await this.prisma.permission.findMany({ // Fetch all permissions
      orderBy: [
        { resource: 'asc' },
        { action: 'asc' }
      ],
    });

    // Group by resource for easier frontend rendering
    // reduce = loop + build new object
    const grouped = permissions.reduce((acc, permission) => {
      if (!acc[permission.resource]) { // Group them
        acc[permission.resource] = [];
      }
      acc[permission.resource].push(permission);
      return acc;
    }, {} as Record<string, typeof permissions>);

    return { permissions, grouped };
  }

  // ──────────────────────────────────────── CREATE CUSTOM ROLE ─────────────────────────────────────────

  // Create a custom role for an organization.
  // Custom roles supplement system roles with org-specific needs.

  // Example: A software company might create a "Developer" role
  // with specific permissions tailored to their workflow.

  // throws 409 if role name already exists in this org
  // throws 403 if user is not OWNER or ADMIN

  async createRole(organizationId: string, userId: string, data: {
    name: string;
    displayName: string;
    description?: string;
    permissionIds: string[];
  },
  ) {
    this.log('Creating custom role', { organizationId, name: data.name });

    // Verify OWNER or ADMIN
    const member = await this.prisma.organizationMember.findFirst({
      where: {
        userId,
        organizationId,
        status: 'ACTIVE',
        role: {
          in: ['OWNER', 'ADMIN']
        },
      },
    });

    if (!member) {
      throw ApiError.forbidden('Only OWNER or ADMIN can create roles');
    }

    // Check name uniqueness within org
    const existing = await this.prisma.role.findFirst({
      where: {
        organizationId,
        name: data.name.toUpperCase(),
      },
    });

    if (existing) {
      throw ApiError.conflict(
        `Role "${data.name}" already exists in this organization`,
      );
    }

    // Create role with permissions in transaction
    const role = await this.prisma.$transaction(async (tx) => {
      const newRole = await tx.role.create({
        data: {
          name: data.name.toUpperCase(),
          displayName: data.displayName,
          description: data.description,
          organizationId,
          isSystem: false, // Custom roles can be deleted
        },
      });

      // Assign permissions to role
      if (data.permissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: data.permissionIds.map(permissionId => ({
            roleId: newRole.id,
            permissionId,
          })),
          skipDuplicates: true,
        });
      }

      return newRole;
    });

    this.log('Custom role created', { roleId: role.id });

    return { role };
  }

  // ───────────────────────────────────────── ASSIGN ROLE TO MEMBER= ─────────────────────────────────────────

  // Assign a custom role to an organization member.
  // Members can have multiple roles (their permissions are merged).

  // Note: The base MemberRole (OWNER/ADMIN/MEMBER/GUEST) is separate
  // from custom role assignments. Custom roles add ON TOP of the base role.

  // throws 404 if member or role not found
  // throws 403 if user is not OWNER or ADMIN

  async assignRole(organizationId: string, userId: string, targetMemberId: string, roleId: string) {
    this.log('Assigning role to member', { organizationId, targetMemberId, roleId });

    // Verify requester is OWNER or ADMIN
    const requester = await this.prisma.organizationMember.findFirst({
      where: {
        userId,
        organizationId,
        status: 'ACTIVE',
        role: {
          in: ['OWNER', 'ADMIN']
        },
      },
    });

    if (!requester) {
      throw ApiError.forbidden('Only OWNER or ADMIN can assign roles');
    }

    // Verify target member exists in org
    const targetMember = await this.prisma.organizationMember.findFirst({
      where: {
        id: targetMemberId,
        organizationId,
        status: 'ACTIVE',
      },
    });

    if (!targetMember) {
      throw ApiError.notFound('Member not found in this organization');
    }

    // Verify role exists and belongs to this org or is a system role
    const role = await this.prisma.role.findFirst({
      where: {
        id: roleId,
        OR: [
          { organizationId },
          { isSystem: true, organizationId: null },
        ],
      },
    });

    if (!role) {
      throw ApiError.notFound('Role not found');
    }

    // Assign role — skip if already assigned
    await this.prisma.memberRoleAssignment.upsert({
      where: {
        memberId_roleId: {
          memberId: targetMemberId,
          roleId,
        },
      },
      update: {},
      create: {
        memberId: targetMemberId,
        roleId,
      },
    });

    // Clear permission cache for this member
    clearPermissionCache(targetMemberId, organizationId);

    this.log('Role assigned successfully', { targetMemberId, roleId });

    return { message: 'Role assigned successfully' };
  }

  // ─────────────────────────────────────────= REMOVE ROLE FROM MEMBER= ─────────────────────────────────────────

  // Remove a custom role assignment from a member.

  // throws 404 if assignment not found
  // throws 403 if user is not OWNER or ADMIN

  async removeRole(organizationId: string, userId: string, targetMemberId: string, roleId: string,) {
    this.log('Removing role from member', { targetMemberId, roleId });

    // Verify requester is OWNER or ADMIN
    const requester = await this.prisma.organizationMember.findFirst({
      where: {
        userId,
        organizationId,
        status: 'ACTIVE',
        role: {
          in: ['OWNER', 'ADMIN']
        },
      },
    });

    if (!requester) {
      throw ApiError.forbidden('Only OWNER or ADMIN can remove roles');
    }

    // Delete the assignment
    const deleted = await this.prisma.memberRoleAssignment.deleteMany({
      where: {
        memberId: targetMemberId,
        roleId,
      },
    });

    if (deleted.count === 0) {
      throw ApiError.notFound('Role assignment not found');
    }

    // Clear permission cache
    clearPermissionCache(targetMemberId, organizationId);

    return { message: 'Role removed successfully' };
  }

  // ───────────────────────────────────────── DELETE CUSTOM ROLE ─────────────────────────────────────────

  // Delete a custom role from an organization.
  // System roles cannot be deleted.

  // throws 400 if trying to delete a system role
  // throws 403 if user is not OWNER

  async deleteRole(organizationId: string, userId: string, roleId: string) {
    this.log('Deleting role', { organizationId, roleId });

    // Only OWNER can delete roles
    const member = await this.prisma.organizationMember.findFirst({
      where: {
        userId,
        organizationId,
        status: 'ACTIVE',
        role: 'OWNER',
      },
    });

    if (!member) {
      throw ApiError.forbidden('Only the organization OWNER can delete roles');
    }

    const role = await this.prisma.role.findFirst({
      where: {
        id: roleId,
        organizationId
      },
    });

    if (!role) {
      throw ApiError.notFound('Role not found');
    }

    // System roles are permanent — cannot be deleted
    if (role.isSystem) {
      throw ApiError.badRequest(
        'System roles cannot be deleted. They are required for the platform to function.',
      );
    }

    await this.prisma.role.delete({
      where: {
        id: roleId
      },
    });

    this.log('Role deleted', { roleId });

    return { message: 'Role deleted successfully' };
  }

  // ───────────────────────────────────────── GET MEMBER PERMISSIONS ─────────────────────────────────────────

  // Get all permissions a specific member has.
  // Useful for debugging and frontend permission-based UI rendering.

  async getMemberPermissions(organizationId: string, userId: string,
    targetUserId: string //  // this is the OrganizationMember.id 
  ) {
    // Verify requester is a member
    const requester = await this.prisma.organizationMember.findFirst({
      where: {
        userId,
        organizationId,
        status: 'ACTIVE'
      },
    });

    if (!requester) {
      throw ApiError.forbidden('You do not have access to this organization');
    }

    const targetMember = await this.prisma.organizationMember.findFirst({
      where: {
        id: targetUserId,
        organizationId,
        status: 'ACTIVE'
      },
      include: {
        roleAssignments: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
      },
    });

    if (!targetMember) {
      throw ApiError.notFound('Member not found');
    }

    // Get system role permissions
    const systemRole = await this.prisma.role.findFirst({
      where: {
        name: targetMember.role,
        isSystem: true,
        organizationId: null,
      },
      include: {
        rolePermissions: {
          include: {
            permission: true
          },
        },
      },
    });

    // Merge all permissions
    const allPermissions = new Map<string, any>();

    systemRole?.rolePermissions.forEach(rp => {
      allPermissions.set(rp.permission.name, {
        ...rp.permission,
        source: 'system',
        roleName: targetMember.role,
      });
    });

    targetMember.roleAssignments.forEach(assignment => {
      assignment.role.rolePermissions.forEach(rp => {
        allPermissions.set(rp.permission.name, {
          ...rp.permission,
          source: 'custom',
          roleName: assignment.role.name,
        });
      });
    });

    return {
      member: {
        id: targetMember.id,
        baseRole: targetMember.role,
      },
      permissions: Array.from(allPermissions.values()),
      totalPermissions: allPermissions.size,
    };
  }

  // ─────────────────────────────────────────
  // BULK ROLE ASSIGNMENT
  // ─────────────────────────────────────────

  /**
   * Assign a role to multiple members at once.
   * Useful for onboarding a whole team with the same role.
   *
   * WHY BULK?
   * Assigning roles one by one for 20 members is 20 API calls.
   * Bulk assignment does it in one transaction — faster and atomic.
   * If one fails, none are assigned (all or nothing).
   *
   * @param organizationId - Organization UUID
   * @param userId         - Requesting user's ID (must be OWNER/ADMIN)
   * @param memberIds      - Array of OrganizationMember IDs
   * @param roleId         - Role to assign to all members
   * @throws 403           - If user is not OWNER or ADMIN
   * @throws 404           - If role not found
   */
  async bulkAssignRole(organizationId: string,userId: string,memberIds: string[],roleId: string) {
    this.log('Bulk assigning role', {organizationId,roleId,memberCount: memberIds.length});

    // Verify requester is OWNER or ADMIN
    const requester = await this.prisma.organizationMember.findFirst({
      where: {
        userId,
        organizationId,
        status: 'ACTIVE',
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });

    if (!requester) {
      throw ApiError.forbidden('Only OWNER or ADMIN can assign roles');
    }

    // Verify role exists and is accessible
    const role = await this.prisma.role.findFirst({
      where: {
        id: roleId,
        OR: [
          { organizationId },
          { isSystem: true, organizationId: null },
        ],
      },
    });

    if (!role) {
      throw ApiError.notFound('Role not found');
    }

    // Verify all members belong to this org
    const members = await this.prisma.organizationMember.findMany({
      where: {
        id: { 
          in: memberIds 
        },
        organizationId,
        status: 'ACTIVE',
      },
    });

    if (members.length !== memberIds.length) {
      throw ApiError.badRequest(
        'One or more members not found in this organization',
      );
    }

    // Bulk assign in transaction — all or nothing

    // Why needed?

    // Imagine:
    // 10 members
    // 5 inserted
    // error happens

    // Without transaction
    // 5 members got role 
    // 5 didn’t 
    // inconsistent data 

    // With transaction
    // 0 members updated (rollback)
    // clean + safe

    await this.prisma.$transaction(async (tx) => {
      await tx.memberRoleAssignment.createMany({
        data: memberIds.map(memberId => ({
          memberId,
          roleId,
        })),
        skipDuplicates: true, // Skip if already assigned
      });
    });

    // Clear permission cache for all affected members
    members.forEach(member => {
      clearPermissionCache(member.id, organizationId);
    });

    this.log('Bulk role assignment complete', {roleId,memberCount: members.length});

    return {
      message: `Role assigned to ${members.length} members successfully`,
      assignedCount: members.length,
    };
  }
}

export default new RoleService();