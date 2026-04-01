import { z } from 'zod';

export const publicSlotQuerySchema = z
  .object({
    date: z.coerce.date(),
    partySize: z.coerce.number().int().min(1)
  })
  .strict();

export const createPublicBookingSchema = z
  .object({
    startAt: z.coerce.date(),
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
