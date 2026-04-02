/**
 * @file member.service.ts
 * @description Business logic for Organization Member management
 *
 * MEMBER HIERARCHY:
 *   OWNER  → full control, one per org, can transfer ownership
 *   ADMIN  → manage members/projects/teams, cannot delete org
 *   MEMBER → standard day-to-day work
 *   GUEST  → read-only access
 *
 * PERMISSION CHECKS:
 *   member:read   → any active member (list, get, search, profile)
 *   member:manage → OWNER or ADMIN (update role)
 *   member:remove → OWNER or ADMIN (remove member)
 *   ownership transfer → OWNER only (special endpoint)
 *
 * OWNERSHIP TRANSFER RULES:
 *   1. Only current OWNER can initiate transfer
 *   2. Target must be an active ADMIN (not MEMBER or GUEST)
 *   3. On transfer: old OWNER → ADMIN, new OWNER → OWNER
 *   4. org.ownerId updated to new owner
 *   5. Logged in ActivityLog for audit trail
 *
 * Methods:
 *   - listMembers()        → paginated list with role/search filter
 *   - getMember()          → single member details
 *   - updateMemberRole()   → change MEMBER ↔ ADMIN ↔ GUEST
 *   - removeMember()       → remove from org (cannot remove OWNER)
 *   - getMemberProfile()   → tasks, teams, activity for a member
 *   - transferOwnership()  → transfer OWNER role to an ADMIN
 *   - searchMembers()      → quick search by name/email
 */

import { BaseService } from '@/common/BaseService';
import ApiError from '@/utils/ApiError';
import { MemberRole, MemberStatus } from '@prisma/client';
import notificationService from '@/modules/notifications/notification.service';
import { NotificationType } from '@prisma/client';

class MemberService extends BaseService {

  // ─────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────

  /**
   * Verify requesting user is an active org member.
   * Returns their membership record.
   *
   * @throws 403 if not an active member
   */
  private async verifyMember(userId: string, organizationId: string) {
    const member = await this.prisma.organizationMember.findFirst({
      where: { userId, organizationId, status: 'ACTIVE' },
    });

    if (!member) {
      throw ApiError.forbidden(
        'You must be an active member of this organization',
      );
    }

    return member;
  }

