
  // file : role.validation.ts
  // description : Zod validation schemas for RBAC role endpoints

import { z } from 'zod';
import { idParamSchema } from '@/common/validators';

const idSchema = z
  .string()
  .uuid('Invalid organization ID');

const memberIdSchema = z
  .string()
  .uuid('Invalid member ID');

const roleIdSchema = z
  .string()
  .uuid('Invalid role ID');

// GET /organizations/:id/roles
export const getRolesSchema = idParamSchema;

// POST /organizations/:id/roles
export const createRoleSchema = z.object({
  params: z.object({
    id: idSchema,
  }),
  body: z.object({
    name: z
      .string()
      .min(2, 'Role name must be at least 2 characters')
      .max(50)
      .regex(/^[A-Z_]+$/, 'Role name must be uppercase letters and underscores only e.g. TEAM_LEAD'),
    displayName: z
      .string()
      .min(2, 'Display name must be at least 2 characters')
      .max(100),
    description: z.string().max(500).optional(),
    permissionIds: z
      .array(z.string().uuid('Invalid permission ID'))
      .min(1, 'At least one permission must be assigned'),
  }),
});

// POST /organizations/:id/members/:memberId/roles
export const assignRoleSchema = z.object({
  params: z.object({
    id: idSchema,
    memberId: memberIdSchema,
  }),
  body: z.object({
    roleId: roleIdSchema,
  }),
});

// DELETE /organizations/:id/members/:memberId/roles/:roleId
export const removeRoleSchema = z.object({
  params: z.object({
    id: idSchema,
    memberId: memberIdSchema,
    roleId: roleIdSchema,
  }),
});

// DELETE /organizations/:id/roles/:roleId
export const deleteRoleSchema = z.object({
  params: z.object({
    id: idSchema,
    roleId: roleIdSchema,
  }),
});

// GET /organizations/:id/members/:memberId/permissions
export const getMemberPermissionsSchema = z.object({
  params: z.object({
    id: idSchema,
    memberId:memberIdSchema,
  }),
});