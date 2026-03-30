/**
 * @file team.service.ts
 * @description Business logic for Team management
 *
 * TEAMS IN MULTI-TENANCY:
 * Every team belongs to ONE organization.
 * All queries filter by organizationId to enforce tenant isolation.
 * A user must be an org member before they can be a team member.
 *
 * TEAM ROLES vs ORG ROLES:
 * OrganizationMember.role → OWNER, ADMIN, MEMBER, GUEST (org-level)
 * TeamMember.role         → TEAM_LEAD, MEMBER (team-level)
 * These are independent — an org MEMBER can be a TEAM_LEAD
 *
 * ACTIVITY LOGGING:
 * All team mutations (create, update, delete, member changes)
 * are logged to ActivityLog for audit trail purposes.
 *
 * Methods:
 *   - createTeam()         → Create team + optionally add leader
 *   - getTeams()           → Paginated list of org teams
 *   - getTeamById()        → Single team with members
 *   - updateTeam()         → Update name/description/leader
 *   - deleteTeam()         → Delete team (cascades members)
 *   - addTeamMember()      → Add org member to team
 *   - updateTeamMember()   → Change team member role
 *   - removeTeamMember()   → Remove member from team
 *   - getTeamMembers()     → List team members with pagination
 */

import { BaseService } from '@/common/BaseService';
import ApiError from '@/utils/ApiError';
import { TeamMemberRole } from '@prisma/client';

class TeamService extends BaseService {

  // ─────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────

  /**
   * Log team activity to the ActivityLog table.
   * Used for audit trail — who did what to which team and when.
   *
   * @param organizationId - Organization UUID
   * @param userId         - User who performed the action
   * @param action         - Action performed e.g. 'TEAM_CREATED'
   * @param teamId         - Team UUID
   * @param metadata       - Additional context (optional)
   */
  private async logActivity(
    organizationId: string,
    userId: string,
    action: string,
    teamId: string,
    metadata?: Record<string, any>) {
    await this.prisma.activityLog.create({
      data: {
        organizationId,
        userId,
        action,
        resourceType: 'TEAM',
        resourceId: teamId,
        metadata: metadata ?? {},
      },
    });
  }

  /**
   * Verify user is an active org member and return their membership.
   * All team operations require org membership first.
   *
   * @throws 403 if user is not an active org member
   */
  private async verifyOrgMember(userId: string, organizationId: string) {
    const member = await this.prisma.organizationMember.findFirst({
      where: {
        userId,
        organizationId,
        status: 'ACTIVE',
      },
    });

    if (!member) {
      throw ApiError.forbidden(
        'You must be an active organization member to perform this action',
      );
    }

    return member;
  }

