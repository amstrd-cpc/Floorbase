import { DepositStatus, ReservationSource } from '@prisma/client';
import { z } from 'zod';

const optionalTrimmedString = z
  .string()
  .trim()
  .max(1000)
  .transform((value) => (value.length === 0 ? null : value))
  .nullable()
  .optional();

const reservationDateTimeSchema = z.coerce.date({
  invalid_type_error: 'Invalid reservation date/time.'
});

const tableIdsSchema = z
  .array(z.string().cuid())
  .min(1, 'At least one table must be assigned.');

const depositSchema = z
  .object({
    amountMinor: z.number().int().positive(),
    currency: z
      .string()
      .trim()
      .length(3)
      .transform((value) => value.toUpperCase()),
    status: z.nativeEnum(DepositStatus),
    paidAt: z.coerce.date().nullable().optional(),
    provider: optionalTrimmedString,
    providerRef: optionalTrimmedString
  })
  .strict();

const baseMutationSchema = z
  .object({
    venueId: z.string().cuid(),
    reservationDate: reservationDateTimeSchema,
    startAt: reservationDateTimeSchema,
    endAt: reservationDateTimeSchema.optional(),
    durationMinutes: z.number().int().min(30).max(300).optional(),
    partySize: z.number().int().min(1).max(50),
    guest: z
      .object({
        firstName: z.string().trim().max(100).nullable().optional(),
        lastName: z.string().trim().max(100).nullable().optional(),
        fullName: z.string().trim().min(1).max(200),
        email: z.string().trim().email().nullable().optional(),
        phone: z.string().trim().min(7).max(40).nullable().optional()
      })
      .strict(),
    reservationStatusId: z.string().cuid().optional(),
    tableIds: tableIdsSchema,
    internalNotes: optionalTrimmedString,
    specialRequests: optionalTrimmedString,
    source: z.nativeEnum(ReservationSource).nullable().optional(),
    depositRequired: z.boolean().optional(),
    deposit: depositSchema.nullable().optional()
  })
  .strict();

export const createReservationSchema = baseMutationSchema.superRefine(
  (value, ctx) => {
    if (!value.endAt && !value.durationMinutes) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Either endAt or durationMinutes is required.',
        path: ['endAt']
      });
    }

    if (value.endAt && value.endAt <= value.startAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'endAt must be after startAt.',
        path: ['endAt']
      });
    }

    if (!value.guest.email && !value.guest.phone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'At least one guest contact method (email or phone) is required.',
        path: ['guest']
      });
    }

    if (value.deposit && value.depositRequired === false) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'deposit cannot be set when depositRequired is false.',
        path: ['deposit']
      });
    }
  }
);

export const updateReservationSchema = baseMutationSchema
  .partial()
  .extend({
    reservationStatusId: z.string().cuid().optional(),
    tableIds: tableIdsSchema.optional(),
    guest: baseMutationSchema.shape.guest.partial().optional()
  })
  .strict();

export const changeReservationStatusSchema = z
  .object({
    reservationStatusId: z.string().cuid()
  })
  .strict();

export const cancelReservationSchema = z
  .object({
    reason: z.string().trim().max(500).optional()
  })
  .strict();

export type CreateReservationInput = z.infer<typeof createReservationSchema>;
export type UpdateReservationInput = z.infer<typeof updateReservationSchema>;
export type ChangeReservationStatusInput = z.infer<
  typeof changeReservationStatusSchema
>;
export type CancelReservationInput = z.infer<typeof cancelReservationSchema>;
