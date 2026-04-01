import { z } from 'zod';

export const publicSlotQuerySchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    partySize: z.coerce.number().int().min(1)
  })
  .strict();

export const createPublicBookingSchema = z
  .object({
    startAtLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
    partySize: z.number().int().min(1),
    fullName: z.string().trim().min(1).max(200),
    email: z.string().trim().email().max(320),
    phone: z.string().trim().min(7).max(40),
    note: z.string().trim().max(1000).optional()
  })
  .strict();

export type CreatePublicBookingInput = z.infer<
  typeof createPublicBookingSchema
>;
