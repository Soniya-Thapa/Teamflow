
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

// Validates GET /organizations/:id
// Validates DELETE /organizations/:id
// Only needs a valid UUID in params

export const getOrganizationSchema = idParamSchema;
export const deleteOrganizationSchema = idParamSchema;

// LIST ORGANIZATIONS

// Validates GET / organizations
// Supports pagination: ? page = 1 & limit=10

export const listOrganizationsSchema = paginationSchema;