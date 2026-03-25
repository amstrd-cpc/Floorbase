import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/prisma/client';
import { requireRole } from '@/server/auth/authorization';

export async function POST(request: Request) {
  await requireRole(['SUPER_ADMIN', 'ORGANIZATION_ADMIN', 'VENUE_MANAGER']);

  const payload = (await request.json()) as {
    reservationId?: string;
    reservationStatusId?: string;
  };

  if (!payload.reservationId || !payload.reservationStatusId) {
    return NextResponse.json({ error: 'reservationId and reservationStatusId are required.' }, { status: 400 });
  }

  const updated = await prisma.reservation.update({
    where: { id: payload.reservationId },
    data: { reservationStatusId: payload.reservationStatusId },
    select: { id: true, reservationStatusId: true }
  });

  return NextResponse.json(updated);
}
