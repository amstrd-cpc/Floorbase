import { NextResponse } from 'next/server';
import { BookingEventType } from '@prisma/client';
import { hasAdminScope, requireRole } from '@/server/auth/authorization';
import { prisma } from '@/server/db/prisma/client';
import { getVenueScope } from '@/server/auth/scope-resolvers';
import { zonedTimeToUtc } from '@/lib/timezone';

type EventPayload = {
  id?: string;
  isActive?: boolean;
  name?: string;
  eventType?: BookingEventType;
  singleDate?: string | null;
  dateStart?: string | null;
  dateEnd?: string | null;
  weekdays?: number[];
  confirmationMode?: 'AUTO_CONFIRM' | 'REQUEST_ONLY' | null;
  placementMode?: 'AUTO_ASSIGN' | 'TABLE_SELECTION' | null;
  minPartySize?: number | null;
  maxOnlinePartySize?: number | null;
  minAdvanceNoticeMinutes?: number | null;
  maxDaysAhead?: number | null;
  durationMinutes?: number | null;
  publicInstructions?: string | null;
  publicLabel?: string | null;
  allowedAreaIds?: string[];
  allowedTableIds?: string[];
};

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
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

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

function validateEventPayload(payload: EventPayload, venueTimeZone: string) {
  if (!payload.name?.trim()) {
    return 'name is required.';
  }
  if (!payload.eventType) {
    return 'eventType is required.';
  }
  if (
    payload.eventType === 'SINGLE_DATE' &&
    !parseCalendarDateInVenueTimeZone(payload.singleDate, venueTimeZone)
  ) {
    return 'singleDate is required for single-date events.';
  }
  if (
    payload.eventType === 'DATE_RANGE' &&
    (!parseCalendarDateInVenueTimeZone(payload.dateStart, venueTimeZone) ||
      !parseCalendarDateInVenueTimeZone(payload.dateEnd, venueTimeZone))
  ) {
    return 'dateStart and dateEnd are required for date-range events.';
  }
  if (
    payload.eventType === 'WEEKLY_RECURRING' &&
    (!payload.weekdays || payload.weekdays.length === 0)
  ) {
    return 'weekdays are required for weekly recurring events.';
  }

  return null;
}

export async function GET(
  _request: Request,
  { params }: { params: { venueId: string } }
) {
  const denied = await assertWriteAccess(params.venueId);
  if (denied) return denied;

  const events = await prisma.bookingEvent.findMany({
    where: { venueId: params.venueId },
    orderBy: [{ createdAt: 'desc' }]
  });

  return NextResponse.json({ events });
}

export async function POST(
  request: Request,
  { params }: { params: { venueId: string } }
) {
  const denied = await assertWriteAccess(params.venueId);
  if (denied) return denied;
  const venueTimeZone = await resolveVenueTimeZone(params.venueId);
  if (!venueTimeZone) {
    return NextResponse.json({ error: 'Venue not found.' }, { status: 404 });
  }

  const payload = (await request.json()) as EventPayload;
  const error = validateEventPayload(payload, venueTimeZone);
  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  const event = await prisma.bookingEvent.create({
    data: {
      venueId: params.venueId,
      isActive: payload.isActive ?? true,
      name: payload.name!.trim(),
      priority: 100,
      eventType: payload.eventType!,
      singleDate: parseCalendarDateInVenueTimeZone(payload.singleDate, venueTimeZone),
      dateStart: parseCalendarDateInVenueTimeZone(payload.dateStart, venueTimeZone),
      dateEnd: parseCalendarDateInVenueTimeZone(payload.dateEnd, venueTimeZone),
      weekdays: payload.weekdays ?? [],
      confirmationMode: payload.confirmationMode ?? null,
      placementMode: payload.placementMode ?? null,
      minPartySize: payload.minPartySize ?? null,
      maxOnlinePartySize: payload.maxOnlinePartySize ?? null,
      minAdvanceNoticeMinutes: payload.minAdvanceNoticeMinutes ?? null,
      maxDaysAhead: payload.maxDaysAhead ?? null,
      durationMinutes: payload.durationMinutes ?? null,
      publicInstructions: normalizeNullableString(payload.publicInstructions),
      publicLabel: normalizeNullableString(payload.publicLabel),
      allowedAreaIds: payload.allowedAreaIds ?? [],
      allowedTableIds: payload.allowedTableIds ?? []
    }
  });

  return NextResponse.json({ event }, { status: 201 });
}

export async function PUT(
  request: Request,
  { params }: { params: { venueId: string } }
) {
  const denied = await assertWriteAccess(params.venueId);
  if (denied) return denied;
  const venueTimeZone = await resolveVenueTimeZone(params.venueId);
  if (!venueTimeZone) {
    return NextResponse.json({ error: 'Venue not found.' }, { status: 404 });
  }

  const payload = (await request.json()) as EventPayload;
  if (!payload.id) {
    return NextResponse.json({ error: 'id is required.' }, { status: 400 });
  }

  const error = validateEventPayload(payload, venueTimeZone);
  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }
  const existing = await prisma.bookingEvent.findFirst({
    where: { id: payload.id, venueId: params.venueId },
    select: { id: true }
  });
  if (!existing) {
    return NextResponse.json({ error: 'Event not found.' }, { status: 404 });
  }

  const event = await prisma.bookingEvent.update({
    where: { id: payload.id },
    data: {
      isActive: payload.isActive ?? true,
      name: payload.name!.trim(),
      priority: 100,
      eventType: payload.eventType!,
      singleDate: parseCalendarDateInVenueTimeZone(payload.singleDate, venueTimeZone),
      dateStart: parseCalendarDateInVenueTimeZone(payload.dateStart, venueTimeZone),
      dateEnd: parseCalendarDateInVenueTimeZone(payload.dateEnd, venueTimeZone),
      weekdays: payload.weekdays ?? [],
      confirmationMode: payload.confirmationMode ?? null,
      placementMode: payload.placementMode ?? null,
      minPartySize: payload.minPartySize ?? null,
      maxOnlinePartySize: payload.maxOnlinePartySize ?? null,
      minAdvanceNoticeMinutes: payload.minAdvanceNoticeMinutes ?? null,
      maxDaysAhead: payload.maxDaysAhead ?? null,
      durationMinutes: payload.durationMinutes ?? null,
      publicInstructions: normalizeNullableString(payload.publicInstructions),
      publicLabel: normalizeNullableString(payload.publicLabel),
      allowedAreaIds: payload.allowedAreaIds ?? [],
      allowedTableIds: payload.allowedTableIds ?? []
    }
  });

  return NextResponse.json({ event });
}

export async function DELETE(
  request: Request,
  { params }: { params: { venueId: string } }
) {
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
