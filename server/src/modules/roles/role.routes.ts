
// file : role.routes.ts
// description : Routes for RBAC role management

// All routes require authentication.
// Access control is handled inside role.service.ts

// ROUTES:
//   GET    /organizations/:id/roles                            → List all roles
//   POST   /organizations/:id/roles                            → Create custom role
//   DELETE /organizations/:id/roles/:roleId                    → Delete custom role
//   GET    /organizations/:id/permissions                      → List all permissions
//   POST   /organizations/:id/members/:memberId/roles          → Assign role to member
//   DELETE /organizations/:id/members/:memberId/roles/:roleId  → Remove role from member
//   GET    /organizations/:id/members/:memberId/permissions    → Get member permissions

import { Router } from 'express';
import { authenticate } from '@/middleware/auth.middleware';
import { validate } from '@/middleware/validation.middleware';
import roleController from './role.controller';
import {
  getRolesSchema,
  createRoleSchema,
  assignRoleSchema,
  removeRoleSchema,
  deleteRoleSchema,
  getMemberPermissionsSchema,
  bulkAssignRoleSchema
} from './role.validation';

// “Allow this router to access params from its parent route”

// Parent route
// app.use('/organizations/:id/roles', roleRouter);

// Here:
// :id = organizationId

// Inside child router (roleRouter)
// router.get('/', (req, res) => {
//   console.log(req.params);
// });

//  Without mergeParams
// req.params = {}
// id is missing

// With mergeParams: true
// const router = Router({ mergeParams: true });

// Now:
// req.params = { id: "org123" }

// Why this happens
// By default:
// Parent router params ❌ NOT passed to child
// Child only sees its own params

const router = Router({ mergeParams: true }); // mergeParams: access :id from parent router

router.use(authenticate);

// ───────────────────────────────────────── ROLE CRUD ────────────────────────────────────────
router.get('/', validate(getRolesSchema), roleController.getRoles);
router.post('/', validate(createRoleSchema), roleController.createRole);
router.delete('/:roleId', validate(deleteRoleSchema), roleController.deleteRole);

// ───────────────────────────────────────── PERMISSIONS ─────────────────────────────────────────
router.get('/permissions', roleController.getPermissions);

// ───────────────────────────────────────── MEMBER ROLE ASSIGNMENTS ─────────────────────────────────────────
router.post('/members/:memberId/roles', validate(assignRoleSchema), roleController.assignRole);
router.delete('/members/:memberId/roles/:roleId', validate(removeRoleSchema), roleController.removeRole);
router.get('/members/:memberId/permissions', validate(getMemberPermissionsSchema), roleController.getMemberPermissions);

// POST /bulk-assign
router.post('/bulk-assign',validate(bulkAssignRoleSchema),roleController.bulkAssignRole);

export default router;