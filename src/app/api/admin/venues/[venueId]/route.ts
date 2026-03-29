import { NextResponse } from 'next/server';
import { hasAdminScope, requireRole } from '@/server/auth/authorization';
import { prisma } from '@/server/db/prisma/client';
import { getVenueScope } from '@/server/auth/scope-resolvers';

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

  const venue = await prisma.venue.update({
    where: { id: params.venueId },
    data: {
      name: payload.name.trim(),
      slug: payload.slug.trim(),
      timezone: payload.timezone.trim(),
      currency: payload.currency.trim().toUpperCase(),
      isActive: payload.isActive ?? true
    }
  });

  return NextResponse.json({ venue });
}
