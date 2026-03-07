
// @file organization.validation.ts
// @description Zod validation schemas for organization endpoints
// Validates all incoming request data before it reaches the service layer.
// Slug rules follow URL-safe conventions (lowercase, hyphens only).

import { idParamSchema, paginationSchema } from '@/common/validators';
import { z } from 'zod';

// SHARED SCHEMAS

// Slug must be URL-safe: lowercase letters, numbers, hyphens only.
// Examples: "my-company", "acme-corp", "teamflow-inc"

const slugSchema = z
  .string()
  .min(3, 'Slug must be at least 3 characters')
  .max(50, 'Slug must be at most 50 characters')
  .regex(
    /^[a-z0-9-]+$/,
    'Slug can only contain lowercase letters, numbers, and hyphens (e.g. my-company)',
  );

// ENDPOINT SCHEMAS

// POST /organizations
// Create a new organization

export const createOrganizationSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(2, 'Name must be at least 2 characters')
      .max(100, 'Organization name cannot exceed 100 characters'),
    slug: slugSchema,
    logo: z
      .string()
      .url('Logo must be a valid URL')
      .optional(),
  }),
});

// PUT /organizations/:id
// Update organization details
// All fields are optional (partial update)
// At least one field must be provided

export const updateOrganizationSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid organization ID'),
  }),
  body: z.object({
    name: z
      .string()
      .min(2, 'Name must be at least 2 characters')
      .max(100, 'Organization name cannot exceed 100 characters')
      .optional(),
    logo: z
      .string()
      .url('Logo must be a valid URL')
      .nullable()
      .optional(),
  })
    .refine(
      (data) => Object.keys(data).length > 0,
      { message: 'At least one field must be provided for update' },
    ),
});

// GET / DELETE ORGANIZATION
// Only needs a valid UUID in params

// Validates GET /organizations/:id
export const getOrganizationSchema = idParamSchema;

// Validates DELETE /organizations/:id
export const deleteOrganizationSchema = idParamSchema;

// LIST ORGANIZATIONS

// Validates GET / organizations
// Supports pagination: ? page = 1 & limit=10

export const listOrganizationsSchema = paginationSchema;

// PATCH /organizations/:id/settings
// Update organization branding and feature settings

export const updateOrganizationSettingsSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid organization ID'),
  }),
  body: z.object({
    primaryColor: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color e.g. #6366f1')
      .optional(),
    accentColor: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color e.g. #8b5cf6')
      .optional(),
    isInviteOnly: z.boolean().optional(),
    allowGuestAccess: z.boolean().optional(),
  }).refine(
    (data) => Object.keys(data).length > 0,
    { message: 'At least one field must be provided' },
  ),
});

// PATCH /admin/organizations/:id/status
// Super admin updates organization status
//Why it exists: When a super admin suspends an organization, you want to know why it was suspended. It gets logged with Winston, not saved to the database.

export const updateOrganizationStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid organization ID'),
  }),
  body: z.object({
    status: z.enum(['ACTIVE', 'SUSPENDED', 'CANCELED'], {
      message: 'Status must be ACTIVE, SUSPENDED, or CANCELED',
    }),
    reason: z
      .string()
      .min(1, 'Reason is required')
      .max(500)
      .optional(),
  }),
});

// PATCH /organizations/:id/status
// Owner suspends or reactivates their own organization
// Note: CANCELED is excluded — owners use DELETE endpoint to cancel
// Note: CANCELED is excluded — only super admin can set CANCELED status directly

//The owner-level suspension endpoint needs a separate schema that only allows ACTIVE and SUSPENDED — owners cannot cancel their own org through the status endpoint (they use the delete endpoint for that).

export const updateOwnerStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid organization ID'),
  }),
  body: z.object({
    status: z.enum(['ACTIVE', 'SUSPENDED'], {
      message: 'Status must be ACTIVE or SUSPENDED',
    }),
  }),
});

// PATCH /organizations/:id/onboarding
// Update onboarding progress

export const updateOnboardingSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid organization ID'),
  }),
  body: z.object({
    onboardingStep: z
      .number()
      .int()
      .min(0)
      .max(5),
  }),
});

// GET /admin/organizations
// Super admin lists all organizations with filters

export const adminListOrganizationsSchema = z.object({
  query: z.object({
    page: z
      .string()
      .optional()
      .transform(val => parseInt(val || '1')),
    limit: z.
      string()
      .optional()
      .transform(val => parseInt(val || '10')),
    status: z
      .enum(['ACTIVE', 'SUSPENDED', 'CANCELED'])
      .optional(),
    plan: z
      .enum(['FREE', 'PRO', 'ENTERPRISE'])
      .optional(),
    search: z
      .string()
      .optional(),
  }),
});