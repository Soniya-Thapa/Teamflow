
// file permission.middleware.ts
// description RBAC permission checking middleware

// HOW IT WORKS:
// 1. User makes request
// 2. authenticate middleware → attaches req.userId
// 3. requireOrganization middleware → attaches req.organizationId, req.memberRole
// 4. requirePermission middleware → checks if user's role has the required permission

// USAGE:
//   router.post('/projects',
//     authenticate,
//     requireOrganization,
//     requirePermission('project:create'),
//     projectController.create
//   );

// WHY CHECK BY PERMISSION NOT ROLE?
// Checking by role hardcodes business logic into routes:
//   requireRole('OWNER', 'ADMIN', 'MEMBER') → what if GUEST gets this permission later?

// Checking by permission is flexible:
//   requirePermission('project:create') → whoever has this permission can do it
//   → change permissions in DB, no code change needed

import { Request, Response, NextFunction } from 'express';
import ApiError from '@/utils/ApiError';
import prisma from '@/config/database';
import logger from '@/utils/logger';

// ───────────────────────────────────────── PERMISSION CACHE ─────────────────────────────────────────

// Simple in -memory cache for permission lookups.
//   Permissions rarely change — no need to hit DB on every request.

//   Cache key: `${memberId}:${organizationId}`
//   Cache value: Set of permission names the member has

// It’s creating a memory shortcut (cache) so your app doesn’t hit the database again and again.

// This is like a storage box in memory
// Example:
// "user123:org456" → Set { "project:create", "task:read" }
// Meaning:
// “User123 in org456 has these permissions”

const permissionCache = new Map<string, Set<string>>();

// TTL = Time To Live
// This means:
// “Cache is valid for only 5 minutes”
// After that:
// it’s considered old
// system will fetch fresh data from DB

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// This stores:
// "user123:org456" → 1710000000000 (timestamp)
// Meaning:
// “When was this cache created?”

const cacheTimestamps = new Map<string, number>();

// Clear permission cache for a specific member.
// Called when member's role is changed.

// Why clear cache?
// Imagine:
// User was MEMBER → limited permissions
// Now promoted to ADMIN
// But cache still has old data 😬
// So system would think:
// “Still MEMBER”
export const clearPermissionCache = (memberId: string, organizationId: string) => {
  const key = `${memberId}:${organizationId}`;
  permissionCache.delete(key);
  cacheTimestamps.delete(key);
};

// ───────────────────────────────────────── GET USER PERMISSIONS ─────────────────────────────────────────

//   Get all permissions for a member in an organization.
//   Checks cache first, falls back to DB query.

//   Permission sources(in order):
// 1. System role based on MemberRole enum (OWNER, ADMIN, MEMBER, GUEST)
// 2. Custom roles assigned via MemberRoleAssignment
//   All permissions are merged(union of all roles)

// Flow : 
//userId + organizationId
//         ↓
// find member
//         ↓
// check cache
//         ↓
// if not cached → fetch roles
//         ↓
// collect permissions
//         ↓
// store in cache
//         ↓
// return permissions

async function getMemberPermissions(userId: string, organizationId: string): Promise<Set<string>> {
  // Find the member record
  const member = await prisma.organizationMember.findFirst({
    where: {
      userId,
      organizationId,
      status: 'ACTIVE',
    },
  });

  if (!member) {
    return new Set(); //  Return empty permissions
  }

  const cacheKey = `${member.id}:${organizationId}`;

  // Check cache validity ( Get when data was stored )
  const cachedAt = cacheTimestamps.get(cacheKey);
  //  If cache is still fresh (within 5 min)
  if (cachedAt && Date.now() - cachedAt < CACHE_TTL) {
    const cached = permissionCache.get(cacheKey);
    if (cached) {
      return cached; // Return cached permissions
    }
  }

  // Get permissions from system role (based on MemberRole enum such as owner, admin ,member and guest)
  const systemRole = await prisma.role.findFirst({
    where: {
      name: member.role,        // matches 'OWNER', 'ADMIN', etc.
      isSystem: true,
      organizationId: null,     // system roles have no org
    },
    include: {
      rolePermissions: {
        include: {
          permission: true
        },
      },
    },
  });

  // Get permissions from custom role assignments such as project manager, team lead , etc 
  const customRoles = await prisma.memberRoleAssignment.findMany({
    where: {
      memberId: member.id
    },
    include: {
      role: {
        include: {
          rolePermissions: {
            include: {
              permission: true
            },
          },
        },
      },
    },
  });

  // Merge all permissions from all roles
  // Set = no duplicates allowed
  const allPermissions = new Set<string>();

  // This is a UNION of permissions
  // system role permissions
  //         +
  // custom role permissions
  //         =
  // final permissions

  // Add system role permissions
  systemRole?.rolePermissions.forEach(rp => {
    allPermissions.add(rp.permission.name);
  });

  // Add custom role permissions
  customRoles.forEach(assignment => {
    assignment.role.rolePermissions.forEach(rp => {
      allPermissions.add(rp.permission.name);
    });
  });

  // Cache the result
  permissionCache.set(cacheKey, allPermissions);
  cacheTimestamps.set(cacheKey, Date.now());

  return allPermissions;
}

// ───────────────────────────────────────── REQUIRE PERMISSION MIDDLEWARE ─────────────────────────────────────────

//   Middleware factory: checks if user has a specific permission.

//   Must be used AFTER authenticate and requireOrganization.

//   param permission - Permission name e.g. 'project:create'

// example
// router.post('/projects',
//   authenticate,
//   requireOrganization,
//   requirePermission('project:create'),
//   controller.createProject
// );

//flow :
// Request comes
//    ↓
// User identified
//    ↓
// Org identified
//    ↓
// Check permissions
//    ↓
// Allowed or blocked
export const requirePermission = (permission: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.userId || !req.organizationId) {
        throw ApiError.unauthorized(
          'Authentication and organization context required',
        );
      }

      const permissions = await getMemberPermissions(
        req.userId,
        req.organizationId,
      );

      if (!permissions.has(permission)) {
        logger.warn('Permission denied', {
          userId: req.userId,
          organizationId: req.organizationId,
          requiredPermission: permission,
        });

        throw ApiError.forbidden(
          `You do not have permission to perform this action. Required: ${permission}`,
        );
      }

      logger.debug('Permission granted', {
        userId: req.userId,
        permission,
      });

      next();
    } catch (error) {
      next(error);
    }
  };
};

// ───────────────────────────────────────── REQUIRE ANY PERMISSION MIDDLEWARE ─────────────────────────────────────────

//   Middleware factory: checks if user has ANY of the specified permissions.
//   Useful when multiple permissions can grant access to the same action.

//   param permissions - List of permission names(user needs at least one)

// example
// requireAnyPermission('task:update', 'task:manage')

export const requireAnyPermission = (...permissions: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.userId || !req.organizationId) {
        throw ApiError.unauthorized(
          'Authentication and organization context required',
        );
      }

      const userPermissions = await getMemberPermissions(
        req.userId,
        req.organizationId,
      );

      const hasPermission = permissions.some(p => userPermissions.has(p));

      if (!hasPermission) {
        throw ApiError.forbidden(
          `You do not have permission. Required one of: ${permissions.join(', ')}`,
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};