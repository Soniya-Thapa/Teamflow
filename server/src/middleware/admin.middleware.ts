
// @file admin.middleware.ts
// @description Middleware to protect super admin routes

// This middleware runs AFTER authenticate middleware.
// authenticate → verifies JWT, attaches req.userId
// requireSuperAdmin → verifies user is a super admin

// WHY CHECK IN BOTH MIDDLEWARE AND SERVICE?
// Defense in depth — if middleware is accidentally removed from a route,
// the service still rejects unauthorized requests.
// Never rely on a single layer of security.

// Usage:
//   router.get('/admin/orgs', authenticate, requireSuperAdmin, controller.list)

import { Request, Response, NextFunction } from 'express';
import ApiError from '@/utils/ApiError';
import prisma from '@/config/database';

export const requireSuperAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const user = await prisma.user.findUnique({
      where: {
        id: req.userId
      },
      select: {
        isSuperAdmin: true
      },
    });

    if (!user?.isSuperAdmin) {
      // Return 404 instead of 403 intentionally —
      // we don't want to reveal that an admin panel exists
      // to non-admin users trying to probe the API
      throw ApiError.notFound('Route not found');
    }

    next();
  } catch (error) {
    next(error);
  }
};