  /**
   * Verify requesting user is OWNER or ADMIN.
   *
   * @throws 403 if not OWNER or ADMIN
   */
  private async verifyAdminOrOwner(userId: string, organizationId: string) {
    const member = await this.prisma.organizationMember.findFirst({
      where: {
        userId,
        organizationId,
        status: 'ACTIVE',
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });

    if (!member) {
      throw ApiError.forbidden(
        'Only organization OWNER or ADMIN can perform this action',
      );
    }

    return member;
  }

  /**
   * Log member activity to audit trail.
   */
  private async logActivity(
    organizationId: string,
    userId: string,
    action: string,
    resourceId: string,
    metadata?: Record<string, any>,
  ) {
    await this.prisma.activityLog.create({
      data: {
        organizationId,
        userId,
        action,
        resourceType: 'MEMBER',
        resourceId,
        metadata: metadata ?? {},
      },
    });
  }

  // ─────────────────────────────────────────
  // LIST MEMBERS
  // ─────────────────────────────────────────

  /**
   * List all members of an organization with pagination.
   * Supports filtering by role, status, and search by name/email.
   * Any active org member can list members (member:read permission).
   *
   * @param organizationId - Organization UUID
   * @param userId         - Requesting user
   * @param filters        - role, status, search
   * @param page           - Page number
   * @param limit          - Items per page
   */
  async listMembers(
    organizationId: string,
    userId: string,
    filters: {
      role?: MemberRole;
      status?: MemberStatus;
      search?: string;
    },
    page = 1,
    limit = 10,
  ) {
    await this.verifyMember(userId, organizationId);

    const skip = (page - 1) * limit;

    const where: any = {
      organizationId,
      status: filters.status ?? 'ACTIVE',
      ...(filters.role && { role: filters.role }),
      ...(filters.search && {
        user: {
          OR: [
            {
              firstName: {
                contains: filters.search,
                mode: 'insensitive',
              },
            },
            {
              lastName: {
                contains: filters.search,
                mode: 'insensitive',
              },
            },
            {
              email: {
                contains: filters.search,
                mode: 'insensitive',
              },
            },
          ],
        },
      }),
    };

    const [members, total] = await Promise.all([
      this.prisma.organizationMember.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatar: true,
              lastLoginAt: true,
              isEmailVerified: true,
            },
          },
          // Include custom role assignments count
          roleAssignments: {
            select: { role: { select: { name: true } } },
          },
        },
        skip,
        take: limit,
        orderBy: [
          // OWNER first, then ADMIN, then MEMBER, then GUEST
          { role: 'asc' },
          { joinedAt: 'asc' },
        ],
      }),

      this.prisma.organizationMember.count({ where }),
    ]);

    return {
      members,
      meta: this.buildPaginationMeta(page, limit, total),
    };
  }

  // ─────────────────────────────────────────
  // GET SINGLE MEMBER
  // ─────────────────────────────────────────

  /**
   * Get a single organization member by their membership ID.
   * Returns member details including user info and custom roles.
   *
   * @throws 404 - If member not found in this org
   */
  async getMember(
    memberId: string,
    organizationId: string,
    userId: string,
  ) {
    await this.verifyMember(userId, organizationId);

    const member = await this.prisma.organizationMember.findFirst({
      where: {
        id: memberId,
        organizationId,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
            lastLoginAt: true,
            isEmailVerified: true,
            createdAt: true,
          },
        },
        inviter: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        roleAssignments: {
          include: {
            role: {
              select: {
                id: true,
                name: true,
                displayName: true,
              },
            },
          },
        },
      },
    });

    if (!member) {
      throw ApiError.notFound('Member not found in this organization');
    }

    return { member };
  }

  // ─────────────────────────────────────────
  // UPDATE MEMBER ROLE
  // ─────────────────────────────────────────

  /**
   * Update a member's base role (ADMIN ↔ MEMBER ↔ GUEST).
   * OWNER role cannot be assigned here — use transferOwnership instead.
   *
   * Rules:
   * - Cannot change the OWNER's role (use transferOwnership)
   * - Cannot demote yourself if you are the last ADMIN/OWNER
   * - ADMIN can manage MEMBER/GUEST but cannot promote to ADMIN (OWNER only)
   *
   * @throws 403 - If requester is not OWNER or ADMIN
   * @throws 400 - If trying to change OWNER role
   * @throws 404 - If member not found
   */
  async updateMemberRole(
    memberId: string,
    organizationId: string,
    requesterId: string,
    newRole: MemberRole,
  ) {
    this.log('Updating member role', { memberId, newRole });

    const requester = await this.verifyAdminOrOwner(requesterId, organizationId);

    const targetMember = await this.prisma.organizationMember.findFirst({
      where: { id: memberId, organizationId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!targetMember) {
      throw ApiError.notFound('Member not found in this organization');
    }

    // Cannot change OWNER role — they must use transferOwnership
    if (targetMember.role === MemberRole.OWNER) {
      throw ApiError.badRequest(
        'Cannot change the OWNER role. Use the transfer-ownership endpoint instead.',
      );
    }

    // ADMIN can only promote to MEMBER/GUEST — not to ADMIN (OWNER privilege)
    if (
      requester.role === MemberRole.ADMIN &&
      newRole === MemberRole.ADMIN
    ) {
      throw ApiError.forbidden(
        'Only the organization OWNER can promote members to ADMIN.',
      );
    }

    // Cannot change your own role
    if (targetMember.userId === requesterId) {
      throw ApiError.badRequest(
        'You cannot change your own role.',
      );
    }

    const updated = await this.prisma.organizationMember.update({
      where: { id: memberId },
      data: { role: newRole },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    await this.logActivity(
      organizationId,
      requesterId,
      'MEMBER_ROLE_UPDATED',
      memberId,
      {
        userId: targetMember.userId,
        oldRole: targetMember.role,
        newRole,
        memberName: `${targetMember.user.firstName} ${targetMember.user.lastName}`,
      },
    );

    this.log('Member role updated', { memberId, oldRole: targetMember.role, newRole });

    await notificationService.createNotification({
      userId: targetMember.userId, // 👈 notify the member whose role changed
      organizationId,
      type: NotificationType.MEMBER_ROLE_UPDATED,
      title: 'Role updated',
      message: `Your role has been changed to ${newRole}`,
      metadata: {
        memberId,
        oldRole: targetMember.role,
        newRole,
      },
    });

    return { member: updated };
  }

  // ─────────────────────────────────────────
  // REMOVE MEMBER
  // ─────────────────────────────────────────

  /**
   * Remove a member from the organization.
   *
   * Rules:
   * - Cannot remove the OWNER
   * - OWNER can remove anyone (except themselves)
   * - ADMIN can remove MEMBER/GUEST only (not other ADMINs)
   * - Members can remove themselves (self-removal / leave org)
   *
   * @throws 400 - If trying to remove the OWNER
   * @throws 403 - If ADMIN tries to remove another ADMIN
   * @throws 404 - If member not found
   */
  async removeMember(
    memberId: string,
    organizationId: string,
    requesterId: string,
  ) {
    this.log('Removing member', { memberId });

    const targetMember = await this.prisma.organizationMember.findFirst({
      where: { id: memberId, organizationId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!targetMember) {
      throw ApiError.notFound('Member not found in this organization');
    }

    // Cannot remove the OWNER under any circumstances
    if (targetMember.role === MemberRole.OWNER) {
      throw ApiError.badRequest(
        'Cannot remove the organization OWNER. Transfer ownership first.',
      );
    }

    const isSelfRemoval = targetMember.userId === requesterId;

    if (!isSelfRemoval) {
      const requester = await this.verifyAdminOrOwner(requesterId, organizationId);

      // ADMIN cannot remove other ADMINs — only OWNER can
      if (
        requester.role === MemberRole.ADMIN &&
        targetMember.role === MemberRole.ADMIN
      ) {
        throw ApiError.forbidden(
          'ADMIN cannot remove another ADMIN. Only the OWNER can remove admins.',
        );
      }
    }

    await this.prisma.organizationMember.delete({
      where: { id: memberId },
    });

    await this.logActivity(
      organizationId,
      requesterId,
      isSelfRemoval ? 'MEMBER_LEFT' : 'MEMBER_REMOVED',
      memberId,
      {
        removedUserId: targetMember.userId,
        removedUserName: `${targetMember.user.firstName} ${targetMember.user.lastName}`,
        role: targetMember.role,
        isSelfRemoval,
      },
    );

    this.log('Member removed', { memberId, isSelfRemoval });

    if (isSelfRemoval) {
      await notificationService.createNotification({
        userId: requesterId,
        organizationId,
        type: NotificationType.MEMBER_LEFT,
        title: 'You left the organization',
        message: `You have left the organization`,
      });
    }
    else {
      await notificationService.createNotification({
        userId: targetMember.userId,
        organizationId,
        type: NotificationType.MEMBER_REMOVED,
        title: 'Removed from organization',
        message: `You have been removed from the organization`,
        metadata: {
          memberId,
        },
      });
    }
    return {
      message: isSelfRemoval
        ? 'You have left the organization'
        : 'Member removed successfully',
    };
  }

  // ─────────────────────────────────────────
  // GET MEMBER PROFILE
  // ─────────────────────────────────────────

  /**
   * Get a member's profile within the organization.
   * Includes their assigned tasks, team memberships, and recent activity.
   *
   * Useful for: member detail page, performance overview, workload view.
   *
   * @param memberId       - OrganizationMember UUID
   * @param organizationId - Organization UUID
   * @param userId         - Requesting user
   */
  async getMemberProfile(
    memberId: string,
    organizationId: string,
    userId: string,
  ) {
    await this.verifyMember(userId, organizationId);

    const member = await this.prisma.organizationMember.findFirst({
      where: { id: memberId, organizationId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
            createdAt: true,
            lastLoginAt: true,
          },
        },
      },
    });

    if (!member) {
      throw ApiError.notFound('Member not found in this organization');
    }

    // Run all profile queries in parallel
    const [
      assignedTasks,
      teamMemberships,
      recentActivity,
      taskStats,
    ] = await Promise.all([
      // Assigned tasks (active only — not DONE)
      this.prisma.task.findMany({
        where: {
          organizationId,
          assignedTo: member.userId,
          status: { not: 'DONE' },
        },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          project: {
            select: { id: true, name: true },
          },
        },
        orderBy: { dueDate: 'asc' },
        take: 10,
      }),

      // Teams this member belongs to
      this.prisma.teamMember.findMany({
        where: {
          userId: member.userId,
          team: {
            organizationId, // ✅ filter via relation
          },
        },
        include: {
          team: {
            select: {
              id: true,
              name: true,
              leaderId: true,
            },
          },
        },
      }),

      // Recent activity by this member in the org
      this.prisma.activityLog.findMany({
        where: {
          organizationId,
          userId: member.userId,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          action: true,
          resourceType: true,
          resourceId: true,
          createdAt: true,
          metadata: true,
        },
      }),

      // Task completion stats
      this.prisma.task.groupBy({
        by: ['status'],
        where: {
          organizationId,
          assignedTo: member.userId,
        },
        _count: { status: true },
      }),
    ]);

    // Format task stats into readable object
    const taskSummary = taskStats.reduce(
      (acc, item) => {
        acc[item.status.toLowerCase()] = item._count.status;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      member: {
        ...member,
        profile: {
          assignedTasks,
          teams: teamMemberships
            .filter(tm => tm.team)
            .map(tm => ({
              ...tm.team,
              isLeader: tm.team?.leaderId === member.userId,
              teamRole: tm.role,
            })),
          recentActivity,
          taskSummary: {
            total: Object.values(taskSummary).reduce((a, b) => a + b, 0),
            ...taskSummary,
          },
        },
      },
    };
  }

  // ─────────────────────────────────────────
  // TRANSFER OWNERSHIP
  // ─────────────────────────────────────────

  /**
   * Transfer organization ownership from current OWNER to an existing ADMIN.
   *
   * WHY REQUIRE TARGET TO BE ADMIN FIRST?
   * Ownership transfer is irreversible (the old OWNER becomes ADMIN).
   * Requiring the target to already be ADMIN ensures they:
   *   1. Are trusted by the org (promoted to ADMIN deliberately)
   *   2. Understand the org (have been active as admin)
   *   3. Accept the responsibility (they are already managing)
   *
   * Transfer steps (atomic transaction):
   *   1. Demote current OWNER → ADMIN
   *   2. Promote target ADMIN → OWNER
   *   3. Update org.ownerId to new owner's userId
   *
   * @throws 403 - If requester is not the OWNER
   * @throws 400 - If target is not an ADMIN
   * @throws 404 - If target user not found as active member
   */
  async transferOwnership(
    organizationId: string,
    requesterId: string,
    newOwnerUserId: string,
  ) {
    this.log('Transferring ownership', { organizationId, newOwnerUserId });

    // Verify requester IS the current owner
    const currentOwnerMember = await this.prisma.organizationMember.findFirst({
      where: {
        userId: requesterId,
        organizationId,
        status: 'ACTIVE',
        role: MemberRole.OWNER,
      },
    });

    if (!currentOwnerMember) {
      throw ApiError.forbidden(
        'Only the current organization OWNER can transfer ownership.',
      );
    }

    // Cannot transfer to yourself
    if (requesterId === newOwnerUserId) {
      throw ApiError.badRequest(
        'You cannot transfer ownership to yourself.',
      );
    }

    // Target must be an active ADMIN
    const newOwnerMember = await this.prisma.organizationMember.findFirst({
      where: {
        userId: newOwnerUserId,
        organizationId,
        status: 'ACTIVE',
        role: MemberRole.ADMIN,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!newOwnerMember) {
      throw ApiError.badRequest(
        'The new owner must be an active ADMIN of this organization. ' +
        'Promote them to ADMIN first.',
      );
    }

    // Execute transfer atomically — all three updates or none
    await this.prisma.$transaction(async (tx) => {
      // 1. Demote current OWNER → ADMIN
      await tx.organizationMember.update({
        where: { id: currentOwnerMember.id },
        data: { role: MemberRole.ADMIN },
      });

      // 2. Promote target ADMIN → OWNER
      await tx.organizationMember.update({
        where: { id: newOwnerMember.id },
        data: { role: MemberRole.OWNER },
      });

      // 3. Update org.ownerId
      await tx.organization.update({
        where: { id: organizationId },
        data: { ownerId: newOwnerUserId },
      });
    });

    await this.logActivity(
      organizationId,
      requesterId,
      'OWNERSHIP_TRANSFERRED',
      newOwnerMember.id,
      {
        previousOwnerId: requesterId,
        newOwnerId: newOwnerUserId,
        newOwnerName: `${newOwnerMember.user.firstName} ${newOwnerMember.user.lastName}`,
      },
    );

    this.log('Ownership transferred', {
      from: requesterId,
      to: newOwnerUserId,
    });

    // Notify NEW OWNER
    await notificationService.createNotification({
      userId: newOwnerUserId,
      organizationId,
      type: NotificationType.OWNERSHIP_RECEIVED,
      title: 'You are now the owner',
      message: `You are now the owner of the organization`,
      metadata: {
        previousOwnerId: requesterId,
      },
    });

    // Notify OLD OWNER
    await notificationService.createNotification({
      userId: requesterId,
      organizationId,
      type: NotificationType.OWNERSHIP_TRANSFERRED,
      title: 'Ownership transferred',
      message: `You transferred ownership to ${newOwnerMember.user.firstName}`,
      metadata: {
        newOwnerId: newOwnerUserId,
      },
    });

    return {
      message: `Ownership transferred to ${newOwnerMember.user.firstName} ${newOwnerMember.user.lastName}`,
      newOwner: newOwnerMember.user,
    };
  }

  // ─────────────────────────────────────────
  // SEARCH MEMBERS
  // ─────────────────────────────────────────

  /**
   * Quick search for members by name or email.
   * Used for autocomplete when assigning tasks, adding to teams etc.
   * Returns a lightweight list — no pagination, max 20 results.
   *
   * @param organizationId - Organization UUID
   * @param userId         - Requesting user
   * @param query          - Search string (min 2 chars)
   */
  async searchMembers(
    organizationId: string,
    userId: string,
    query: string,
  ) {
    await this.verifyMember(userId, organizationId);

    if (query.length < 2) {
      throw ApiError.badRequest('Search query must be at least 2 characters');
    }

    const members = await this.prisma.organizationMember.findMany({
      where: {
        organizationId,
        status: 'ACTIVE',
        user: {
          OR: [
            { firstName: { contains: query, mode: 'insensitive' } },
            { lastName: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
          ],
        },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
          },
        },
      },
      take: 20,
      orderBy: { user: { firstName: 'asc' } },
    });

    return { members };
  }
}

export default new MemberService();