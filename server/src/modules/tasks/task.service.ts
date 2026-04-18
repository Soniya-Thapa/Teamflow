/**
 * @file task.service.ts
 * @description Business logic for task management (Days 15 & 16).
 *
 * KEY CONCEPTS:
 * - Tasks always scoped to organizationId (tenant isolation)
 * - Project membership verified before task operations
 * - Private project access enforced (ProjectMember check)
 * - Assignees must be active org members
 * - Subtasks use parentTaskId self-reference on Task model
 * - TaskWatcher model tracks notification subscribers (schema addition needed)
 * - Bulk operations capped at 100 items; run in a single $transaction
 * - Overdue query: dueDate < now AND status != DONE
 * - Full-text search via contains (upgrade to pg full-text if needed)
 * - Activity logged for every mutation
 * - Onboarding step 4 set on first task creation in the org
 */

import { TaskStatus, TaskPriority, Prisma } from '@prisma/client';
import { BaseService } from '@/common/BaseService';
import ApiError from '@/utils/ApiError';
import notificationService from '@/modules/notifications/notification.service';
import { NotificationType } from '@prisma/client';
import { emitToOrg } from '@/config/socket';

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────

interface CreateTaskDto {
  projectId: string;
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignedTo?: string | null;
  dueDate?: string | null;
  estimatedHours?: number | null;
  parentTaskId?: string | null;
}

interface UpdateTaskDto {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignedTo?: string | null;
  dueDate?: string | null;
  estimatedHours?: number | null;
  actualHours?: number | null;
  parentTaskId?: string | null;
}

interface ListTasksFilters {
  page?: number;
  limit?: number;
  projectId?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignedTo?: string;
  createdBy?: string;
  dueBefore?: string;
  dueAfter?: string;
  isOverdue?: boolean;
  search?: string;
  parentTaskId?: string | null;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ─────────────────────────────────────────
// TASK SELECT (reusable shape)
// ─────────────────────────────────────────

const TASK_SELECT = {
  id: true,
  organizationId: true,
  projectId: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  assignedTo: true,
  dueDate: true,
  estimatedHours: true,
  actualHours: true,
  createdBy: true,
  parentTaskId: true,
  createdAt: true,
  updatedAt: true,
  assignee: {
    select: { id: true, firstName: true, lastName: true, avatar: true, email: true },
  },
  creator: {
    select: { id: true, firstName: true, lastName: true, avatar: true },
  },
  project: {
    select: { id: true, name: true, visibility: true },
  },
  _count: {
    select: { comments: true, attachments: true, subtasks: true },
  },
} as const;

// ─────────────────────────────────────────
// SERVICE CLASS
// ─────────────────────────────────────────

class TaskService extends BaseService {
  // ─────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────

