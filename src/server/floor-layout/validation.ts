import { z } from 'zod';
import { tableShapeSchema } from '@/server/floor/validation';

const floorAreaInputSchema = z
  .object({
    id: z.string().cuid(),
    areaId: z.string().cuid().nullable(),
    name: z.string().trim().min(1).max(120),
    sortOrder: z.number().int().min(0).max(1000),
    isActive: z.boolean()
  })
  .strict();

const floorTableInputSchema = z
  .object({
    id: z.string().cuid(),
    tableId: z.string().cuid(),
    floorLayoutAreaId: z.string().cuid().nullable(),
    label: z.string().trim().min(1).max(120),
    capacityMin: z.number().int().min(1).max(20).nullable(),
    capacityMax: z.number().int().min(1).max(20),
    shape: tableShapeSchema,
    x: z.number().int().min(0).max(5000),
    y: z.number().int().min(0).max(5000),
    width: z.number().int().min(40).max(600),
    height: z.number().int().min(40).max(600),
    rotation: z.number().int().min(-180).max(180),
    isActive: z.boolean(),
    combinableMeta: z.unknown().nullable().optional()
  })
  .strict();

export const saveFloorLayoutSchema = z
  .object({
    venueId: z.string().cuid(),
    canvasWidth: z.number().int().min(400).max(5000),
    canvasHeight: z.number().int().min(300).max(5000),
    gridSize: z.number().int().min(8).max(80),
    areas: z.array(floorAreaInputSchema),
    tables: z.array(floorTableInputSchema)
  })
  .strict();
