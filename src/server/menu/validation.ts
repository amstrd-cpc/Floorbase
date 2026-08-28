import { z } from 'zod';

export const listMenuSchema = z
  .object({
    venueId: z.string().cuid()
  })
  .strict();

export const createMenuCategorySchema = z
  .object({
    venueId: z.string().cuid(),
    name: z.string().trim().min(1).max(120),
    sortOrder: z.number().int().min(0).max(1000).optional(),
    isActive: z.boolean().optional()
  })
  .strict();

export const updateMenuCategorySchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    sortOrder: z.number().int().min(0).max(1000).optional(),
    isActive: z.boolean().optional()
  })
  .strict();

export const createMenuItemSchema = z
  .object({
    venueId: z.string().cuid(),
    categoryId: z.string().cuid(),
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500).nullable().optional(),
    priceMinor: z.number().int().min(0).max(10_000_00),
    sortOrder: z.number().int().min(0).max(1000).optional(),
    isActive: z.boolean().optional()
  })
  .strict();

export const updateMenuItemSchema = z
  .object({
    categoryId: z.string().cuid().optional(),
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    priceMinor: z.number().int().min(0).max(10_000_00).optional(),
    sortOrder: z.number().int().min(0).max(1000).optional(),
    isActive: z.boolean().optional()
  })
  .strict();

export type CreateMenuCategoryInput = z.infer<typeof createMenuCategorySchema>;
export type UpdateMenuCategoryInput = z.infer<typeof updateMenuCategorySchema>;
export type CreateMenuItemInput = z.infer<typeof createMenuItemSchema>;
export type UpdateMenuItemInput = z.infer<typeof updateMenuItemSchema>;
