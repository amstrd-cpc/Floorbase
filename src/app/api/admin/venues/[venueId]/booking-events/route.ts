import { NextResponse } from 'next/server';
import { hasAdminScope, requireRole } from '@/server/auth/authorization';
import { prisma } from '@/server/db/prisma/client';
import { getVenueScope } from '@/server/auth/scope-resolvers';
import { zonedTimeToUtc } from '@/lib/timezone';
import { mapZodErrors } from '@/lib/zod-utils';
import {
  createBookingEventSchema,
  updateBookingEventSchema
} from '@/server/booking-events/validation';

async function assertWriteAccess(venueId: string) {
  const user = await requireRole([
    'SUPER_ADMIN',
    'ORGANIZATION_ADMIN',
    'VENUE_MANAGER'
  ]);
  const venueScope = await getVenueScope(venueId);
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

  return null;
}

function normalizeNullableString(value?: string | null) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function parseCalendarDateInVenueTimeZone(
  value: string | null | undefined,
  venueTimeZone: string
) {
  if (!value) {
    return null;
  }
  const [yearText, monthText, dayText] = value.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  return zonedTimeToUtc({
    year,
    month,
    day,
    hour: 12,
    minute: 0,
    timeZone: venueTimeZone
  });
}

async function resolveVenueTimeZone(venueId: string) {
  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    select: { timezone: true }
  });
  if (!venue) {
    return null;
  }
  return venue.timezone;
}

async function verifyAreaIds(areaIds: string[], venueId: string) {
  if (!areaIds || areaIds.length === 0) return true;
  const count = await prisma.area.count({
    where: { id: { in: areaIds }, venueId }
  });
  return count === areaIds.length;
}

async function verifyTableIds(tableIds: string[], venueId: string) {
  if (!tableIds || tableIds.length === 0) return true;
  const count = await prisma.table.count({
    where: { id: { in: tableIds }, venueId }
  });
  return count === tableIds.length;
}

