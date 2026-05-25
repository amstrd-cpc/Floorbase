import { NextResponse } from 'next/server';
import { hasAdminScope, requireRole } from '@/server/auth/authorization';
import { prisma } from '@/server/db/prisma/client';
import { getTableScope, getVenueScope } from '@/server/auth/scope-resolvers';

export async function GET(request: Request) {
  const user = await requireRole([
    'SUPER_ADMIN',
    'ORGANIZATION_ADMIN',
    'VENUE_MANAGER',
    'HOST'
  ]);
  const { searchParams } = new URL(request.url);
  const venueId = searchParams.get('venueId');

  if (!venueId) {
    return NextResponse.json(
      { error: 'venueId is required.' },
      { status: 400 }
    );
  }

  const venue = await getVenueScope(venueId);
  if (!venue) {
    return NextResponse.json({ error: 'Venue not found.' }, { status: 404 });
  }

  if (
    !hasAdminScope(user, {
      organizationId: venue.organizationId,
      venueId: venue.id
    })
  ) {
    return NextResponse.json(
      { error: 'Forbidden for requested venue scope.' },
      { status: 403 }
    );
  }

  const blocks = await prisma.tableBlock.findMany({
    where: { table: { venueId }, isActive: true },
    include: { table: { select: { id: true, name: true } } },
    orderBy: { startsAt: 'asc' }
  });

  return NextResponse.json({ blocks });
}

export async function POST(request: Request) {
  const user = await requireRole([
    'SUPER_ADMIN',
    'ORGANIZATION_ADMIN',
    'VENUE_MANAGER'
  ]);
  const payload = (await request.json()) as {
    tableId?: string;
    startsAt?: string;
    endsAt?: string;
    reason?: string;
  };

  if (!payload.tableId || !payload.startsAt || !payload.endsAt) {
    return NextResponse.json(
      { error: 'tableId, startsAt, and endsAt are required.' },
      { status: 400 }
    );
  }

  const startsAt = new Date(payload.startsAt);
  const endsAt = new Date(payload.endsAt);
  const MAX_BLOCK_MS = 365 * 24 * 60 * 60 * 1000; // 1 year

  if (
    Number.isNaN(startsAt.getTime()) ||
    Number.isNaN(endsAt.getTime()) ||
    endsAt <= startsAt ||
    endsAt.getTime() - startsAt.getTime() > MAX_BLOCK_MS
  ) {
    return NextResponse.json(
      { error: 'Invalid block window. Must be a valid future range under 1 year.' },
      { status: 400 }
    );
  }

  if (payload.reason && payload.reason.length > 500) {
    return NextResponse.json(
      { error: 'Reason must be 500 characters or fewer.' },
      { status: 400 }
    );
  }

  const tableScope = await getTableScope(payload.tableId);
  if (!tableScope) {
    return NextResponse.json({ error: 'Table not found.' }, { status: 404 });
  }

  if (
    !hasAdminScope(user, {
      organizationId: tableScope.venue.organizationId,
      venueId: tableScope.venue.id
    })
  ) {
    return NextResponse.json(
      { error: 'Forbidden for requested table scope.' },
      { status: 403 }
    );
  }

  const block = await prisma.tableBlock.create({
    data: {
      tableId: payload.tableId,
      startsAt,
      endsAt,
      reason: payload.reason?.trim() || null
    }
  });

  return NextResponse.json({ block }, { status: 201 });
}
