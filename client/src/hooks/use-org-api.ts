/**
 * @file use-org-api.ts
 * @description Hook that returns org-scoped API helpers.
 * Since all routes are /organizations/:id/resource,
 * this hook builds the base path for you.
 */

'use client';

import { useAppSelector } from './redux.hooks';
import api from '@/lib/axios';

export function useOrgApi() {
  const { activeOrg } = useAppSelector((state) => state.organization);

  const orgId = activeOrg?.id;

  const buildUrl = (path: string) => {
    if (!orgId) throw new Error('No active organization');
    return `/organizations/${orgId}${path}`;
  };

  return { orgId, buildUrl, api, activeOrg };
}