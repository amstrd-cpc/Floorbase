import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { hasAdminScope, requireRole } from '@/server/auth/authorization';
import { prisma } from '@/server/db/prisma/client';
import { getVenueScope } from '@/server/auth/scope-resolvers';
import { isValidIanaTimeZone } from '@/lib/timezone';
import { z } from 'zod';

const updateVenueSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    slug: z.string().regex(/^[a-z0-9-]{1,64}$/, {
      message: 'Slug must be 1–64 lowercase alphanumeric characters or hyphens.'
    }),
    timezone: z.string().trim().min(1).max(100),
    currency: z.string().trim().length(3),
    country: z.string().trim().max(100).nullable().optional(),
    city: z.string().trim().max(100).nullable().optional(),
    addressLine: z.string().trim().max(300).nullable().optional(),
    isActive: z.boolean().optional(),
    publicBookingEnabled: z.boolean().optional(),
    bookingMode: z.enum(['AUTO_CONFIRM', 'REQUEST_ONLY']).optional(),
    placementMode: z.enum(['AUTO_ASSIGN', 'TABLE_SELECTION']).optional(),
    minPartySize: z.number().int().min(1).optional(),
    maxOnlinePartySize: z.number().int().min(1).optional(),
    minAdvanceNoticeMinutes: z.number().int().min(0).optional(),
    maxDaysAhead: z.number().int().min(1).optional(),
    defaultReservationDurationMinutes: z.number().int().min(30).optional(),
    publicInstructions: z.string().trim().max(2000).nullable().optional()
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.timezone && !isValidIanaTimeZone(value.timezone)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'timezone must be a valid IANA timezone, for example Europe/Berlin.',
        path: ['timezone']
      });
    }

    if (value.minPartySize != null && value.maxOnlinePartySize != null) {
      if (value.minPartySize > value.maxOnlinePartySize) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'minPartySize cannot exceed maxOnlinePartySize.',
          path: ['minPartySize']
        });
      }
    }

    if (
      value.defaultReservationDurationMinutes != null &&
      value.defaultReservationDurationMinutes % 15 !== 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'defaultReservationDurationMinutes must be in 15-minute increments.',
        path: ['defaultReservationDurationMinutes']
      });
    }
  });

export async function GET(
  _request: Request,
  { params: paramsPromise }: { params: Promise<{ venueId: string }> }
) {
  const params = await paramsPromise;

  const user = await requireRole([
    'SUPER_ADMIN',
    'ORGANIZATION_ADMIN',
    'VENUE_MANAGER',
    'HOST'
  ]);

  const venueScope = await getVenueScope(params.venueId);
  if (!venueScope) {
    return NextResponse.json({ error: 'Venue not found.' }, { status: 404 });
  }

  if (
    !hasAdminScope(user, {
      organizationId: venueScope.organizationId,
      venueId: venueScope.id
    })
  ) {
    return NextResponse.json(
      { error: 'Forbidden for requested venue scope.' },
      { status: 403 }
    );
  }

  const venue = await prisma.venue.findUnique({
    where: { id: params.venueId }
  });
  if (!venue) {
    return NextResponse.json({ error: 'Venue not found.' }, { status: 404 });
  }

  return NextResponse.json({ venue });
}

export async function PUT(
  request: Request,
  { params: paramsPromise }: { params: Promise<{ venueId: string }> }
) {
  const params = await paramsPromise;

  const user = await requireRole([
    'SUPER_ADMIN',
    'ORGANIZATION_ADMIN',
    'VENUE_MANAGER'
  ]);

  const venueScope = await getVenueScope(params.venueId);
  if (!venueScope) {
    return NextResponse.json({ error: 'Venue not found.' }, { status: 404 });
  }

  if (
    !hasAdminScope(user, {
      organizationId: venueScope.organizationId,
      venueId: venueScope.id
    })
  ) {
    return NextResponse.json(
      { error: 'Forbidden for requested venue scope.' },
      { status: 403 }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const parsed = updateVenueSchema.safeParse(rawBody);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return NextResponse.json(
      { error: firstError?.message ?? 'Invalid venue payload.' },
      { status: 400 }
    );
  }

  const payload = parsed.data;

  if (payload.isActive === false) {
    const otherActiveVenues = await prisma.venue.count({
      where: {
        organizationId: venueScope.organizationId,
        isActive: true,
        id: { not: params.venueId }
      }
    });

    if (otherActiveVenues === 0) {
      return NextResponse.json(
        {
          error:
            'At least one active venue is required for admin access. Activate another venue before deactivating this one.'
        },
        { status: 400 }
      );
    }
  }

  const updateData: Prisma.VenueUpdateInput = {
    name: payload.name.trim(),
    slug: payload.slug.trim(),
    timezone: payload.timezone.trim(),
    currency: payload.currency.trim().toUpperCase(),
    country: payload.country?.trim() ?? null,
    city: payload.city?.trim() ?? null,
    addressLine: payload.addressLine?.trim() ?? null
  };

  if (payload.isActive !== undefined) updateData.isActive = payload.isActive;
  if (payload.publicBookingEnabled !== undefined)
    updateData.publicBookingEnabled = payload.publicBookingEnabled;
  if (payload.bookingMode !== undefined)
    updateData.bookingMode = payload.bookingMode;
  if (payload.placementMode !== undefined)
    updateData.placementMode = payload.placementMode;
  if (payload.minPartySize !== undefined)
    updateData.minPartySize = payload.minPartySize;
  if (payload.maxOnlinePartySize !== undefined)
    updateData.maxOnlinePartySize = payload.maxOnlinePartySize;
  if (payload.minAdvanceNoticeMinutes !== undefined)
    updateData.minAdvanceNoticeMinutes = payload.minAdvanceNoticeMinutes;
  if (payload.maxDaysAhead !== undefined)
    updateData.maxDaysAhead = payload.maxDaysAhead;
  if (payload.defaultReservationDurationMinutes !== undefined)
    updateData.defaultReservationDurationMinutes =
      payload.defaultReservationDurationMinutes;
  if (payload.publicInstructions !== undefined)
    updateData.publicInstructions = payload.publicInstructions?.trim() || null;

  try {
    const venue = await prisma.venue.update({
      where: { id: params.venueId },
      data: updateData
    });

    return NextResponse.json({ venue });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === 'P2002'
    ) {
      return NextResponse.json(
        { error: 'Slug already in use.' },
        { status: 409 }
      );
    }
    throw e;
  }
}
