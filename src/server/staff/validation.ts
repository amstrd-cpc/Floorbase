import { z } from 'zod';

const pinSchema = z
  .string()
  .trim()
  .regex(/^\d{4,6}$/, 'PIN must be 4-6 digits.');

export const listStaffSchema = z
  .object({
    venueId: z.string().cuid()
  })
  .strict();

export const createStaffMemberSchema = z
  .object({
    venueId: z.string().cuid(),
    name: z.string().trim().min(1).max(120),
    pin: pinSchema,
    isActive: z.boolean().optional()
  })
  .strict();

export const updateStaffMemberSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    pin: pinSchema.optional(),
    isActive: z.boolean().optional()
  })
  .strict();

export const staffPinSchema = z
  .object({
    pin: pinSchema
  })
  .strict();

export type CreateStaffMemberInput = z.infer<typeof createStaffMemberSchema>;
export type UpdateStaffMemberInput = z.infer<typeof updateStaffMemberSchema>;
export type StaffPinInput = z.infer<typeof staffPinSchema>;
