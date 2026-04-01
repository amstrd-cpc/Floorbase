import { NextResponse } from 'next/server';
import { hasAdminScope, requireRole } from '@/server/auth/authorization';
import { prisma } from '@/server/db/prisma/client';
import { getVenueScope } from '@/server/auth/scope-resolvers';
import { isValidIanaTimeZone } from '@/lib/timezone';

export async function GET(
  _request: Request,
  { params }: { params: { venueId: string } }
) {
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
  { params }: { params: { venueId: string } }
) {
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

  const payload = (await request.json()) as {
    name?: string;
    slug?: string;
    timezone?: string;
    currency?: string;
    isActive?: boolean;
    publicBookingEnabled?: boolean;
    bookingMode?: 'AUTO_CONFIRM' | 'REQUEST_ONLY';
    maxOnlinePartySize?: number;
    minAdvanceNoticeMinutes?: number;
    maxDaysAhead?: number;
    defaultReservationDurationMinutes?: number;
  };

  if (
    !payload.name ||
    !payload.slug ||
    !payload.timezone ||
    !payload.currency
  ) {
    return NextResponse.json(
      { error: 'name, slug, timezone, and currency are required.' },
      { status: 400 }
    );
  }


  if (!isValidIanaTimeZone(payload.timezone.trim())) {
    return NextResponse.json(
      { error: 'timezone must be a valid IANA timezone, for example Europe/Berlin.' },
      { status: 400 }
    );
  }
  if ((payload.maxOnlinePartySize ?? 1) < 1) {
    return NextResponse.json(
      { error: 'maxOnlinePartySize must be at least 1.' },
      { status: 400 }
    );
  }

  if ((payload.maxDaysAhead ?? 1) < 1) {
    return NextResponse.json(
      { error: 'maxDaysAhead must be at least 1.' },
      { status: 400 }
    );
  }

  if ((payload.minAdvanceNoticeMinutes ?? 0) < 0) {
    return NextResponse.json(
      { error: 'minAdvanceNoticeMinutes must be 0 or greater.' },
      { status: 400 }
    );
  }

  if (
    (payload.defaultReservationDurationMinutes ?? 0) < 30 ||
    (payload.defaultReservationDurationMinutes ?? 0) % 15 !== 0
  ) {
    return NextResponse.json(
      {
        error:
          'defaultReservationDurationMinutes must be at least 30 and in 15-minute increments.'
      },
      { status: 400 }
    );
  }

  const venue = await prisma.venue.update({
    where: { id: params.venueId },
    data: {
      name: payload.name.trim(),
      slug: payload.slug.trim(),
      timezone: payload.timezone.trim(),
      currency: payload.currency.trim().toUpperCase(),
      isActive: payload.isActive ?? true,
      publicBookingEnabled: payload.publicBookingEnabled ?? false,
      bookingMode: payload.bookingMode ?? 'AUTO_CONFIRM',
      maxOnlinePartySize: payload.maxOnlinePartySize ?? 12,
      minAdvanceNoticeMinutes: payload.minAdvanceNoticeMinutes ?? 120,
      maxDaysAhead: payload.maxDaysAhead ?? 60,
      defaultReservationDurationMinutes:
        payload.defaultReservationDurationMinutes ?? 120
    }
  });

  return NextResponse.json({ venue });
}
