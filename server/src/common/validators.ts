
import z from "zod";

//Common validation schemas

//UUID validation
export const uuidSchema = z.string().uuid("Invalid UUID Format");

// Pagination validation
export const paginationSchema = z.object({
  query: z.object({
    page: z.string().optional().transform(val => parseInt(val || '1')),
    limit: z.string().optional().transform(val => parseInt(val || '10')),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }),
});

// ID param validation
export const idParamSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

// Search query validation
export const searchSchema = z.object({
  query: z.object({
    search: z.string().min(1).optional(),
    status: z.string().optional(),
  }),
});