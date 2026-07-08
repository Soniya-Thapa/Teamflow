/**
 * @file health-score.service.ts
 * @description Fetches data from DB and runs the health score algorithm.
 */

import { BaseService } from '@/common/BaseService';
import {
  calculateHealthScore,
  HealthInput,
  HealthScoreResult,
} from './health-score.algorithm';

class HealthScoreService extends BaseService {

  async getOrgHealthScore(organizationId: string): Promise<HealthScoreResult> {
    this.log('Calculating health score', { organizationId });

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Fetch everything needed in parallel — one DB round trip
    const [activeTasks, completedLast7Days, totalTasksEver, totalProjects, members] =
      await Promise.all([
        // Active (non-done) tasks
        this.prisma.task.findMany({
          where: { organizationId, status: { not: 'DONE' } },
          select: {
            id: true,
            assignedTo: true,
            dueDate: true,
            status: true,
            projectId: true,
            updatedAt: true,
          },
        }),

        // Tasks completed in last 7 days
        this.prisma.task.count({
          where: {
            organizationId,
            status: 'DONE',
            updatedAt: { gte: sevenDaysAgo },
          },
        }),

        // All tasks ever created
        this.prisma.task.count({ where: { organizationId } }),

        // Total active projects
        this.prisma.project.count({
          where: { organizationId, status: 'ACTIVE' },
        }),

        // Members for name lookup
        this.prisma.organizationMember.findMany({
          where: { organizationId, status: 'ACTIVE' },
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        }),
      ]);

    // Build name map for display
    const nameMap = new Map<string, string>(
      members.map((m) => [
        m.user.id,
        `${m.user.firstName} ${m.user.lastName}`,
      ]),
    );

    const input: HealthInput = {
      activeTasks,
      completedLast7Days,
      totalTasksEver,
      totalProjects,
    };

    return calculateHealthScore(input, nameMap);
  }
}

export default new HealthScoreService();