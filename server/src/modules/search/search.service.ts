/**
 * @file search.service.ts
 * @description Global full-text search across projects, tasks, members, teams.
 *
 * Uses PostgreSQL ILIKE (case-insensitive contains) for simplicity.
 * For production scale, upgrade to pg_trgm or tsvector full-text search.
 *
 * Results grouped by type with a max of 5 per type.
 */

import { BaseService } from '@/common/BaseService';
import ApiError from '@/utils/ApiError';

class SearchService extends BaseService {
  async globalSearch(
    organizationId: string,
    userId: string,
    query: string,
  ) {
    if (!query || query.trim().length < 2) {
      throw ApiError.badRequest('Search query must be at least 2 characters');
    }

    const q = query.trim();

    const [projects, tasks, members, teams] = await Promise.all([
      // Projects
      this.prisma.project.findMany({
        where: {
          organizationId,
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          name: true,
          description: true,
          status: true,
          visibility: true,
        },
        take: 5,
      }),

      // Tasks
      this.prisma.task.findMany({
        where: {
          organizationId,
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          projectId: true,
          project: { select: { name: true } },
        },
        take: 5,
      }),

      // Members
      this.prisma.organizationMember.findMany({
        where: {
          organizationId,
          status: 'ACTIVE',
          user: {
            OR: [
              { firstName: { contains: q, mode: 'insensitive' } },
              { lastName: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          },
        },
        select: {
          id: true,
          role: true,
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
        take: 5,
      }),

      // Teams
      this.prisma.team.findMany({
        where: {
          organizationId,
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          name: true,
          description: true,
          _count: { select: { members: true } },
        },
        take: 5,
      }),
    ]);

    return {
      results: {
        projects,
        tasks,
        members,
        teams,
      },
      total: projects.length + tasks.length + members.length + teams.length,
      query: q,
    };
  }
}

export default new SearchService();