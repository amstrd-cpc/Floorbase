import { z } from 'zod';

export const adjustStockSchema = z
  .object({
    quantityDelta: z
      .number()
      .int()
      .refine((n) => n !== 0, 'quantityDelta must not be 0')
  })
  .strict();

export const listLowStockSchema = z
  .object({
    venueId: z.string().cuid()
  })
  .strict();

export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