  /**
   * Verify user has OWNER or ADMIN role in the org.
   * Required for team creation, deletion, and member management.
   *
   * @throws 403 if user is not OWNER or ADMIN
   */
  private async verifyOrgAdmin(userId: string, organizationId: string) {
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

  // ─────────────────────────────────────────
  // CREATE TEAM
  // ─────────────────────────────────────────

  /**
   * Create a new team within an organization.
   * Optionally assigns a leader on creation.
   *
   * WHY ADD LEADER AS TEAM MEMBER?
   * The leader field on Team is just a reference (leaderId).
   * For the leader to appear in team member lists and have
   * team-level access, they must also be in TeamMember table.
   *
   * @param organizationId - Organization UUID
   * @param userId         - Creating user's ID
   * @param data           - Team data (name, description, leaderId)
   * @throws 403           - If user is not OWNER or ADMIN
   * @throws 404           - If leaderId provided but user not found in org
   */
  async createTeam(organizationId: string,userId: string,data: {
      name: string;
      description?: string;
      leaderId?: string;
    }) {
    this.log('Creating team', { organizationId, name: data.name });

    await this.verifyOrgAdmin(userId, organizationId);

    // If leaderId provided, verify they are an active org member
    if (data.leaderId) {
      const leaderMember = await this.prisma.organizationMember.findFirst({
        where: {
          userId: data.leaderId,
          organizationId,
          status: 'ACTIVE',
        },
      });

      if (!leaderMember) {
        throw ApiError.notFound(
          'Specified leader is not an active member of this organization',
        );
      }
    }

    // Create team and add leader as TEAM_LEAD member in one transaction
    const team = await this.prisma.$transaction(async (tx) => {
      const newTeam = await tx.team.create({
        data: {
          organizationId,
          name: data.name,
          description: data.description,
          leaderId: data.leaderId,
        },
        include: {
          _count: {
            select: { members: true },
          },
        },
      });

      // Add leader as TEAM_LEAD member if provided
      if (data.leaderId) {
        await tx.teamMember.create({
          data: {
            teamId: newTeam.id,
            userId: data.leaderId,
            role: TeamMemberRole.TEAM_LEAD,
          },
        });
      }

      return newTeam;
    });

    // Log activity
    await this.logActivity(organizationId, userId, 'TEAM_CREATED', team.id, {
      teamName: team.name,
      leaderId: data.leaderId,
    });

    this.log('Team created successfully', { teamId: team.id });

    return { team };
  }

  // ─────────────────────────────────────────
  // GET TEAMS (paginated)
  // ─────────────────────────────────────────

  /**
   * Get all teams in an organization with pagination and search.
   * Any active org member can list teams.
   *
   * @param organizationId - Organization UUID
   * @param userId         - Requesting user's ID
   * @param page           - Page number
   * @param limit          - Items per page
   * @param search         - Optional name search
   */
  async getTeams(
    organizationId: string,
    userId: string,
    page = 1,
    limit = 10,
    search?: string,
  ) {
    await this.verifyOrgMember(userId, organizationId);

    const skip = (page - 1) * limit;

    // Build where clause — always filter by org for tenant isolation
    const where: any = {
      organizationId,
      ...(search && {
        name: {
          contains: search,
          mode: 'insensitive',
        },
      }),
    };

    const [teams, total] = await Promise.all([
      this.prisma.team.findMany({
        where,
        include: {
          _count: {
            select: { members: true, projects: true },
          },
          // Include leader details
          members: {
            where: { role: TeamMemberRole.TEAM_LEAD },
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
            take: 1, // Only one leader
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),

      this.prisma.team.count({ where }),
    ]);

    return {
      teams,
      meta: this.buildPaginationMeta(page, limit, total),
    };
  }

  // ─────────────────────────────────────────
  // GET TEAM BY ID
  // ─────────────────────────────────────────

  /**
   * Get a single team with full member details.
   * Any active org member can view a team.
   *
   * @param teamId         - Team UUID
   * @param organizationId - Organization UUID (for tenant isolation)
   * @param userId         - Requesting user's ID
   * @throws 404           - If team not found in this org
   */
  async getTeamById(
    teamId: string,
    organizationId: string,
    userId: string,
  ) {
    await this.verifyOrgMember(userId, organizationId);

    // organizationId in where clause enforces tenant isolation
    // A team from Org A cannot be fetched by Org B even with a valid teamId
    const team = await this.prisma.team.findFirst({
      where: {
        id: teamId,
        organizationId,
      },
      include: {
        members: {
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
          orderBy: [
            { role: 'asc' },      // TEAM_LEAD first
            { createdAt: 'asc' }, // then by join date
          ],
        },
        projects: {
          where: { status: { not: 'ARCHIVED' } },
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
        _count: {
          select: {
            members: true,
            projects: true,
          },
        },
      },
    });

    if (!team) {
      throw ApiError.notFound('Team not found');
    }

    return { team };
  }

  // ─────────────────────────────────────────
  // UPDATE TEAM
  // ─────────────────────────────────────────

  /**
   * Update team name, description, or leader.
   * Team LEAD or org OWNER/ADMIN can update.
   *
   * WHY ALLOW TEAM_LEAD TO UPDATE?
   * The team lead runs the team day-to-day — they should be able
   * to update their own team's name and description without needing
   * an org admin to do it for them.
   *
   * @throws 403 - If user is not team lead or org OWNER/ADMIN
   * @throws 404 - If team not found
   */
  async updateTeam(
    teamId: string,
    organizationId: string,
    userId: string,
    data: {
      name?: string;
      description?: string | null;
      leaderId?: string | null;
    },
  ) {
    this.log('Updating team', { teamId });

    const team = await this.prisma.team.findFirst({
      where: { id: teamId, organizationId },
    });

    if (!team) {
      throw ApiError.notFound('Team not found');
    }

    // Check: team lead OR org OWNER/ADMIN
    const isTeamLead = team.leaderId === userId;

    if (!isTeamLead) {
      await this.verifyOrgAdmin(userId, organizationId);
    }

    // If changing leader, verify new leader is an org member
    if (data.leaderId) {
      const newLeaderMember = await this.prisma.organizationMember.findFirst({
        where: {
          userId: data.leaderId,
          organizationId,
          status: 'ACTIVE',
        },
      });

      if (!newLeaderMember) {
        throw ApiError.notFound(
          'New leader is not an active member of this organization',
        );
      }
    }

    const updated = await this.prisma.team.update({
      where: { id: teamId },
      data,
      include: {
        _count: {
          select: { members: true },
        },
      },
    });

    // Log activity
    await this.logActivity(
      organizationId,
      userId,
      'TEAM_UPDATED',
      teamId,
      { changes: data },
    );

    this.log('Team updated', { teamId });

    return { team: updated };
  }

  // ─────────────────────────────────────────
  // DELETE TEAM
  // ─────────────────────────────────────────

  /**
   * Delete a team and all its memberships.
   * Only org OWNER or ADMIN can delete teams.
   *
   * NOTE: TeamMember records cascade delete automatically
   * via Prisma's onDelete: Cascade on the TeamMember model.
   * Projects linked to this team have teamId set to NULL (SetNull).
   *
   * @throws 403 - If user is not org OWNER or ADMIN
   * @throws 404 - If team not found
   */
  async deleteTeam(
    teamId: string,
    organizationId: string,
    userId: string,
  ) {
    this.log('Deleting team', { teamId });

    await this.verifyOrgAdmin(userId, organizationId);

    const team = await this.prisma.team.findFirst({
      where: { id: teamId, organizationId },
    });

    if (!team) {
      throw ApiError.notFound('Team not found');
    }

    await this.prisma.team.delete({
      where: { id: teamId },
    });

    // Log activity after deletion
    await this.logActivity(
      organizationId,
      userId,
      'TEAM_DELETED',
      teamId,
      { teamName: team.name },
    );

    this.log('Team deleted', { teamId });

    return { message: 'Team deleted successfully' };
  }

  // ─────────────────────────────────────────
  // ADD TEAM MEMBER
  // ─────────────────────────────────────────

  /**
   * Add an organization member to a team.
   *
   * IMPORTANT RULE:
   * A user must be an active ORG member before they can join a team.
   * You cannot add someone to a team if they haven't joined the org.
   * This enforces the org → team hierarchy.
   *
   * @param teamId         - Team UUID
   * @param organizationId - Organization UUID
   * @param userId         - Requesting user's ID
   * @param targetUserId   - User to add to the team
   * @param role           - Team role (TEAM_LEAD or MEMBER)
   * @throws 400           - If user is already a team member
   * @throws 403           - If requester is not team lead or org OWNER/ADMIN
   * @throws 404           - If team or target user not found
   */
  async addTeamMember(
    teamId: string,
    organizationId: string,
    userId: string,
    targetUserId: string,
    role: TeamMemberRole = TeamMemberRole.MEMBER,
  ) {
    this.log('Adding team member', { teamId, targetUserId });

    const team = await this.prisma.team.findFirst({
      where: { id: teamId, organizationId },
    });

    if (!team) {
      throw ApiError.notFound('Team not found');
    }

    // Verify requester has permission (team lead or org OWNER/ADMIN)
    const isTeamLead = team.leaderId === userId;
    if (!isTeamLead) {
      await this.verifyOrgAdmin(userId, organizationId);
    }

    // Target user must be an active org member
    const targetOrgMember = await this.prisma.organizationMember.findFirst({
      where: {
        userId: targetUserId,
        organizationId,
        status: 'ACTIVE',
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

    if (!targetOrgMember) {
      throw ApiError.notFound(
        'User is not an active member of this organization',
      );
    }

    // Check if already a team member
    const existingMember = await this.prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId: targetUserId,
        },
      },
    });

    if (existingMember) {
      throw ApiError.conflict('User is already a member of this team');
    }

    const teamMember = await this.prisma.teamMember.create({
      data: {
        teamId,
        userId: targetUserId,
        role,
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
    });

    // Log activity
    await this.logActivity(
      organizationId,
      userId,
      'TEAM_MEMBER_ADDED',
      teamId,
      {
        addedUserId: targetUserId,
        addedUserName: `${targetOrgMember.user.firstName} ${targetOrgMember.user.lastName}`,
        role,
      },
    );

    this.log('Team member added', { teamId, targetUserId });

    return { teamMember };
  }

  // ─────────────────────────────────────────
  // UPDATE TEAM MEMBER ROLE
  // ─────────────────────────────────────────

  /**
   * Update a team member's role (TEAM_LEAD ↔ MEMBER).
   * Only org OWNER/ADMIN can change team roles.
   *
   * @throws 404 - If team member not found
   * @throws 403 - If requester is not org OWNER or ADMIN
   */
  async updateTeamMember(
    teamId: string,
    organizationId: string,
    userId: string,
    memberId: string,
    role: TeamMemberRole,
  ) {
    this.log('Updating team member role', { teamId, memberId, role });

    await this.verifyOrgAdmin(userId, organizationId);

    const teamMember = await this.prisma.teamMember.findFirst({
      where: {
        id: memberId,
        teamId,
        team: { organizationId },
      },
    });

    if (!teamMember) {
      throw ApiError.notFound('Team member not found');
    }

    const updated = await this.prisma.teamMember.update({
      where: { id: memberId },
      data: { role },
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

    // If promoting to TEAM_LEAD, update the team's leaderId
    if (role === TeamMemberRole.TEAM_LEAD) {
      await this.prisma.team.update({
        where: { id: teamId },
        data: { leaderId: teamMember.userId },
      });
    }

    await this.logActivity(
      organizationId,
      userId,
      'TEAM_MEMBER_ROLE_UPDATED',
      teamId,
      { memberId, newRole: role },
    );

    return { teamMember: updated };
  }

  // ─────────────────────────────────────────
  // REMOVE TEAM MEMBER
  // ─────────────────────────────────────────

  /**
   * Remove a member from a team.
   * Team lead or org OWNER/ADMIN can remove members.
   * Members can also remove themselves (self-removal).
   *
   * @throws 404 - If team member not found
   * @throws 403 - If requester lacks permission
   */
  async removeTeamMember(
    teamId: string,
    organizationId: string,
    userId: string,
    memberId: string,
  ) {
    this.log('Removing team member', { teamId, memberId });

    const team = await this.prisma.team.findFirst({
      where: { id: teamId, organizationId },
    });

    if (!team) {
      throw ApiError.notFound('Team not found');
    }

    const teamMember = await this.prisma.teamMember.findFirst({
      where: {
        id: memberId,
        teamId,
      },
    });

    if (!teamMember) {
      throw ApiError.notFound('Team member not found');
    }

    // Allow: self-removal, team lead, or org OWNER/ADMIN
    const isSelf = teamMember.userId === userId;
    const isTeamLead = team.leaderId === userId;

    if (!isSelf && !isTeamLead) {
      await this.verifyOrgAdmin(userId, organizationId);
    }

    await this.prisma.teamMember.delete({
      where: { id: memberId },
    });

    // If removed member was the leader, clear leaderId on team
    if (team.leaderId === teamMember.userId) {
      await this.prisma.team.update({
        where: { id: teamId },
        data: { leaderId: null },
      });
    }

    await this.logActivity(
      organizationId,
      userId,
      'TEAM_MEMBER_REMOVED',
      teamId,
      { removedMemberId: memberId, isSelfRemoval: isSelf },
    );

    this.log('Team member removed', { teamId, memberId });

    return { message: 'Team member removed successfully' };
  }

  // ─────────────────────────────────────────
  // GET TEAM MEMBERS
  // ─────────────────────────────────────────

  /**
   * Get all members of a team with pagination.
   * Any active org member can view team members.
   *
   * @param teamId         - Team UUID
   * @param organizationId - Organization UUID
   * @param userId         - Requesting user's ID
   * @param page           - Page number
   * @param limit          - Items per page
   */
  async getTeamMembers(
    teamId: string,
    organizationId: string,
    userId: string,
    page = 1,
    limit = 10,
  ) {
    await this.verifyOrgMember(userId, organizationId);

    // Verify team belongs to this org — tenant isolation
    const team = await this.prisma.team.findFirst({
      where: { id: teamId, organizationId },
    });

    if (!team) {
      throw ApiError.notFound('Team not found');
    }

    const skip = (page - 1) * limit;

    const [members, total] = await Promise.all([
      this.prisma.teamMember.findMany({
        where: { teamId },
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
        skip,
        take: limit,
        orderBy: [
          { role: 'asc' },      // TEAM_LEAD appears first
          { createdAt: 'asc' },
        ],
      }),

      this.prisma.teamMember.count({ where: { teamId } }),
    ]);

    return {
      members,
      meta: this.buildPaginationMeta(page, limit, total),
    };
  }
}

export default new TeamService();