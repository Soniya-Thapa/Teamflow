
// file : resource.middleware.ts
// description : Resource-based authorization middleware

// WHAT IS RESOURCE-BASED AUTHORIZATION?
// Permission checks answer: "Can this user type do this action?"
// Resource checks answer:   "Can THIS user do this to THIS specific resource?"

// Both checks together = complete authorization:
//   requirePermission('project:update')  → has the right role
//   requireOwnership(...)                → owns this specific project

// OWNERSHIP RULES:
//   Project → creator can always edit, org OWNER/ADMIN can edit any
//   Task    → creator can always edit, assignee can update status
//   Comment → only creator can edit/delete their own comment

// USAGE:
//   router.patch('/projects/:projectId',
//     authenticate,
//     requireOrganization,
//     requirePermission('project:update'),
//     requireProjectAccess('update'),     ← ownership check
//     controller.updateProject
//   );

// Example of why this matters:
// User A → has project:update permission
// User B → has project:update permission

// Project X → belongs to User A

// User B tries to update Project X
// → They have the permission ✅
// → But they don't own the resource ❌
// → Should be blocked
// This is called ownership check or resource-based authorization.

import { Request, Response, NextFunction } from 'express';
import ApiError from '@/utils/ApiError';
import prisma from '@/config/database';

// ───────────────────────────────────────── PROJECT ACCESS ─────────────────────────────────────────

// Checks if user can perform an action on a specific project.

// Access rules:
//   'read'   → any active org member
//   'update' → project creator OR org OWNER/ADMIN
//   'delete' → project creator OR org OWNER/ADMIN

// param action - 'read' | 'update' | 'delete'

