import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireRole } from '@/server/auth/authorization';
import { prisma } from '@/server/db/prisma/client';

const VENUE_COOKIE = 'floorbase_venue';

export async function POST(request: Request) {
  const user = await requireRole(['SUPER_ADMIN', 'ORGANIZATION_ADMIN', 'VENUE_MANAGER', 'HOST']);

  const { venueId } = (await request.json()) as { venueId?: string };
  if (!venueId || typeof venueId !== 'string') {
    return NextResponse.json({ error: 'venueId is required.' }, { status: 400 });
  }

  const isSuperAdmin = user.adminRoles.some((r: { role: string }) => r.role === 'SUPER_ADMIN');

  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    select: { id: true, organizationId: true, isActive: true },
  });

  if (!venue || !venue.isActive) {
    return NextResponse.json({ error: 'Venue not found.' }, { status: 404 });
  }

  if (!isSuperAdmin) {
    const orgIds = Array.from(
      new Set(
        (user.adminRoles as { organizationId: string | null }[])
          .map((r) => r.organizationId)
          .filter((id): id is string => Boolean(id))
      )
    );
    if (!orgIds.includes(venue.organizationId)) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }
  }

  const cookieStore = await cookies();
  cookieStore.set(VENUE_COOKIE, venueId, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/admin',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return NextResponse.json({ ok: true });
}
