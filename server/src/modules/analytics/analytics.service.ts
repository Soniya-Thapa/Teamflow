/**
 * @file analytics.service.ts
 * @description Organization analytics and reporting.
 *
 * ALL QUERIES ARE READ-ONLY — no mutations here.
 * Data is aggregated from Tasks, Projects, Members, ActivityLog.
 *
 * DATE RANGE FILTER:
 * All endpoints accept ?days=7|30|90 query param.
 * Default is 30 days.
 * "Last 30 days" means: from (now - 30 days) to now.
 *
 * PERFORMANCE NOTE:
 * These queries scan many rows. For production scale,
 * add database indexes on (organizationId, createdAt) if not already there.
 * For very large orgs, cache results in Redis with 5-minute TTL.
 */

import { BaseService } from '@/common/BaseService';

class AnalyticsService extends BaseService {

  private getDateFrom(days: number): Date {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date;
  }

  // ─────────────────────────────────────────
  // ORG OVERVIEW
  // Top-level numbers for the dashboard header
  // ─────────────────────────────────────────

  /**
   * Get org-level totals:
   * total tasks, completed, overdue, active projects, total members
   */
  async getOrgOverview(organizationId: string, days: number) {
    const dateFrom = this.getDateFrom(days);

    const [
      totalTasks,
      completedTasks,
      overdueTasks,
      activeProjects,
      totalMembers,
      newTasksThisPeriod,
    ] = await Promise.all([
      // All tasks in org
      this.prisma.task.count({ where: { organizationId } }),

      // Completed tasks
      this.prisma.task.count({
        where: { organizationId, status: 'DONE' },
      }),

      // Overdue = past due date AND not done
      this.prisma.task.count({
        where: {
          organizationId,
          dueDate: { lt: new Date() },
          status: { not: 'DONE' },
        },
      }),

      // Active projects only
      this.prisma.project.count({
        where: { organizationId, status: 'ACTIVE' },
      }),

      // Active org members
      this.prisma.organizationMember.count({
        where: { organizationId, status: 'ACTIVE' },
      }),

      // Tasks created in the selected date range
      this.prisma.task.count({
        where: {
          organizationId,
          createdAt: { gte: dateFrom },
        },
      }),
    ]);

    const completionRate =
      totalTasks > 0
        ? Math.round((completedTasks / totalTasks) * 100)
        : 0;

    return {
      totalTasks,
      completedTasks,
      overdueTasks,
      activeProjects,
      totalMembers,
      newTasksThisPeriod,
      completionRate,
    };
  }

  // ─────────────────────────────────────────
  // TASK STATUS BREAKDOWN
  // Used for the pie/donut chart
  // ─────────────────────────────────────────

  /**
   * Count tasks by status (TODO, IN_PROGRESS, REVIEW, DONE).
   * Optionally scoped to a specific project.
   */
  async getTasksByStatus(organizationId: string, projectId?: string) {
    const where: any = { organizationId };
    if (projectId) where.projectId = projectId;

    const breakdown = await this.prisma.task.groupBy({
      by: ['status'],
      where,
      _count: { status: true },
    });

    // Ensure all statuses are present even if count is 0
    const all = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'];
    const map = Object.fromEntries(
      breakdown.map((b) => [b.status, b._count.status]),
    );

    return {
      breakdown: all.map((status) => ({
        status,
        count: map[status] || 0,
      })),
    };
  }

  // ─────────────────────────────────────────
  // TASK VELOCITY (completion trend)
  // Used for the line chart — tasks completed per day
  // ─────────────────────────────────────────

  /**
   * Count tasks completed per day for the last N days.
   * Returns an array of { date, count } objects for the chart.
   *
   * "Completed" = status changed to DONE.
   * Approximated by checking tasks with status=DONE and updatedAt in range.
   * (A proper implementation would track status change timestamps in ActivityLog)
   */
  async getTaskVelocity(organizationId: string, days: number) {
    const dateFrom = this.getDateFrom(days);

    // Get all DONE tasks updated in the period
    const tasks = await this.prisma.task.findMany({
      where: {
        organizationId,
        status: 'DONE',
        updatedAt: { gte: dateFrom },
      },
      select: { updatedAt: true },
    });

    // Group by date
    const countByDate: Record<string, number> = {};
    tasks.forEach((task) => {
      const date = task.updatedAt.toISOString().split('T')[0];
      countByDate[date] = (countByDate[date] || 0) + 1;
    });

    // Fill in missing days with 0
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      result.push({
        date: dateStr,
        count: countByDate[dateStr] || 0,
      });
    }

    return { velocity: result };
  }

  // ─────────────────────────────────────────
  // MEMBER ACTIVITY
  // Most active members by tasks completed
  // ─────────────────────────────────────────

  /**
   * Rank members by number of tasks they completed in the date range.
   * Used for the member activity table.
   */
  async getMemberActivity(organizationId: string, days: number) {
    const dateFrom = this.getDateFrom(days);

    // Group completed tasks by assignee
    const activity = await this.prisma.task.groupBy({
      by: ['assignedTo'],
      where: {
        organizationId,
        status: 'DONE',
        updatedAt: { gte: dateFrom },
        assignedTo: { not: null },
      },
      _count: { assignedTo: true },
      orderBy: { _count: { assignedTo: 'desc' } },
      take: 10,
    });

    // Enrich with user details
    const userIds = activity
      .map((a) => a.assignedTo)
      .filter(Boolean) as string[];

    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatar: true,
        email: true,
      },
    });

    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

    return {
      activity: activity
        .filter((a) => a.assignedTo && userMap[a.assignedTo])
        .map((a) => ({
          user: userMap[a.assignedTo!],
          tasksCompleted: a._count.assignedTo,
        })),
    };
  }

  // ─────────────────────────────────────────
  // PROJECT PROGRESS
  // Completion % per project
  // ─────────────────────────────────────────

  /**
   * Get completion percentage for each active project.
   * Used for the project progress bars.
   */
  async getProjectProgress(organizationId: string) {
    const projects = await this.prisma.project.findMany({
      where: { organizationId, status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        _count: { select: { tasks: true } },
      },
    });

    const progress = await Promise.all(
      projects.map(async (project) => {
        const doneCount = await this.prisma.task.count({
          where: { projectId: project.id, status: 'DONE' },
        });

        const total = project._count.tasks;
        const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

        return {
          projectId: project.id,
          projectName: project.name,
          total,
          done: doneCount,
          completionPct: pct,
        };
      }),
    );

    return {
      projects: progress.sort((a, b) => b.completionPct - a.completionPct),
    };
  }
}

export default new AnalyticsService();