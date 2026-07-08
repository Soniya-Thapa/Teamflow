/**
 * @file quota.middleware.ts
 * @description Enforces plan-based usage limits before create operations.
 *
 * HOW QUOTA WORKS:
 * Every org has maxUsers, maxProjects, maxStorage on the Organization model.
 * The OrganizationUsage model tracks current usage (updated on each action).
 *
 * TWO THRESHOLDS:
 *   80% → WARNING: quota is reached in response metadata
 *   100% → HARD BLOCK: 403 error with upgrade message
 *
 * USAGE:
 *   router.post('/members', checkQuota('users'), memberController.create)
 *   router.post('/projects', checkQuota('projects'), projectController.create)
 *   router.post('/tasks/:id/attachments', checkQuota('storage'), upload)
 *
 * HOW USAGE IS UPDATED:
 * After successful creates/deletes, call updateUsage() from services.
 * This keeps the usage table accurate.
 */

import { Request, Response, NextFunction } from 'express';
import prisma from '@/config/database';
import ApiError from '@/utils/ApiError';

type QuotaResource = 'users' | 'projects' | 'storage';

const PLAN_LIMITS = {
  FREE: {
    users: 5,
    projects: 3,
    storage: 1073741824, // 1GB
  },
  PRO: {
    users: 25,
    projects: 999,
    storage: 10737418240, // 10GB
  },
  ENTERPRISE: {
    users: 9999,
    projects: 9999,
    storage: 107374182400, // 100GB
  },
};

/**
 * Middleware factory — creates a quota check for a specific resource type.
 *
 * @param resource - Which resource to check ('users', 'projects', 'storage')
 * @param fileSizeBytes - Only for 'storage' — size of file being uploaded
 */
export function checkQuota(resource: QuotaResource) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const organizationId = req.organizationId!;

      const [org, usage] = await Promise.all([
        prisma.organization.findUnique({
          where: { id: organizationId },
          select: {
            plan: true,
            maxUsers: true,
            maxProjects: true,
            maxStorage: true,
            status: true,
          },
        }),

        prisma.organizationUsage.findUnique({
          where: { organizationId },
          select: {
            currentUsers: true,
            currentProjects: true,
            currentStorage: true,
          },
        }),
      ]);

      if (!org) {
        throw ApiError.notFound('Organization not found');
      }

      if (org.status === 'SUSPENDED') {
        throw ApiError.forbidden(
          'This organization is suspended. Contact support.',
        );
      }

      if (!usage) return next(); // First resource — no usage yet

      // ─────────────────────────────────────────
      // CHECK SPECIFIC RESOURCE
      // ─────────────────────────────────────────

      let current: number;
      let max: number;
      let resourceLabel: string;

      if (resource === 'users') {
        current = usage.currentUsers;
        max = org.maxUsers;
        resourceLabel = 'team members';
      } else if (resource === 'projects') {
        current = usage.currentProjects;
        max = org.maxProjects;
        resourceLabel = 'projects';
      } else {
        // Storage — file size comes from multer (req.file)
        const fileSize = req.file?.size || 0;
        current = Number(usage.currentStorage) + fileSize;
        max = Number(org.maxStorage);
        resourceLabel = 'storage';
      }

      const usagePct = max > 0 ? (current / max) * 100 : 0;

      // ── HARD LIMIT: BLOCK AT 100% ─────────

      if (current >= max) {
        const planNames: Record<string, string> = {
          FREE: 'PRO ($12/mo)',
          PRO: 'ENTERPRISE ($49/mo)',
          ENTERPRISE: 'ENTERPRISE',
        };

        return res.status(403).json({
          success: false,
          message: `You have reached your ${resourceLabel} limit (${max}).`,
          code: 'QUOTA_EXCEEDED',
          data: {
            resource,
            current,
            max,
            plan: org.plan,
            upgradeMessage: `Upgrade to ${planNames[org.plan] || 'a higher plan'} to add more ${resourceLabel}.`,
          },
        });
      }

      // ── SOFT LIMIT: WARNING AT 80% ────────

      if (usagePct >= 80) {
        // Attach warning to request — services can include it in response
        (req as any).quotaWarning = {
          resource,
          message: `You are at ${Math.round(usagePct)}% of your ${resourceLabel} limit.`,
          current,
          max,
          upgradeMessage: 'Consider upgrading your plan.',
        };
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

// ─────────────────────────────────────────
// USAGE UPDATE HELPERS
// Call these from services after create/delete
// ─────────────────────────────────────────

/**
 * Increment usage count after a successful create.
 * Call this from member.service, project.service, etc.
 */
export async function incrementUsage(
  organizationId: string,
  resource: QuotaResource,
  amount = 1,
) {
  const field =
    resource === 'users'
      ? 'currentUsers'
      : resource === 'projects'
        ? 'currentProjects'
        : 'currentStorage';

  await prisma.organizationUsage.upsert({
    where: { organizationId },
    update: { [field]: { increment: amount } },
    create: {
      organizationId,
      [field]: amount,
    },
  });
}

/**
 * Decrement usage count after a successful delete.
 */
export async function decrementUsage(
  organizationId: string,
  resource: QuotaResource,
  amount = 1,
) {
  const field =
    resource === 'users'
      ? 'currentUsers'
      : resource === 'projects'
        ? 'currentProjects'
        : 'currentStorage';

  await prisma.organizationUsage.update({
    where: { organizationId },
    data: {
      [field]: { decrement: amount },
    },
  });
}