import { z } from 'zod';

const weekdaysSchema = z.array(z.number().int().min(0).max(6));

const nullablePositiveInt = (min: number, max: number) =>
  z.number().int().min(min).max(max).nullable().optional();

const nullableString = (maxLen: number) =>
  z.string().trim().max(maxLen).nullable().optional();

const baseEventSchema = z.object({
  name: z.string().trim().min(1).max(200),
  eventType: z.enum(['SINGLE_DATE', 'DATE_RANGE', 'WEEKLY_RECURRING']),
  isActive: z.boolean().optional().default(true),
  singleDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  dateStart: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  dateEnd: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  weekdays: weekdaysSchema.optional(),
  confirmationMode: z
    .enum(['AUTO_CONFIRM', 'REQUEST_ONLY'])
    .nullable()
    .optional(),
  placementMode: z
    .enum(['AUTO_ASSIGN', 'TABLE_SELECTION'])
    .nullable()
    .optional(),
  minPartySize: nullablePositiveInt(1, 100),
  maxOnlinePartySize: nullablePositiveInt(1, 100),
  durationMinutes: nullablePositiveInt(30, 720),
  minAdvanceNoticeMinutes: nullablePositiveInt(0, 43200),
  maxDaysAhead: nullablePositiveInt(1, 365),
  publicLabel: nullableString(200),
  publicInstructions: nullableString(2000),
  allowedAreaIds: z.array(z.string().cuid()).optional(),
  allowedTableIds: z.array(z.string().cuid()).optional()
});

function refineEvent(
  value: z.infer<typeof baseEventSchema>,
  ctx: z.RefinementCtx
) {
  if (value.eventType === 'SINGLE_DATE' && !value.singleDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'singleDate is required for SINGLE_DATE events.',
      path: ['singleDate']
    });
  }

  if (value.eventType === 'DATE_RANGE') {
    if (!value.dateStart) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'dateStart is required for DATE_RANGE events.',
        path: ['dateStart']
      });
    }
    if (!value.dateEnd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'dateEnd is required for DATE_RANGE events.',
        path: ['dateEnd']
      });
    }
    if (value.dateStart && value.dateEnd && value.dateStart > value.dateEnd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'dateStart must be on or before dateEnd.',
        path: ['dateEnd']
      });
    }
  }

  if (
    value.eventType === 'WEEKLY_RECURRING' &&
    (!value.weekdays || value.weekdays.length === 0)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'weekdays is required for WEEKLY_RECURRING events.',
      path: ['weekdays']
    });
  }

  if (
    value.minPartySize != null &&
    value.maxOnlinePartySize != null &&
    value.minPartySize > value.maxOnlinePartySize
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'minPartySize cannot exceed maxOnlinePartySize.',
      path: ['minPartySize']
    });
  }
}

export const createBookingEventSchema =
  baseEventSchema.superRefine(refineEvent);

export const updateBookingEventSchema = baseEventSchema
  .extend({ id: z.string().cuid() })
  .superRefine(refineEvent);