export const requireProjectAccess = (action: 'read' | 'update' | 'delete') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { projectId } = req.params;
      const userId = req.userId!;
      const organizationId = req.organizationId!;

      const project = await prisma.project.findFirst({
        where: {
          id: projectId as string,
          organizationId,
        },
      });

      if (!project) {
        throw ApiError.notFound('Project not found');
      }

      // Read access — any active member can read
      if (action === 'read') {
        return next();
      }

      // Write access — creator or OWNER/ADMIN
      const isCreator = project.createdBy === userId;

      if (isCreator) {
        return next();
      }

      // Check if user is OWNER or ADMIN in the org
      const member = await prisma.organizationMember.findFirst({
        where: {
          userId,
          organizationId,
          status: 'ACTIVE',
          role: {
            in: ['OWNER', 'ADMIN']
          },
        },
      });

      if (!member) {
        throw ApiError.forbidden(
          'You do not have permission to perform this action on this project',
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// ───────────────────────────────────────── TASK ACCESS ─────────────────────────────────────────

// Checks if user can perform an action on a specific task.

// Access rules:
//   'read'          → any active org member
//   'update'        → task creator OR assignee OR org OWNER/ADMIN
//   'delete'        → task creator OR org OWNER/ADMIN
//   'update-status' → task creator OR assignee (they work the task)

// param action - 'read' | 'update' | 'delete' | 'update-status'

export const requireTaskAccess = (
  action: 'read' | 'update' | 'delete' | 'update-status',
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const taskId = req.params.taskId as string;
      const userId = req.userId!;
      const organizationId = req.organizationId!;

      const task = await prisma.task.findFirst({
        where: {
          id: taskId as string,
          organizationId,
        },
      });

      if (!task) {
        throw ApiError.notFound('Task not found');
      }

      if (action === 'read') {
        return next();
      }

      //  // Status update — ANY active org member can move a task
      // // (same as Jira — anyone can drag a card on the board)
      // if (action === 'update-status') {
      //   return next();
      // }

      const isCreator = task.createdBy === userId;

      // const isAssignee = task.assignedTo === userId;

      // Check TaskAssignee table — covers both primary and additional assignees
      const isAssignee = await prisma.taskAssignee.findUnique({
        where: { taskId_userId: { taskId, userId } },
      });

      // // Status update — creator or assignee can update
      // if (action === 'update-status') {
      //   if (isCreator || isAssignee) {
      //     return next();
      //   }
      //   throw ApiError.forbidden(
      //     'Only the task creator or assignee can update task status',
      //   );
      // }

      if (action === 'update-status') {
        if (isCreator || isAssignee) return next();

        // Check watcher
        const isWatcher = await prisma.taskWatcher.findUnique({
          where: { taskId_userId: { taskId, userId } },
        });

        if (isWatcher) return next();

        // Check OWNER/ADMIN
        const isAdmin = await prisma.organizationMember.findFirst({
          where: {
            userId,
            organizationId,
            status: 'ACTIVE',
            role: { in: ['OWNER', 'ADMIN'] },
          },
        });

        if (isAdmin) return next();

        throw ApiError.forbidden(
          'Only task assignees, creator, watchers, or admins can update task status',
        );
      }

      // ─────────────────────────────────────────
      // FULL UPDATE
      // ─────────────────────────────────────────
      if (action === 'update') {
        if (isCreator || isAssignee) return next();
      }

      // ─────────────────────────────────────────
      // DELETE
      // ─────────────────────────────────────────
      if (isCreator) return next();

      const member = await prisma.organizationMember.findFirst({
        where: {
          userId,
          organizationId,
          status: 'ACTIVE',
          role: { in: ['OWNER', 'ADMIN'] },
        },
      });

      if (!member) {
        throw ApiError.forbidden(
          'You do not have permission to perform this action on this task',
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// ───────────────────────────────────────── COMMENT ACCESS ─────────────────────────────────────────

// Checks if user can perform an action on a specific comment.

// Access rules:
//   'update' → only comment author
//   'delete' → comment author OR org OWNER/ADMIN

// param action - 'update' | 'delete'

export const requireCommentAccess = (action: 'update' | 'delete') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { commentId } = req.params;
      const userId = req.userId!;
      const organizationId = req.organizationId!;

      const comment = await prisma.comment.findFirst({
        where: {
          id: commentId as string,
          task: { organizationId },
        },
      });

      if (!comment) {
        throw ApiError.notFound('Comment not found');
      }

      const isAuthor = comment.userId === userId;

      // Only author can edit their comment
      if (action === 'update') {
        if (!isAuthor) {
          throw ApiError.forbidden('You can only edit your own comments');
        }
        return next();
      }

      // Author or OWNER/ADMIN can delete
      if (action === 'delete') {
        if (isAuthor) return next();

        const member = await prisma.organizationMember.findFirst({
          where: {
            userId,
            organizationId,
            status: 'ACTIVE',
            role: { in: ['OWNER', 'ADMIN'] },
          },
        });

        if (!member) {
          throw ApiError.forbidden(
            'You can only delete your own comments',
          );
        }

        return next();
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// ───────────────────────────────────────── TEAM ACCESS ─────────────────────────────────────────

// Checks if user can perform an action on a specific team.

// Access rules:
//   'read'   → any active org member
//   'update' → team leader OR org OWNER/ADMIN
//   'delete' → org OWNER/ADMIN only
//   'manage-members' → team leader OR org OWNER/ADMIN

// param action - 'read' | 'update' | 'delete' | 'manage-members'

export const requireTeamAccess = (action: 'read' | 'update' | 'delete' | 'manage-members') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { teamId } = req.params;
      const userId = req.userId!;
      const organizationId = req.organizationId!;

      const team = await prisma.team.findFirst({
        where: {
          id: teamId as string,
          organizationId,
        },
      });

      if (!team) {
        throw ApiError.notFound('Team not found');
      }

      if (action === 'read') {
        return next();
      }

      const isLeader = team.leaderId === userId;

      // Leader can update and manage members
      if (
        (action === 'update' || action === 'manage-members') &&
        isLeader
      ) {
        return next();
      }

      // OWNER/ADMIN can do everything
      const member = await prisma.organizationMember.findFirst({
        where: {
          userId,
          organizationId,
          status: 'ACTIVE',
          role: { in: ['OWNER', 'ADMIN'] },
        },
      });

      if (!member) {
        throw ApiError.forbidden(
          'You do not have permission to perform this action on this team',
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

