import { z } from 'zod';

export const listFloorEntitiesSchema = z
  .object({
    venueId: z.string().cuid()
  })
  .strict();

export const createAreaSchema = z
  .object({
    venueId: z.string().cuid(),
    name: z.string().trim().min(1).max(120),
    sortOrder: z.number().int().min(0).max(1000).optional(),
    isActive: z.boolean().optional()
  })
  .strict();

export const updateAreaSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    sortOrder: z.number().int().min(0).max(1000).optional(),
    isActive: z.boolean().optional()
  })
  .strict();

export const createTableSchema = z
  .object({
    venueId: z.string().cuid(),
    areaId: z.string().cuid(),
    name: z.string().trim().min(1).max(120),
    code: z.string().trim().min(1).max(32).nullable().optional(),
    capacityMin: z.number().int().min(1).max(20).nullable().optional(),
    capacityMax: z.number().int().min(1).max(20),
    isActive: z.boolean().optional()
  })
  .strict();

export const updateTableSchema = z
  .object({
    areaId: z.string().cuid().optional(),
    name: z.string().trim().min(1).max(120).optional(),
    code: z.string().trim().min(1).max(32).nullable().optional(),
    capacityMin: z.number().int().min(1).max(20).nullable().optional(),
    capacityMax: z.number().int().min(1).max(20).optional(),
    isActive: z.boolean().optional()
  })
  .strict();

export type CreateAreaInput = z.infer<typeof createAreaSchema>;
export type UpdateAreaInput = z.infer<typeof updateAreaSchema>;
export type CreateTableInput = z.infer<typeof createTableSchema>;
export type UpdateTableInput = z.infer<typeof updateTableSchema>;
