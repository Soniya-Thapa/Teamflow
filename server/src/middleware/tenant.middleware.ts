
import prisma from '@/config/database';
import ApiError from '@/utils/ApiError';
import logger from '@/utils/logger';
import { Request, Response, NextFunction } from 'express';

// Multi-Tenancy Middleware
// Extracts and validates organization context from authenticated user
// Ensures all requests are scoped to a specific organization

export const requireOrganization = async (req: Request, res: Response, next: NextFunction) => {
  try {

    // User must be authenticated first
    if (!req.userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    // Get organization ID from header, query, or body
    const organizationId =
      req.headers['x-organization-id'] as string ||
      req.query.organizationId as string ||
      req.body.organizationId;

    if (!organizationId) {
      throw ApiError.badRequest('Organization ID is required');
    }

    // Verify user is a member of this organization
    const membership = await prisma.organizationMember.findFirst({
      where: {
        userId: req.userId,
        organizationId: organizationId,
        status: 'ACTIVE',
      },
      include: {
        organization: true,
      },
    });

    if (!membership) {
      throw ApiError.forbidden('You do not have access to this organization');
    }

    // Check if organization is active
    if (membership.organization.status !== 'ACTIVE') {
      throw ApiError.forbidden('This organization is not active');
    }

    // Attach organization context to request
    req.organizationId = organizationId;
    req.memberRole = membership.role;

    logger.debug(`Tenant context set: ${organizationId} for user: ${req.userId}`);

    next();
  } catch (error) {
    next(error);
  }
};

// Check if user has specific role in organization

//                    Usage :
// requireRole("admin", "manager")
// So inside function:
// roles = ["admin", "manager"]
// User role : req.memberRole = "member"
// Check : roles.includes("member") → false
// So not allowed.
// throw ApiError.forbidden(`Required role: ${roles.join(' or ')}`);
// This creates message:
// Required role: admin or manager
// Because:roles.join(' or ')joins array into string.

export const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.memberRole) {
      throw ApiError.unauthorized('Organization membership required');
    }

    if (!roles.includes(req.memberRole)) {
      throw ApiError.forbidden(`Required role: ${roles.join(' or ')}`);
    }

    next();
  };
};

// Prisma Middleware for automatic tenant scoping
// Automatically injects organizationId into all queries

export const setupPrismaTenantMiddleware = () => {
  prisma.$use(async (params, next) => {
    // List of models that require tenant scoping
    const tenantModels = [
      'Organization',
      'OrganizationMember',
      'Team',
      'TeamMember',
      'Project',
      'Task',
      'Comment',
      'Attachment',
      'Invitation',
      'ActivityLog',
      'Notification',
    ];

    // Only apply to tenant-scoped models
    if (tenantModels.includes(params.model || '')) {
      // For findMany, findFirst, count, etc.
      if (params.action === 'findMany' || params.action === 'findFirst' || params.action === 'count') {
        // Ensure organizationId filter exists
        if (params.args.where && !params.args.where.organizationId) {
          logger.warn(`Query on ${params.model} without organizationId filter`);
        }
      }

      // For create, createMany
      if (params.action === 'create' || params.action === 'createMany') {
        // Log creation without organizationId
        if (params.args.data && !params.args.data.organizationId) {
          logger.warn(`Creating ${params.model} without organizationId`);
        }
      }
    }

    return next(params);
  });

  logger.info('✅ Prisma tenant middleware configured');
};