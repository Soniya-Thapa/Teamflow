/**
 * @file search.routes.ts
 * @description Search routes — org-scoped with mergeParams.
 * Mounted at /organizations/:id/search in app.ts.
 */

import { Router } from 'express';
import { authenticate } from '@/middleware/auth.middleware';
import { requireOrganization } from '@/middleware/tenant.middleware';
import searchController from './search.controller';

// mergeParams: true makes :id from parent route available
const router = Router({ mergeParams: true });

router.use(authenticate, requireOrganization);

// GET /organizations/:id/search?q=query
router.get('/', searchController.search);

export default router;