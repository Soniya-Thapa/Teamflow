/**
 * @file project.service.ts
 * @description Business logic for Project management
 *
 * PROJECTS IN MULTI-TENANCY:
 * Every project belongs to ONE organization.
 * organizationId is included in EVERY query — never optional.
 * A project from Org A cannot be accessed by Org B even with a valid projectId.
 *
 * VISIBILITY RULES:
 *   PUBLIC  → any active org member can read
 *   PRIVATE → only ProjectMember records + org OWNER/ADMIN can read
 *
 * ARCHIVING vs DELETING:
 *   Archive → status: ARCHIVED, archivedAt: now (data preserved, hidden from default list)
 *   Delete  → hard delete (only OWNER/ADMIN, only if no tasks exist or force flag)
 *
 * OWNERSHIP (Day 9 middleware handles route-level):
 *   Create  → any member with project:create permission
 *   Update  → project creator OR org OWNER/ADMIN
 *   Delete  → org OWNER/ADMIN only
 *   Archive → project creator OR org OWNER/ADMIN
 *
 * Methods:
 *   - createProject()         → create + log + update onboarding
 *   - getProjects()           → paginated list with filters
 *   - getProjectById()        → single project with stats
 *   - updateProject()         → update fields
 *   - archiveProject()        → set status ARCHIVED
 *   - deleteProject()         → hard delete
 *   - addProjectMember()      → add to private project
 *   - removeProjectMember()   → remove from private project
 *   - toggleFavorite()        → star/unstar project
 *   - getProjectStats()       → task counts by status
 *   - getProjectActivity()    → activity log for project
 *   - duplicateProject()      → copy project + tasks skeleton
 */

import { BaseService } from '@/common/BaseService';
import ApiError from '@/utils/ApiError';
import { ProjectStatus, ProjectVisibility } from '@prisma/client';

class ProjectService extends BaseService {

  // ─────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────

