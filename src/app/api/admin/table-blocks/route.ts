import { NextResponse } from 'next/server';
import { requireRole } from '@/server/auth/authorization';
import { prisma } from '@/server/db/prisma/client';

export async function GET(request: Request) {
  await requireRole(['SUPER_ADMIN', 'ORGANIZATION_ADMIN', 'VENUE_MANAGER', 'HOST']);
  const { searchParams } = new URL(request.url);
  const venueId = searchParams.get('venueId');

  if (!venueId) {
    return NextResponse.json({ error: 'venueId is required.' }, { status: 400 });
  }

  const blocks = await prisma.tableBlock.findMany({
    where: { table: { venueId }, isActive: true },
    include: { table: { select: { id: true, name: true } } },
    orderBy: { startsAt: 'asc' }
  });

  return NextResponse.json({ blocks });
}

export async function POST(request: Request) {
  await requireRole(['SUPER_ADMIN', 'ORGANIZATION_ADMIN', 'VENUE_MANAGER']);
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
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
    return NextResponse.json(
      { error: 'Invalid block window.' },
      { status: 400 }
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