export async function GET(
  _request: Request,
  { params: paramsPromise }: { params: Promise<{ venueId: string }> }
) {
  const params = await paramsPromise;

  const denied = await assertWriteAccess(params.venueId);
  if (denied) return denied;

  const events = await prisma.bookingEvent.findMany({
    where: { venueId: params.venueId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
  });

  return NextResponse.json({ events });
}

export async function POST(
  request: Request,
  { params: paramsPromise }: { params: Promise<{ venueId: string }> }
) {
  const params = await paramsPromise;

  const denied = await assertWriteAccess(params.venueId);
  if (denied) return denied;

  const venueTimeZone = await resolveVenueTimeZone(params.venueId);
  if (!venueTimeZone) {
    return NextResponse.json({ error: 'Venue not found.' }, { status: 404 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const parsed = createBookingEventSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Invalid event payload.',
        details: mapZodErrors(parsed.error.issues)
      },
      { status: 400 }
    );
  }

  const data = parsed.data;

  if (data.allowedAreaIds?.length) {
    const valid = await verifyAreaIds(data.allowedAreaIds, params.venueId);
    if (!valid) {
      return NextResponse.json(
        { error: 'One or more allowedAreaIds do not belong to this venue.' },
        { status: 400 }
      );
    }
  }

  if (data.allowedTableIds?.length) {
    const valid = await verifyTableIds(data.allowedTableIds, params.venueId);
    if (!valid) {
      return NextResponse.json(
        { error: 'One or more allowedTableIds do not belong to this venue.' },
        { status: 400 }
      );
    }
  }

  const event = await prisma.bookingEvent.create({
    data: {
      venueId: params.venueId,
      isActive: data.isActive ?? true,
      name: data.name.trim(),
      eventType: data.eventType,
      singleDate: parseCalendarDateInVenueTimeZone(
        data.singleDate,
        venueTimeZone
      ),
      dateStart: parseCalendarDateInVenueTimeZone(
        data.dateStart,
        venueTimeZone
      ),
      dateEnd: parseCalendarDateInVenueTimeZone(data.dateEnd, venueTimeZone),
      weekdays: data.weekdays ?? [],
      confirmationMode: data.confirmationMode ?? null,
      placementMode: data.placementMode ?? null,
      minPartySize: data.minPartySize ?? null,
      maxOnlinePartySize: data.maxOnlinePartySize ?? null,
      minAdvanceNoticeMinutes: data.minAdvanceNoticeMinutes ?? null,
      maxDaysAhead: data.maxDaysAhead ?? null,
      durationMinutes: data.durationMinutes ?? null,
      publicInstructions: normalizeNullableString(data.publicInstructions),
      publicLabel: normalizeNullableString(data.publicLabel),
      allowedAreaIds: data.allowedAreaIds ?? [],
      allowedTableIds: data.allowedTableIds ?? []
    }
  });

  return NextResponse.json({ event }, { status: 201 });
}

export async function PUT(
  request: Request,
  { params: paramsPromise }: { params: Promise<{ venueId: string }> }
) {
  const params = await paramsPromise;

  const denied = await assertWriteAccess(params.venueId);
  if (denied) return denied;

  const venueTimeZone = await resolveVenueTimeZone(params.venueId);
  if (!venueTimeZone) {
    return NextResponse.json({ error: 'Venue not found.' }, { status: 404 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const parsed = updateBookingEventSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Invalid event payload.',
        details: mapZodErrors(parsed.error.issues)
      },
      { status: 400 }
    );
  }

  const data = parsed.data;

  const existing = await prisma.bookingEvent.findFirst({
    where: { id: data.id, venueId: params.venueId },
    select: { id: true }
  });
  if (!existing) {
    return NextResponse.json({ error: 'Event not found.' }, { status: 404 });
  }

  if (data.allowedAreaIds?.length) {
    const valid = await verifyAreaIds(data.allowedAreaIds, params.venueId);
    if (!valid) {
      return NextResponse.json(
        { error: 'One or more allowedAreaIds do not belong to this venue.' },
        { status: 400 }
      );
    }
  }

  if (data.allowedTableIds?.length) {
    const valid = await verifyTableIds(data.allowedTableIds, params.venueId);
    if (!valid) {
      return NextResponse.json(
        { error: 'One or more allowedTableIds do not belong to this venue.' },
        { status: 400 }
      );
    }
  }

  const event = await prisma.bookingEvent.update({
    where: { id: data.id },
    data: {
      isActive: data.isActive ?? true,
      name: data.name.trim(),
      eventType: data.eventType,
      singleDate: parseCalendarDateInVenueTimeZone(
        data.singleDate,
        venueTimeZone
      ),
      dateStart: parseCalendarDateInVenueTimeZone(
        data.dateStart,
        venueTimeZone
      ),
      dateEnd: parseCalendarDateInVenueTimeZone(data.dateEnd, venueTimeZone),
      weekdays: data.weekdays ?? [],
      confirmationMode: data.confirmationMode ?? null,
      placementMode: data.placementMode ?? null,
      minPartySize: data.minPartySize ?? null,
      maxOnlinePartySize: data.maxOnlinePartySize ?? null,
      minAdvanceNoticeMinutes: data.minAdvanceNoticeMinutes ?? null,
      maxDaysAhead: data.maxDaysAhead ?? null,
      durationMinutes: data.durationMinutes ?? null,
      publicInstructions: normalizeNullableString(data.publicInstructions),
      publicLabel: normalizeNullableString(data.publicLabel),
      allowedAreaIds: data.allowedAreaIds ?? [],
      allowedTableIds: data.allowedTableIds ?? []
    }
  });

  return NextResponse.json({ event });
}

export async function DELETE(
  request: Request,
  { params: paramsPromise }: { params: Promise<{ venueId: string }> }
) {
  const params = await paramsPromise;

  const denied = await assertWriteAccess(params.venueId);
  if (denied) return denied;

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id is required.' }, { status: 400 });
  }

  const event = await prisma.bookingEvent.findFirst({
    where: { id, venueId: params.venueId },
    select: { id: true }
  });
  if (!event) {
    return NextResponse.json({ error: 'Event not found.' }, { status: 404 });
  }

  await prisma.bookingEvent.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
