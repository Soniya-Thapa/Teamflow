/**
 * @file ai-digest.service.ts
 * @description Nightly AI-generated organization digest.
 */

import { BaseService } from '@/common/BaseService';
import { generateWithGemini } from './gemini.client';
import { buildWorkloadMap } from '@/utils/task-priority.algorithm';

interface InactiveProject {
  projectId: string;
  projectName: string;
  daysInactive: number;
}

interface DigestStats {
  overdueCount: number;
  overdueTasks: { title: string; daysOverdue: number }[];
  workload: { userId: string; name: string; activeTaskCount: number }[];
  mostOverloaded: { userId: string; name: string; count: number } | null;
  leastLoaded: { userId: string; name: string; count: number } | null;
  inactiveProjects: InactiveProject[];
  estimatedDelayDays: number;
}

const INACTIVITY_THRESHOLD_DAYS = 5;

class AiDigestService extends BaseService {
  private async gatherStats(organizationId: string): Promise<DigestStats> {
    const now = new Date();

    const activeTasks = await this.prisma.task.findMany({
      where: { organizationId, status: { not: 'DONE' } },
      select: {
        id: true,
        title: true,
        dueDate: true,
        assignedTo: true,
        projectId: true,
        updatedAt: true,
        assignee: { select: { id: true, firstName: true, lastName: true } },
        project: { select: { id: true, name: true } },
      },
    });

    const overdueTasks = activeTasks
      .filter((t) => t.dueDate && t.dueDate < now)
      .map((t) => ({
        title: t.title,
        daysOverdue: Math.round((now.getTime() - t.dueDate!.getTime()) / 86400000),
      }));

    const workloadMap = buildWorkloadMap(
      activeTasks.map((t) => ({
        id: t.id,
        title: t.title,
        priority: 'MEDIUM',
        dueDate: t.dueDate,
        createdAt: t.updatedAt,
        assignedTo: t.assignedTo,
        status: 'IN_PROGRESS',
      })),
    );

    const nameById = new Map(
      activeTasks
        .filter((t) => t.assignee)
        .map((t) => [t.assignee!.id, `${t.assignee!.firstName} ${t.assignee!.lastName}`]),
    );

    const workload = Array.from(workloadMap.entries()).map(([userId, count]) => ({
      userId,
      name: nameById.get(userId) ?? 'Unknown',
      activeTaskCount: count,
    }));

    workload.sort((a, b) => b.activeTaskCount - a.activeTaskCount);

    const mostOverloaded = workload[0]
      ? { userId: workload[0].userId, name: workload[0].name, count: workload[0].activeTaskCount }
      : null;

    const leastLoaded = workload[workload.length - 1]
      ? {
          userId: workload[workload.length - 1].userId,
          name: workload[workload.length - 1].name,
          count: workload[workload.length - 1].activeTaskCount,
        }
      : null;

    const lastActivityByProject = new Map<string, { name: string; lastUpdate: Date }>();
    for (const t of activeTasks) {
      const existing = lastActivityByProject.get(t.projectId);
      if (!existing || t.updatedAt > existing.lastUpdate) {
        lastActivityByProject.set(t.projectId, { name: t.project.name, lastUpdate: t.updatedAt });
      }
    }

    const inactiveProjects: InactiveProject[] = [];
    for (const [projectId, info] of lastActivityByProject.entries()) {
      const daysInactive = Math.round((now.getTime() - info.lastUpdate.getTime()) / 86400000);
      if (daysInactive >= INACTIVITY_THRESHOLD_DAYS) {
        inactiveProjects.push({ projectId, projectName: info.name, daysInactive });
      }
    }

    const estimatedDelayDays =
      overdueTasks.length > 0
        ? Math.round(
            (overdueTasks.reduce((sum, t) => sum + t.daysOverdue, 0) / overdueTasks.length) * 10,
          ) / 10
        : 0;

    return {
      overdueCount: overdueTasks.length,
      overdueTasks: overdueTasks.slice(0, 5),
      workload,
      mostOverloaded,
      leastLoaded,
      inactiveProjects,
      estimatedDelayDays,
    };
  }

  private buildPrompt(orgName: string, stats: DigestStats): string {
    return `You are writing a short, factual weekly status digest for a project manager at "${orgName}".
Use ONLY the data below. Do not invent numbers. Keep it under 120 words, plain text, no markdown headers.
Tone: direct, professional, slightly urgent where warranted.

DATA:
- Overdue tasks: ${stats.overdueCount}
- Most overloaded member: ${stats.mostOverloaded ? `${stats.mostOverloaded.name} (${stats.mostOverloaded.count} active tasks)` : 'none'}
- Least loaded member: ${stats.leastLoaded ? `${stats.leastLoaded.name} (${stats.leastLoaded.count} active tasks)` : 'none'}
- Inactive projects: ${stats.inactiveProjects.map((p) => `${p.projectName} (${p.daysInactive} days no activity)`).join(', ') || 'none'}
- Estimated average delay on overdue work: ${stats.estimatedDelayDays} days

Write the digest now.`;
  }

  private fallbackSummary(stats: DigestStats): string {
    const parts: string[] = [];
    parts.push(`${stats.overdueCount} task${stats.overdueCount !== 1 ? 's are' : ' is'} overdue.`);
    if (stats.mostOverloaded) parts.push(`${stats.mostOverloaded.name} has ${stats.mostOverloaded.count} active tasks.`);
    if (stats.leastLoaded) parts.push(`${stats.leastLoaded.name} has only ${stats.leastLoaded.count}.`);
    stats.inactiveProjects.forEach((p) =>
      parts.push(`${p.projectName} has had no activity for ${p.daysInactive} days.`),
    );
    if (stats.estimatedDelayDays > 0) parts.push(`Estimated delay: ${stats.estimatedDelayDays} days.`);
    return parts.join(' ');
  }

  async generateDigestForOrg(organizationId: string, orgName: string) {
    this.log('Generating AI digest', { organizationId });

    const stats = await this.gatherStats(organizationId);

    if (stats.overdueCount === 0 && stats.inactiveProjects.length === 0) {
      this.log('Nothing notable — skipping digest', { organizationId });
      return null;
    }

    const prompt = this.buildPrompt(orgName, stats);
    const aiSummary = await generateWithGemini(prompt);
    const summaryText = aiSummary ?? this.fallbackSummary(stats);

    const report = await this.prisma.aiDigestReport.create({
      data: {
        organizationId,
        overdueCount: stats.overdueCount,
        mostOverloaded: stats.mostOverloaded?.userId ?? null,
        leastLoaded: stats.leastLoaded?.userId ?? null,
        inactiveProjects: stats.inactiveProjects as any,
        estimatedDelayDays: stats.estimatedDelayDays,
        summaryText,
        rawStats: stats as any,
      },
    });

    this.log('AI digest generated', { organizationId, reportId: report.id, usedAi: !!aiSummary });

    return report;
  }
}

export default new AiDigestService();