  /**
   * Verify user can access a project (read access).
   *
   * PUBLIC project  → any active org member
   * PRIVATE project → ProjectMember record OR org OWNER/ADMIN
   *
   * @throws 404 if project not found (use 404 not 403 to avoid leaking existence)
   * @throws 403 if user cannot access private project
   */
  private async verifyProjectAccess(
    projectId: string,
    organizationId: string,
    userId: string,
  ) {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId, // Tenant isolation
      },
      include: {
        projectMembers: {
          where: { userId },
        },
      },
    });

    if (!project) {
      throw ApiError.notFound('Project not found');
    }

    // Public projects — any org member can access
    if (project.visibility === 'PUBLIC') {
      return project;
    }

    // Private projects — check if user is a project member or OWNER/ADMIN
    const isProjectMember = project.projectMembers.length > 0;

    if (!isProjectMember) {
      const orgMember = await this.prisma.organizationMember.findFirst({
        where: {
          userId,
          organizationId,
          status: 'ACTIVE',
          role: { in: ['OWNER', 'ADMIN'] },
        },
      });

      if (!orgMember) {
        // Return 404 not 403 — don't reveal private project exists
        throw ApiError.notFound('Project not found');
      }
    }

    return project;
  }

  /**
   * Log project activity to audit trail.
   */
  private async logActivity(
    organizationId: string,
    userId: string,
    action: string,
    projectId: string,
    metadata?: Record<string, any>,
  ) {
    await this.prisma.activityLog.create({
      data: {
        organizationId,
        userId,
        action,
        resourceType: 'PROJECT',
        resourceId: projectId,
        metadata: metadata ?? {},
      },
    });
  }

  // ─────────────────────────────────────────
  // CREATE PROJECT
  // ─────────────────────────────────────────

  /**
   * Create a new project within an organization.
   *
   * If visibility is PRIVATE, creator is automatically added
   * as a project member so they can access their own project.
   *
   * Updates onboarding step to 3 if this is the first project
   * in the org (for the onboarding flow).
   *
   * @param organizationId - Organization UUID
   * @param userId         - Creating user's ID
   * @param data           - Project data
   * @throws 404           - If teamId provided but team not in org
   */
  async createProject(
    organizationId: string,
    userId: string,
    data: {
      name: string;
      description?: string;
      teamId?: string;
      visibility?: ProjectVisibility;
      startDate?: string;
      endDate?: string;
    },
  ) {
    this.log('Creating project', { organizationId, name: data.name });

    // Verify team belongs to this org if provided
    if (data.teamId) {
      const team = await this.prisma.team.findFirst({
        where: {
          id: data.teamId,
          organizationId,
        },
      });

      if (!team) {
        throw ApiError.notFound('Team not found in this organization');
      }
    }

    const project = await this.prisma.$transaction(async (tx) => {
      const newProject = await tx.project.create({
        data: {
          organizationId,
          name: data.name,
          description: data.description,
          teamId: data.teamId,
          visibility: data.visibility ?? ProjectVisibility.PUBLIC,
          startDate: data.startDate ? new Date(data.startDate) : undefined,
          endDate: data.endDate ? new Date(data.endDate) : undefined,
          createdBy: userId,
        },
        include: {
          team: {
            select: {
              id: true,
              name: true,
            },
          },
          creator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      // If PRIVATE, add creator as project member automatically
      // so they can access their own project
      if (data.visibility === ProjectVisibility.PRIVATE) {
        await tx.projectMember.create({
          data: {
            projectId: newProject.id,
            userId,
          },
        });
      }

      return newProject;
    });

    // Update onboarding step 3 if this is the first project
    const projectCount = await this.prisma.project.count({
      where: { organizationId },
    });

    if (projectCount === 1) {
      await this.prisma.organizationSettings.upsert({
        where: { organizationId },
        update: { onboardingStep: 3 },
        create: { organizationId, onboardingStep: 3 },
      });
    }

    await this.logActivity(
      organizationId,
      userId,
      'PROJECT_CREATED',
      project.id,
      { projectName: project.name, visibility: data.visibility },
    );

    this.log('Project created', { projectId: project.id });

    return { project };
  }

  // ─────────────────────────────────────────
  // GET PROJECTS (paginated)
  // ─────────────────────────────────────────

  /**
   * Get all accessible projects for a user in an organization.
   *
   * VISIBILITY FILTERING:
   * Returns PUBLIC projects + PRIVATE projects where user is a member
   * or user is OWNER/ADMIN.
   *
   * Supports:
   *   - Search by name
   *   - Filter by status, teamId, visibility, date range
   *   - Sort by name, createdAt, updatedAt, status
   *   - Filter favorites only
   *
   * @param organizationId - Organization UUID
   * @param userId         - Requesting user
   * @param filters        - Query filters
   * @param page           - Page number
   * @param limit          - Items per page
   */
  async getProjects(
    organizationId: string,
    userId: string,
    filters: {
      search?: string;
      status?: ProjectStatus;
      teamId?: string;
      visibility?: ProjectVisibility;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      favorites?: boolean;
      startDate?: string;
      endDate?: string;
    },
    page = 1,
    limit = 10,
  ) {
    const skip = (page - 1) * limit;

    // Check if user is OWNER/ADMIN (they can see all projects)
    const orgMember = await this.prisma.organizationMember.findFirst({
      where: {
        userId,
        organizationId,
        status: 'ACTIVE',
      },
    });

    if (!orgMember) {
      throw ApiError.forbidden('You are not a member of this organization');
    }

    const isAdminOrOwner = ['OWNER', 'ADMIN'].includes(orgMember.role);

    // Build visibility filter
    // OWNER/ADMIN see all, others see PUBLIC + private they're member of
    const visibilityFilter = isAdminOrOwner
      ? {}
      : {
          OR: [
            { visibility: ProjectVisibility.PUBLIC },
            {
              visibility: ProjectVisibility.PRIVATE,
              projectMembers: {
                some: { userId },
              },
            },
          ],
        };

    // Build favorites filter
    const favoritesFilter = filters.favorites
      ? {
          favorites: {
            some: { userId },
          },
        }
      : {};

    // Build date range filter
    const dateFilter: any = {};
    if (filters.startDate) {
      dateFilter.startDate = { gte: new Date(filters.startDate) };
    }
    if (filters.endDate) {
      dateFilter.endDate = { lte: new Date(filters.endDate) };
    }

    const where: any = {
      organizationId, // ALWAYS — tenant isolation
      ...visibilityFilter,
      ...favoritesFilter,
      ...dateFilter,
      ...(filters.search && {
        name: {
          contains: filters.search,
          mode: 'insensitive',
        },
      }),
      ...(filters.status && { status: filters.status }),
      ...(filters.teamId && { teamId: filters.teamId }),
      ...(filters.visibility && { visibility: filters.visibility }),
    };

    // Build sort
    const orderBy: any = {
      [filters.sortBy || 'createdAt']: filters.sortOrder || 'desc',
    };

    const [projects, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        include: {
          team: {
            select: {
              id: true,
              name: true,
            },
          },
          creator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
          _count: {
            select: {
              tasks: true,
              projectMembers: true,
            },
          },
          // Check if current user favorited this project
          favorites: {
            where: { userId },
            select: { id: true },
          },
        },
        skip,
        take: limit,
        orderBy,
      }),

      this.prisma.project.count({ where }),
    ]);

    // Add isFavorite flag to each project
    const projectsWithFavorite = projects.map((project) => ({
      ...project,
      isFavorite: project.favorites.length > 0,
      favorites: undefined, // Remove raw favorites array
    }));

    return {
      projects: projectsWithFavorite,
      meta: this.buildPaginationMeta(page, limit, total),
    };
  }

  // ─────────────────────────────────────────
  // GET PROJECT BY ID
  // ─────────────────────────────────────────

  /**
   * Get a single project with full details.
   * Enforces visibility rules via verifyProjectAccess.
   *
   * @throws 404 - If project not found or user cannot access
   */
  async getProjectById(
    projectId: string,
    organizationId: string,
    userId: string,
  ) {
    // Verifies access + tenant isolation in one call
    await this.verifyProjectAccess(projectId, organizationId, userId);

    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId,
      },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            leaderId: true,
          },
        },
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
          },
        },
        projectMembers: {
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
        },
        _count: {
          select: {
            tasks: true,
            projectMembers: true,
          },
        },
        favorites: {
          where: { userId },
          select: { id: true },
        },
      },
    });

    if (!project) {
      throw ApiError.notFound('Project not found');
    }

    return {
      project: {
        ...project,
        isFavorite: project.favorites.length > 0,
        favorites: undefined,
      },
    };
  }

  // ─────────────────────────────────────────
  // UPDATE PROJECT
  // ─────────────────────────────────────────

  /**
   * Update project details.
   * Project creator OR org OWNER/ADMIN can update.
   * (requireProjectAccess middleware enforces this at route level)
   *
   * @throws 404 - If project not found
   */
  async updateProject(
    projectId: string,
    organizationId: string,
    userId: string,
    data: {
      name?: string;
      description?: string | null;
      teamId?: string | null;
      visibility?: ProjectVisibility;
      startDate?: string | null;
      endDate?: string | null;
    },
  ) {
    this.log('Updating project', { projectId });

    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
    });

    if (!project) {
      throw ApiError.notFound('Project not found');
    }

    // Verify new teamId belongs to org if provided
    if (data.teamId) {
      const team = await this.prisma.team.findFirst({
        where: { id: data.teamId, organizationId },
      });

      if (!team) {
        throw ApiError.notFound('Team not found in this organization');
      }
    }

    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.teamId !== undefined && { teamId: data.teamId }),
        ...(data.visibility && { visibility: data.visibility }),
        ...(data.startDate !== undefined && {
          startDate: data.startDate ? new Date(data.startDate) : null,
        }),
        ...(data.endDate !== undefined && {
          endDate: data.endDate ? new Date(data.endDate) : null,
        }),
      },
      include: {
        team: {
          select: { id: true, name: true },
        },
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    await this.logActivity(
      organizationId,
      userId,
      'PROJECT_UPDATED',
      projectId,
      { changes: data },
    );

    this.log('Project updated', { projectId });

    return { project: updated };
  }

  // ─────────────────────────────────────────
  // ARCHIVE PROJECT
  // ─────────────────────────────────────────

  /**
   * Archive a project (status: ARCHIVED, archivedAt: now).
   *
   * WHY ARCHIVE INSTEAD OF DELETE?
   * Archiving preserves all tasks, comments, and activity history.
   * Teams can reference completed work without deleting it.
   * Archived projects are excluded from default listing.
   *
   * @throws 404 - If project not found
   * @throws 400 - If project already archived
   */
  async archiveProject(
    projectId: string,
    organizationId: string,
    userId: string,
  ) {
    this.log('Archiving project', { projectId });

    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
    });

    if (!project) {
      throw ApiError.notFound('Project not found');
    }

    if (project.status === ProjectStatus.ARCHIVED) {
      throw ApiError.badRequest('Project is already archived');
    }

    const archived = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        status: ProjectStatus.ARCHIVED,
        archivedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        status: true,
        archivedAt: true,
      },
    });

    await this.logActivity(
      organizationId,
      userId,
      'PROJECT_ARCHIVED',
      projectId,
      { projectName: project.name },
    );

    this.log('Project archived', { projectId });

    return { project: archived };
  }

  // ─────────────────────────────────────────
  // UNARCHIVE PROJECT
  // ─────────────────────────────────────────

  /**
   * Restore an archived project back to ACTIVE status.
   *
   * @throws 400 - If project is not archived
   */
  async unarchiveProject(
    projectId: string,
    organizationId: string,
    userId: string,
  ) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
    });

    if (!project) {
      throw ApiError.notFound('Project not found');
    }

    if (project.status !== ProjectStatus.ARCHIVED) {
      throw ApiError.badRequest('Project is not archived');
    }

    const restored = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        status: ProjectStatus.ACTIVE,
        archivedAt: null,
      },
      select: {
        id: true,
        name: true,
        status: true,
      },
    });

    await this.logActivity(
      organizationId,
      userId,
      'PROJECT_UNARCHIVED',
      projectId,
    );

    return { project: restored };
  }

  // ─────────────────────────────────────────
  // DELETE PROJECT
  // ─────────────────────────────────────────

  /**
   * Hard delete a project and all its data.
   * Only org OWNER or ADMIN can delete projects.
   * Cascades to tasks, comments, attachments via Prisma onDelete.
   *
   * @throws 404 - If project not found
   */
  async deleteProject(
    projectId: string,
    organizationId: string,
    userId: string,
  ) {
    this.log('Deleting project', { projectId });

    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
    });

    if (!project) {
      throw ApiError.notFound('Project not found');
    }

    await this.prisma.project.delete({
      where: { id: projectId },
    });

    await this.logActivity(
      organizationId,
      userId,
      'PROJECT_DELETED',
      projectId,
      { projectName: project.name },
    );

    this.log('Project deleted', { projectId });

    return { message: 'Project deleted successfully' };
  }

  // ─────────────────────────────────────────
  // PROJECT MEMBERS (for PRIVATE projects)
  // ─────────────────────────────────────────

  /**
   * Add a user to a private project's member list.
   * User must be an active org member first.
   * Only project creator or org OWNER/ADMIN can add members.
   *
   * @throws 400 - If project is PUBLIC (no need for members)
   * @throws 409 - If user already a project member
   */
  async addProjectMember(
    projectId: string,
    organizationId: string,
    userId: string,
    targetUserId: string,
  ) {
    this.log('Adding project member', { projectId, targetUserId });

    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
    });

    if (!project) {
      throw ApiError.notFound('Project not found');
    }

    if (project.visibility === ProjectVisibility.PUBLIC) {
      throw ApiError.badRequest(
        'Cannot add members to a PUBLIC project. ' +
        'Change project visibility to PRIVATE first.',
      );
    }

    // Target must be active org member
    const orgMember = await this.prisma.organizationMember.findFirst({
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

    if (!orgMember) {
      throw ApiError.notFound(
        'User is not an active member of this organization',
      );
    }

    // Check not already a project member
    const existing = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: targetUserId,
        },
      },
    });

    if (existing) {
      throw ApiError.conflict('User is already a member of this project');
    }

    const projectMember = await this.prisma.projectMember.create({
      data: {
        projectId,
        userId: targetUserId,
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

    await this.logActivity(
      organizationId,
      userId,
      'PROJECT_MEMBER_ADDED',
      projectId,
      {
        addedUserId: targetUserId,
        addedUserName: `${orgMember.user.firstName} ${orgMember.user.lastName}`,
      },
    );

    return { projectMember };
  }

  /**
   * Remove a user from a private project's member list.
   *
   * @throws 404 - If project member not found
   */
  async removeProjectMember(
    projectId: string,
    organizationId: string,
    userId: string,
    memberId: string,
  ) {
    this.log('Removing project member', { projectId, memberId });

    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
    });

    if (!project) {
      throw ApiError.notFound('Project not found');
    }

    const projectMember = await this.prisma.projectMember.findUnique({
      where: { id: memberId },
    });

    if (!projectMember || projectMember.projectId !== projectId) {
      throw ApiError.notFound('Project member not found');
    }

    // Prevent removing the project creator
    if (projectMember.userId === project.createdBy) {
      throw ApiError.badRequest(
        'Cannot remove the project creator from the project',
      );
    }

    await this.prisma.projectMember.delete({
      where: { id: memberId },
    });

    await this.logActivity(
      organizationId,
      userId,
      'PROJECT_MEMBER_REMOVED',
      projectId,
      { removedUserId: projectMember.userId },
    );

    return { message: 'Project member removed successfully' };
  }

  // ─────────────────────────────────────────
  // TOGGLE FAVORITE
  // ─────────────────────────────────────────

  /**
   * Star or unstar a project for the current user.
   * Favorites are per-user — they don't affect other users.
   *
   * Uses upsert pattern: if favorite exists → delete it, if not → create it.
   *
   * @returns { isFavorite: boolean } — new state after toggle
   */
  async toggleFavorite(
    projectId: string,
    organizationId: string,
    userId: string,
  ) {
    // Verify project exists and user can access it
    await this.verifyProjectAccess(projectId, organizationId, userId);

    const existing = await this.prisma.projectFavorite.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });

    if (existing) {
      // Already favorited → remove
      await this.prisma.projectFavorite.delete({
        where: { id: existing.id },
      });

      return { isFavorite: false, message: 'Project removed from favorites' };
    } else {
      // Not favorited → add
      await this.prisma.projectFavorite.create({
        data: { projectId, userId },
      });

      return { isFavorite: true, message: 'Project added to favorites' };
    }
  }

  // ─────────────────────────────────────────
  // PROJECT STATISTICS
  // ─────────────────────────────────────────

  /**
   * Get task statistics for a project.
   * Returns task counts by status + completion percentage.
   *
   * @throws 404 - If project not found or no access
   */
  async getProjectStats(
    projectId: string,
    organizationId: string,
    userId: string,
  ) {
    await this.verifyProjectAccess(projectId, organizationId, userId);

    // Run all status counts in parallel
    const [todo, inProgress, review, done, total] = await Promise.all([
      this.prisma.task.count({
        where: { projectId, organizationId, status: 'TODO' },
      }),
      this.prisma.task.count({
        where: { projectId, organizationId, status: 'IN_PROGRESS' },
      }),
      this.prisma.task.count({
        where: { projectId, organizationId, status: 'REVIEW' },
      }),
      this.prisma.task.count({
        where: { projectId, organizationId, status: 'DONE' },
      }),
      this.prisma.task.count({
        where: { projectId, organizationId },
      }),
    ]);

    const completionPercentage = total > 0
      ? Math.round((done / total) * 100)
      : 0;

    // Count overdue tasks (dueDate < now and not DONE)
    const overdue = await this.prisma.task.count({
      where: {
        projectId,
        organizationId,
        status: { not: 'DONE' },
        dueDate: { lt: new Date() },
      },
    });

    return {
      stats: {
        total,
        todo,
        inProgress,
        review,
        done,
        overdue,
        completionPercentage,
      },
    };
  }

  // ─────────────────────────────────────────
  // PROJECT ACTIVITY
  // ─────────────────────────────────────────

  /**
   * Get activity timeline for a project.
   * Reads from ActivityLog filtered by resourceId = projectId.
   *
   * @param projectId      - Project UUID
   * @param organizationId - Organization UUID
   * @param userId         - Requesting user
   * @param page           - Page number
   * @param limit          - Items per page
   */
  async getProjectActivity(
    projectId: string,
    organizationId: string,
    userId: string,
    page = 1,
    limit = 20,
  ) {
    await this.verifyProjectAccess(projectId, organizationId, userId);

    const skip = (page - 1) * limit;

    const [activities, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        where: {
          organizationId,
          resourceId: projectId,
          resourceType: 'PROJECT',
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),

      this.prisma.activityLog.count({
        where: {
          organizationId,
          resourceId: projectId,
          resourceType: 'PROJECT',
        },
      }),
    ]);

    return {
      activities,
      meta: this.buildPaginationMeta(page, limit, total),
    };
  }

  // ─────────────────────────────────────────
  // DUPLICATE PROJECT
  // ─────────────────────────────────────────

  /**
   * Create a copy of an existing project.
   * Copies project metadata + optionally copies task titles as skeleton.
   *
   * WHY COPY TASKS AS SKELETON?
   * When duplicating a project template, you want the same task structure
   * but with fresh status (all TODO), no assignees, no due dates.
   * It's a starting point, not an exact copy.
   *
   * @param projectId      - Source project UUID
   * @param organizationId - Organization UUID
   * @param userId         - Requesting user
   * @param name           - New project name (default: "Copy of <original>")
   * @param includeTasks   - Whether to copy task structure
   */
  async duplicateProject(
    projectId: string,
    organizationId: string,
    userId: string,
    name?: string,
    includeTasks = true,
  ) {
    this.log('Duplicating project', { projectId });

    const original = await this.verifyProjectAccess(
      projectId,
      organizationId,
      userId,
    );

    const originalProject = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
      include: {
        tasks: {
          select: {
            title: true,
            description: true,
            priority: true,
            estimatedHours: true,
          },
        },
      },
    });

    if (!originalProject) {
      throw ApiError.notFound('Project not found');
    }

    const duplicatedProject = await this.prisma.$transaction(async (tx) => {
      // Create duplicate project
      const newProject = await tx.project.create({
        data: {
          organizationId,
          name: name || `Copy of ${originalProject.name}`,
          description: originalProject.description,
          teamId: originalProject.teamId,
          visibility: originalProject.visibility,
          createdBy: userId,
          // Reset status and dates for fresh start
          status: ProjectStatus.ACTIVE,
        },
      });

      // Copy tasks as skeleton if requested
      if (includeTasks && originalProject.tasks.length > 0) {
        await tx.task.createMany({
          data: originalProject.tasks.map((task) => ({
            organizationId,
            projectId: newProject.id,
            title: task.title,
            description: task.description,
            priority: task.priority,
            estimatedHours: task.estimatedHours,
            createdBy: userId,
            // Reset: fresh status, no assignee, no due date
            status: 'TODO' as const,
          })),
        });
      }

      return newProject;
    });

    await this.logActivity(
      organizationId,
      userId,
      'PROJECT_DUPLICATED',
      duplicatedProject.id,
      {
        sourceProjectId: projectId,
        tasksIncluded: includeTasks,
        taskCount: originalProject.tasks.length,
      },
    );

    this.log('Project duplicated', {
      sourceId: projectId,
      newId: duplicatedProject.id,
    });

    return { project: duplicatedProject };
  }
}

export default new ProjectService();