  /**
   * @private
   * Verify a project exists in the org and the user can access it.
   * Private projects require ProjectMember record or OWNER/ADMIN role.
   */
  private async verifyProjectAccess(
    userId: string,
    organizationId: string,
    projectId: string,
    memberRole: string,
  ) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId, archivedAt: null },
      select: { id: true, visibility: true, status: true },
    });

    if (!project) {
      throw ApiError.notFound('Project not found');
    }

    if (project.status === 'ARCHIVED') {
      throw ApiError.badRequest('Cannot create tasks in an archived project');
    }

    if (project.visibility === 'PRIVATE' && !['OWNER', 'ADMIN'].includes(memberRole)) {
      const isMember = await this.prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId } },
      });
      if (!isMember) {
        throw ApiError.forbidden('You do not have access to this private project');
      }
    }

    return project;
  }

  /**
   * @private
   * Verify a task exists and belongs to the org. Returns the task.
   */
  private async verifyTaskExists(organizationId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, organizationId },
      select: {
        id: true,
        organizationId: true,
        projectId: true,
        createdBy: true,
        assignedTo: true,
        status: true,
        parentTaskId: true,
        project: { select: { visibility: true } },
      },
    });

    if (!task) {
      throw ApiError.notFound('Task not found');
    }

    return task;
  }

  /**
   * @private
   * Verify the assignee is an active member of the organization.
   */
  private async verifyAssignee(organizationId: string, assignedTo: string) {
    const member = await this.prisma.organizationMember.findFirst({
      where: { organizationId, userId: assignedTo, status: 'ACTIVE' },
    });
    if (!member) {
      throw ApiError.badRequest('Assignee is not an active member of this organization');
    }
  }

  /**
   * @private
   * Bump onboarding to step 4 if this is the org's first task.
   */
  private async maybeAdvanceOnboarding(organizationId: string) {
    const taskCount = await this.prisma.task.count({ where: { organizationId } });
    if (taskCount === 1) {
      await this.prisma.organizationSettings.updateMany({
        where: { organizationId, onboardingStep: { lt: 4 } },
        data: { onboardingStep: 4 },
      });
    }
  }

  /**
   * @private
   * Build the `where` clause for task list queries.
   */
  private buildTaskWhere(
    organizationId: string,
    filters: ListTasksFilters,
  ): Prisma.TaskWhereInput {
    const where: Prisma.TaskWhereInput = { organizationId };

    if (filters.projectId) where.projectId = filters.projectId;
    if (filters.status) where.status = filters.status;
    if (filters.priority) where.priority = filters.priority;
    if (filters.assignedTo) where.assignedTo = filters.assignedTo;
    if (filters.createdBy) where.createdBy = filters.createdBy;

    // Subtask filtering: null = root tasks only, a UUID = children of that task
    if (filters.parentTaskId !== undefined) {
      where.parentTaskId = filters.parentTaskId;
    }

    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.dueBefore || filters.dueAfter) {
      where.dueDate = {};
      if (filters.dueBefore) where.dueDate.lte = new Date(filters.dueBefore);
      if (filters.dueAfter) where.dueDate.gte = new Date(filters.dueAfter);
    }

    if (filters.isOverdue) {
      where.dueDate = { lt: new Date() };
      where.status = { not: 'DONE' };
    }

    return where;
  }

  // ─────────────────────────────────────────
  // TASK CRUD
  // ─────────────────────────────────────────

  /**
   * Create a new task in a project.
   * Validates project access, assignee membership, and parent task existence.
   */
  async create(
    userId: string,
    organizationId: string,
    memberRole: string,
    dto: CreateTaskDto,
  ) {
    this.log('Creating task', { userId, organizationId, projectId: dto.projectId });

    await this.verifyProjectAccess(userId, organizationId, dto.projectId, memberRole);

    if (dto.assignedTo) {
      await this.verifyAssignee(organizationId, dto.assignedTo);
    }

    if (dto.parentTaskId) {
      await this.verifyTaskExists(organizationId, dto.parentTaskId);
    }

    const task = await this.prisma.$transaction(async (tx) => {
      const created = await tx.task.create({
        data: {
          organizationId,
          projectId: dto.projectId,
          title: dto.title,
          description: dto.description,
          status: dto.status ?? 'TODO',
          priority: dto.priority ?? 'MEDIUM',
          assignedTo: dto.assignedTo ?? null,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          estimatedHours: dto.estimatedHours ?? null,
          createdBy: userId,
          parentTaskId: dto.parentTaskId ?? null,
        },
        select: TASK_SELECT,
      });

      await tx.activityLog.create({
        data: {
          organizationId,
          userId,
          action: 'TASK_CREATED',
          resourceType: 'TASK',
          resourceId: created.id,
          metadata: {
            title: created.title,
            projectId: created.projectId,
            status: created.status,
            priority: created.priority,
          },
        },
      });

      return created;
    });

    await this.maybeAdvanceOnboarding(organizationId);

    if (dto.assignedTo) {
      await notificationService.createNotification({
        userId: dto.assignedTo,
        organizationId,
        type: NotificationType.TASK_ASSIGNED,
        title: 'Task assigned',
        message: `You have been assigned "${task.title}"`,
        metadata: { taskId: task.id },
      });
    }

    return { task };
  }

  /**
   * Retrieve a single task by ID with full relations.
   */
  async findById(
    userId: string,
    organizationId: string,
    taskId: string,
    memberRole: string,
  ) {
    this.log('Fetching task', { taskId, organizationId });

    const task = await this.prisma.task.findFirst({
      where: { id: taskId, organizationId },
      select: {
        ...TASK_SELECT,
        subtasks: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            assignedTo: true,
            dueDate: true,
            assignee: {
              select: { id: true, firstName: true, lastName: true, avatar: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        watchers: {
          select: {
            user: { select: { id: true, firstName: true, lastName: true, avatar: true } },
          },
        },
      },
    });

    if (!task) throw ApiError.notFound('Task not found');

    if (task.project.visibility === 'PRIVATE' && !['OWNER', 'ADMIN'].includes(memberRole)) {
      const isMember = await this.prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId: task.projectId, userId } },
      });
      if (!isMember) throw ApiError.forbidden('Access denied to this task');
    }

    return { task };
  }

  /**
   * List tasks in an organization with rich filtering and pagination.
   */
  async list(
    userId: string,
    organizationId: string,
    filters: ListTasksFilters,
  ) {
    this.log('Listing tasks', { organizationId, filters });

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const sortBy = filters.sortBy ?? 'createdAt';
    const sortOrder = filters.sortOrder ?? 'desc';

    const where = this.buildTaskWhere(organizationId, filters);

    const [tasks, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        select: TASK_SELECT,
      }),
      this.prisma.task.count({ where }),
    ]);

    return {
      tasks,
      meta: this.buildPaginationMeta(page, limit, total),
    };
  }

  /**
   * Update a task's fields. Validates assignee and parent if provided.
   */
  async update(
    userId: string,
    organizationId: string,
    taskId: string,
    dto: UpdateTaskDto,
    memberRole: string,
  ) {
    this.log('Updating task', { userId, organizationId, taskId });

    const task = await this.verifyTaskExists(organizationId, taskId);
    const oldAssignee = task.assignedTo;
    const isCreator = task.createdBy === userId;
    const isAdmin = ['OWNER', 'ADMIN'].includes(memberRole);

    // Check if user is an assignee via TaskAssignee table
    const isAssignee = await this.prisma.taskAssignee.findFirst({
      where: { taskId, userId },
    });

    // ─────────────────────────────────────────
    // STATUS-ONLY UPDATE
    // Assignees, watchers, creator, OWNER/ADMIN can update status
    // ─────────────────────────────────────────
    const isStatusOnlyUpdate =
      Object.keys(dto).length === 1 && dto.status !== undefined;

    if (isStatusOnlyUpdate) {
      // Check watcher if not creator/assignee/admin
      if (!isCreator && !isAssignee && !isAdmin) {
        const isWatcher = await this.prisma.taskWatcher.findUnique({
          where: { taskId_userId: { taskId, userId } },
        });

        if (!isWatcher) {
          throw ApiError.forbidden(
            'Only task assignees, creator, watchers, or admins can update task status',
          );
        }
      }
    } else {
      // ─────────────────────────────────────────
      // FULL UPDATE (title, description, priority etc.)
      // Only creator, current assignee, or OWNER/ADMIN
      // Random members CANNOT edit task details
      // ─────────────────────────────────────────
      if (!isCreator && !isAssignee && !isAdmin) {
        throw ApiError.forbidden(
          'Only the task creator, an assignee, or an org admin can edit task details',
        );
      }
    }

    if (dto.assignedTo) {
      await this.verifyAssignee(organizationId, dto.assignedTo);
    }

    if (dto.parentTaskId) {
      if (dto.parentTaskId === taskId) {
        throw ApiError.badRequest('A task cannot be its own parent');
      }
      await this.verifyTaskExists(organizationId, dto.parentTaskId);
    }

    const updatedTask = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.task.update({
        where: { id: taskId },
        data: {
          ...dto,
          dueDate:
            dto.dueDate !== undefined
              ? dto.dueDate ? new Date(dto.dueDate) : null
              : undefined,
        },
        select: TASK_SELECT,
      });

      await tx.activityLog.create({
        data: {
          organizationId,
          userId,
          action: 'TASK_UPDATED',
          resourceType: 'TASK',
          resourceId: taskId,
          metadata: {
            changes: Object.keys(dto),
            title: updated.title,
          },
        },
      });

      return updated;
    });

    // ─────────────────────────────────────────
    // REAL-TIME SOCKET EMIT (REQUIRED)
    // ─────────────────────────────────────────

    if (dto.status && dto.status !== task.status) {
      try {
        emitToOrg(organizationId, 'task:status:changed', {
          taskId,
          status: updatedTask.status,
          updatedBy: userId,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        // silently ignore socket errors
      }
    }

    if (dto.assignedTo && dto.assignedTo !== oldAssignee) {
      await notificationService.createNotification({
        userId: dto.assignedTo,
        organizationId,
        type: NotificationType.TASK_ASSIGNED,
        title: 'Task assigned',
        message: `You have been assigned "${updatedTask.title}"`,
        metadata: { taskId },
      });
    }

    return { task: updatedTask };
  }

  /**
   * Hard-delete a task and cascade all children (DB cascade handles it).
   * Cascade = automatically apply the same action to related records
   * So when you delete a parent task:
All its subtasks (children)
AND their subtasks
👉 are also automatically deleted
   */
  async delete(userId: string, organizationId: string, taskId: string) {
    this.log('Deleting task', { userId, organizationId, taskId });

    const task = await this.verifyTaskExists(organizationId, taskId);

    await this.prisma.$transaction(async (tx) => {
      await tx.task.delete({ where: { id: taskId } });

      await tx.activityLog.create({
        data: {
          organizationId,
          userId,
          action: 'TASK_DELETED',
          resourceType: 'TASK',
          resourceId: taskId,
          metadata: { projectId: task.projectId },
        },
      });
    });

    return { message: 'Task deleted successfully' };
  }

  // ─────────────────────────────────────────
  // TASK ASSIGNMENT MANAGEMENT
  // ─────────────────────────────────────────

  /**
   * Assign a user to a task.
   *
   * TWO SCENARIOS:
   *
   * Scenario 1 — REPLACE (isPrimary: true, replacePrevious: true):
   *   Soniya was assigned → reassigned to Ram ONLY
   *   → Soniya removed from task completely
   *   → Ram added as primary assignee
   *   → Soniya removed from watchers (discarded)
   *
   * Scenario 2 — ADD (isPrimary: false, replacePrevious: false):
   *   Soniya was assigned → Ram added for urgency
   *   → Soniya stays on task
   *   → Ram added as additional assignee
   *   → Both can update status
   *
   * @param replacePrevious - true = Scenario 1, false = Scenario 2
   */
  async assignTask(
    userId: string,
    organizationId: string,
    taskId: string,
    targetUserId: string,
    isPrimary: boolean = true,
    replacePrevious: boolean = true,
  ) {
    this.log('Assigning task', { taskId, targetUserId, isPrimary, replacePrevious });

    const task = await this.verifyTaskExists(organizationId, taskId);
    await this.verifyAssignee(organizationId, targetUserId);

    await this.prisma.$transaction(async (tx) => {

      if (replacePrevious) {
        // ─────────────────────────────────────
        // SCENARIO 1: Replace previous assignees
        // Remove ALL existing assignees first
        // ─────────────────────────────────────

        // Get existing assignees before removing them
        const existingAssignees = await tx.taskAssignee.findMany({
          where: { taskId },
          select: { userId: true },
        });

        // Remove all existing task assignments
        await tx.taskAssignee.deleteMany({
          where: { taskId },
        });

        // Remove all previous assignees from watchers (they are discarded)
        for (const assignee of existingAssignees) {
          await tx.taskWatcher.deleteMany({
            where: { taskId, userId: assignee.userId },
          });
        }

        // Update assignedTo field (quick reference for primary)
        await tx.task.update({
          where: { id: taskId },
          data: { assignedTo: targetUserId },
        });

      } else {
        // ─────────────────────────────────────
        // SCENARIO 2: Add alongside existing
        // Keep existing assignees, just add new one
        // ─────────────────────────────────────

        // If this is marked as new primary, demote existing primary
        if (isPrimary) {
          await tx.taskAssignee.updateMany({
            where: { taskId, isPrimary: true },
            data: { isPrimary: false },
          });

          // Update quick reference field
          await tx.task.update({
            where: { id: taskId },
            data: { assignedTo: targetUserId },
          });
        }
      }

      // Add new assignee
      await tx.taskAssignee.upsert({
        where: {
          taskId_userId: { taskId, userId: targetUserId },
        },
        update: { isPrimary },
        create: {
          taskId,
          userId: targetUserId,
          isPrimary,
          assignedBy: userId,
        },
      });

      // Auto-add new assignee as watcher
      await tx.taskWatcher.upsert({
        where: {
          taskId_userId: { taskId, userId: targetUserId },
        },
        update: {},
        create: { taskId, userId: targetUserId },
      });

      // Log activity
      await tx.activityLog.create({
        data: {
          organizationId,
          userId,
          action: replacePrevious ? 'TASK_REASSIGNED' : 'TASK_ASSIGNEE_ADDED',
          resourceType: 'TASK',
          resourceId: taskId,
          metadata: {
            assignedTo: targetUserId,
            isPrimary,
            replacePrevious,
          },
        },
      });
    });

    await notificationService.createNotification({
      userId: targetUserId,
      organizationId,
      type: NotificationType.TASK_ASSIGNED,
      title: 'New task assigned to you',
      message: `You have been assigned a new task`,
      metadata: { taskId },
    });

    return { message: 'Task assigned successfully' };
  }

  /**
   * Remove a specific assignee from a task.
   * Used when someone is explicitly removed (not just replaced).
   */
  async removeAssignee(
    userId: string,
    organizationId: string,
    taskId: string,
    targetUserId: string,
  ) {
    this.log('Removing assignee', { taskId, targetUserId });

    await this.verifyTaskExists(organizationId, taskId);

    const assignee = await this.prisma.taskAssignee.findUnique({
      where: {
        taskId_userId: { taskId, userId: targetUserId },
      },
    });

    if (!assignee) {
      throw ApiError.notFound('This user is not assigned to this task');
    }

    await this.prisma.$transaction(async (tx) => {
      // Remove assignment
      await tx.taskAssignee.delete({
        where: { taskId_userId: { taskId, userId: targetUserId } },
      });

      // Remove from watchers (they are discarded)
      await tx.taskWatcher.deleteMany({
        where: { taskId, userId: targetUserId },
      });

      // If removed person was primary, clear assignedTo field
      if (assignee.isPrimary) {
        // Find next assignee to promote as primary
        const nextAssignee = await tx.taskAssignee.findFirst({
          where: { taskId },
          orderBy: { createdAt: 'asc' },
        });

        await tx.task.update({
          where: { id: taskId },
          data: {
            assignedTo: nextAssignee?.userId ?? null,
          },
        });

        if (nextAssignee) {
          await tx.taskAssignee.update({
            where: { id: nextAssignee.id },
            data: { isPrimary: true },
          });
        }
      }

      await tx.activityLog.create({
        data: {
          organizationId,
          userId,
          action: 'TASK_ASSIGNEE_REMOVED',
          resourceType: 'TASK',
          resourceId: taskId,
          metadata: { removedUserId: targetUserId },
        },
      });
    });

    return { message: 'Assignee removed successfully' };
  }

  /**
   * List all assignees for a task.
   */
  async listAssignees(organizationId: string, taskId: string) {
    await this.verifyTaskExists(organizationId, taskId);

    const assignees = await this.prisma.taskAssignee.findMany({
      where: { taskId },
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
        { isPrimary: 'desc' }, // Primary assignee first
        { createdAt: 'asc' },
      ],
    });

    return {
      assignees: assignees.map(a => ({
        ...a.user,
        isPrimary: a.isPrimary,
        assignedAt: a.createdAt,
      })),
    };
  }

  // ─────────────────────────────────────────
  // BULK OPERATIONS
  // ─────────────────────────────────────────

  /**
   * Bulk-update status for up to 100 tasks. All tasks must belong to the org.
   * Bulk = doing something on multiple items at once
   */
  async bulkUpdateStatus(
    userId: string,
    organizationId: string,
    taskIds: string[],
    status: TaskStatus,
  ) {
    this.log('Bulk updating task status', { userId, organizationId, count: taskIds.length });

    const existingCount = await this.prisma.task.count({
      where: { id: { in: taskIds }, organizationId },
    });

    if (existingCount !== taskIds.length) {
      throw ApiError.badRequest('One or more tasks not found in this organization');
    }

    // transaction: “Either ALL operations succeed OR NONE happen”
    await this.prisma.$transaction(async (tx) => {
      await tx.task.updateMany({
        where: { id: { in: taskIds }, organizationId },
        data: { status },
      });

      await tx.activityLog.create({
        data: {
          organizationId,
          userId,
          action: 'TASKS_BULK_STATUS_UPDATED',
          resourceType: 'TASK',
          resourceId: organizationId,
          metadata: { taskIds, status, count: taskIds.length },
        },
      });
    });

    return { updated: taskIds.length, status };
  }

  /**
   * Bulk-assign (or unassign) up to 100 tasks.
   */
  async bulkAssign(
    userId: string,
    organizationId: string,
    taskIds: string[],
    assignedTo: string | null,
  ) {
    this.log('Bulk assigning tasks', { userId, organizationId, count: taskIds.length });

    if (assignedTo) {
      await this.verifyAssignee(organizationId, assignedTo);
    }

    const existingCount = await this.prisma.task.count({
      where: { id: { in: taskIds }, organizationId },
    });

    if (existingCount !== taskIds.length) {
      throw ApiError.badRequest('One or more tasks not found in this organization');
    }

    // await this.prisma.$transaction(async (tx) => {
    //   await tx.task.updateMany({
    //     where: { id: { in: taskIds }, organizationId },
    //     data: { assignedTo },
    //   });

    //   await tx.activityLog.create({
    //     data: {
    //       organizationId,
    //       userId,
    //       action: 'TASKS_BULK_ASSIGNED',
    //       resourceType: 'TASK',
    //       resourceId: organizationId,
    //       metadata: { taskIds, assignedTo, count: taskIds.length },
    //     },
    //   });
    // });

    await this.prisma.$transaction(async (tx) => {
      for (const taskId of taskIds) {

        // Remove all assignees
        await tx.taskAssignee.deleteMany({
          where: { taskId },
        });

        // Add new one
        if (assignedTo) {
          await tx.taskAssignee.create({
            data: {
              taskId,
              userId: assignedTo,
              isPrimary: true,
              assignedBy: userId,
            },
          });

          await tx.task.update({
            where: { id: taskId },
            data: { assignedTo },
          });
        } else {
          // Unassign case
          await tx.task.update({
            where: { id: taskId },
            data: { assignedTo: null },
          });
        }
      }

      await tx.activityLog.create({
        data: {
          organizationId,
          userId,
          action: 'TASKS_BULK_ASSIGNED',
          resourceType: 'TASK',
          resourceId: organizationId,
          metadata: { taskIds, assignedTo },
        },
      });
    });

    return { updated: taskIds.length, assignedTo };
  }

  /**
   * Bulk-delete up to 100 tasks.
   */
  async bulkDelete(
    userId: string,
    organizationId: string,
    taskIds: string[],
  ) {
    this.log('Bulk deleting tasks', { userId, organizationId, count: taskIds.length });

    const existingCount = await this.prisma.task.count({
      where: { id: { in: taskIds }, organizationId },
    });

    if (existingCount !== taskIds.length) {
      throw ApiError.badRequest('One or more tasks not found in this organization');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.task.deleteMany({
        where: { id: { in: taskIds }, organizationId },
      });

      await tx.activityLog.create({
        data: {
          organizationId,
          userId,
          action: 'TASKS_BULK_DELETED',
          resourceType: 'TASK',
          resourceId: organizationId,
          metadata: { taskIds, count: taskIds.length },
        },
      });
    });

    return { deleted: taskIds.length };
  }

  // ─────────────────────────────────────────
  // OVERDUE & ACTIVITY
  // ─────────────────────────────────────────

  /**
   * Return all overdue tasks in an org (dueDate < now, status != DONE).
   * Optionally filter by projectId or assignedTo.
   */
  async getOverdue(
    organizationId: string,
    filters: { projectId?: string; assignedTo?: string; page?: number; limit?: number },
  ) {
    this.log('Fetching overdue tasks', { organizationId });

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.TaskWhereInput = {
      organizationId,
      dueDate: { lt: new Date() },
      status: { not: 'DONE' },
    };

    if (filters.projectId) where.projectId = filters.projectId;
    if (filters.assignedTo) where.assignedTo = filters.assignedTo;

    const [tasks, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dueDate: 'asc' },
        select: TASK_SELECT,
      }),
      this.prisma.task.count({ where }),
    ]);

    return { tasks, meta: this.buildPaginationMeta(page, limit, total) };
  }

  /**
   * Retrieve activity log entries for a specific task.
   */
  async getActivity(
    organizationId: string,
    taskId: string,
    pagination: { page?: number; limit?: number },
  ) {
    this.log('Fetching task activity', { organizationId, taskId });

    await this.verifyTaskExists(organizationId, taskId);

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const skip = (page - 1) * limit;

    const [activities, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        where: { organizationId, resourceType: 'TASK', resourceId: taskId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          action: true,
          resourceType: true,
          resourceId: true,
          metadata: true,
          createdAt: true,
          user: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        },
      }),
      this.prisma.activityLog.count({
        where: { organizationId, resourceType: 'TASK', resourceId: taskId },
      }),
    ]);

    return { activities, meta: this.buildPaginationMeta(page, limit, total) };
  }

  // ─────────────────────────────────────────
  // WATCHERS
  // ─────────────────────────────────────────

  /**
   * Add a watcher to a task. Watchers receive notifications on task changes.
   * NOTE: Requires TaskWatcher model (see schema migration note below).
   * A watcher is a user who:

👀 follows a task
gets updates/notifications
BUT is not necessarily assigned to the task
   */
  async addWatcher(
    userId: string,
    organizationId: string,
    taskId: string,
    watcherUserId: string,
  ) {
    this.log('Adding task watcher', { userId, organizationId, taskId, watcherUserId });

    await this.verifyTaskExists(organizationId, taskId);
    await this.verifyAssignee(organizationId, watcherUserId); // must be org member

    const existing = await this.prisma.taskWatcher.findUnique({
      where: { taskId_userId: { taskId, userId: watcherUserId } },
    });

    if (existing) throw ApiError.conflict('User is already watching this task');

    await this.prisma.taskWatcher.create({
      data: { taskId, userId: watcherUserId },
    });

    return { message: 'Watcher added successfully' };
  }

  /**
   * Remove a watcher from a task.
   */
  async removeWatcher(
    userId: string,
    organizationId: string,
    taskId: string,
    watcherUserId: string,
  ) {
    this.log('Removing task watcher', { userId, organizationId, taskId, watcherUserId });

    await this.verifyTaskExists(organizationId, taskId);

    const existing = await this.prisma.taskWatcher.findUnique({
      where: { taskId_userId: { taskId, userId: watcherUserId } },
    });

    if (!existing) throw ApiError.notFound('Watcher not found');

    await this.prisma.taskWatcher.delete({
      where: { taskId_userId: { taskId, userId: watcherUserId } },
    });

    return { message: 'Watcher removed successfully' };
  }

  /**
   * List all watchers for a task.
   */
  async listWatchers(organizationId: string, taskId: string) {
    await this.verifyTaskExists(organizationId, taskId);

    const watchers = await this.prisma.taskWatcher.findMany({
      where: { taskId },
      select: {
        user: { select: { id: true, firstName: true, lastName: true, avatar: true, email: true } },
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return { watchers: watchers.map((w) => ({ ...w.user, watchingSince: w.createdAt })) };
  }

  // ─────────────────────────────────────────
  // COMMENTS
  // ─────────────────────────────────────────

  /**
   * Create a comment on a task.
   */
  async createComment(
    userId: string,
    organizationId: string,
    taskId: string,
    content: string,
  ) {
    this.log('Creating comment', { userId, organizationId, taskId });

    await this.verifyTaskExists(organizationId, taskId);

    const comment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.comment.create({
        data: { taskId, userId, content },
        select: {
          id: true,
          content: true,
          taskId: true,
          createdAt: true,
          updatedAt: true,
          user: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        },
      });

      await tx.activityLog.create({
        data: {
          organizationId,
          userId,
          action: 'COMMENT_CREATED',
          resourceType: 'TASK',
          resourceId: taskId,
          metadata: { commentId: created.id },
        },
      });

      return created;
    });

    const taskData = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { assignedTo: true },
    });

    if (taskData?.assignedTo) {
      await notificationService.createNotification({
        userId: taskData.assignedTo,
        organizationId,
        type: NotificationType.COMMENT_ADDED,
        title: 'New comment on task',
        message: `Someone commented on your task`,
        metadata: { taskId },
      });
    }

    return { comment };
  }

  /**
   * List paginated comments for a task.
   */
  async listComments(
    organizationId: string,
    taskId: string,
    pagination: { page?: number; limit?: number },
  ) {
    this.log('Listing comments', { organizationId, taskId });

    await this.verifyTaskExists(organizationId, taskId);

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const skip = (page - 1) * limit;

    const [comments, total] = await Promise.all([
      this.prisma.comment.findMany({
        where: { taskId },
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          content: true,
          taskId: true,
          createdAt: true,
          updatedAt: true,
          user: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        },
      }),
      this.prisma.comment.count({ where: { taskId } }),
    ]);

    return { comments, meta: this.buildPaginationMeta(page, limit, total) };
  }

  /**
   * Update a comment's content. User must own the comment (enforced by middleware).
   */
  async updateComment(
    userId: string,
    organizationId: string,
    commentId: string,
    content: string,
  ) {
    this.log('Updating comment', { userId, commentId });

    const comment = await this.prisma.comment.update({
      where: { id: commentId },
      data: { content },
      select: {
        id: true,
        content: true,
        taskId: true,
        createdAt: true,
        updatedAt: true,
        user: { select: { id: true, firstName: true, lastName: true, avatar: true } },
      },
    });

    await this.prisma.activityLog.create({
      data: {
        organizationId,
        userId,
        action: 'COMMENT_UPDATED',
        resourceType: 'TASK',
        resourceId: comment.taskId,
        metadata: { commentId },
      },
    });

    return { comment };
  }

  /**
   * Delete a comment. User must own the comment (enforced by middleware).
   */
  async deleteComment(
    userId: string,
    organizationId: string,
    commentId: string,
  ) {
    this.log('Deleting comment', { userId, commentId });

    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: { taskId: true },
    });

    if (!comment) throw ApiError.notFound('Comment not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.comment.delete({ where: { id: commentId } });

      await tx.activityLog.create({
        data: {
          organizationId,
          userId,
          action: 'COMMENT_DELETED',
          resourceType: 'TASK',
          resourceId: comment.taskId,
          metadata: { commentId },
        },
      });
    });

    return { message: 'Comment deleted successfully' };
  }

  // ─────────────────────────────────────────
  // SUBTASKS
  // ─────────────────────────────────────────

  /**
   * Create a subtask under a parent task.
   * Subtasks share the same project as the parent.
   */
  async createSubtask(
    userId: string,
    organizationId: string,
    memberRole: string,
    parentTaskId: string,
    dto: Omit<CreateTaskDto, 'projectId' | 'parentTaskId'>,
  ) {
    this.log('Creating subtask', { userId, organizationId, parentTaskId });

    const parent = await this.verifyTaskExists(organizationId, parentTaskId);

    // Subtasks cannot have their own subtasks (only 1 level deep)
    if (parent.parentTaskId !== null) {
      throw ApiError.badRequest('Subtasks cannot have their own subtasks');
    }

    return this.create(userId, organizationId, memberRole, {
      ...dto,
      projectId: parent.projectId,
      parentTaskId,
    });
  }

  /**
   * List all subtasks for a parent task.
   */
  async listSubtasks(organizationId: string, parentTaskId: string) {
    await this.verifyTaskExists(organizationId, parentTaskId);

    const subtasks = await this.prisma.task.findMany({
      where: { organizationId, parentTaskId },
      orderBy: { createdAt: 'asc' },
      select: TASK_SELECT,
    });

    return { subtasks };
  }
}

export default new TaskService();