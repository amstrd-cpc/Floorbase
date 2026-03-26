import { NextResponse } from 'next/server';
import { requireRole } from '@/server/auth/authorization';
import {
  FloorNotFoundError,
  FloorValidationError
} from '@/server/floor/errors';
import { createTable } from '@/server/floor/service';
import { prisma } from '@/server/db/prisma/client';

function toErrorResponse(error: unknown) {
  if (error instanceof FloorValidationError) {
    return NextResponse.json(
      { error: error.message, details: error.details },
      { status: 400 }
    );
  }

  if (error instanceof FloorNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  throw error;
}

export async function GET(request: Request) {
  await requireRole([
    'SUPER_ADMIN',
    'ORGANIZATION_ADMIN',
    'VENUE_MANAGER',
    'HOST'
  ]);

  const venueId = new URL(request.url).searchParams.get('venueId');
  if (!venueId) {
    return NextResponse.json(
      { error: 'venueId query param is required.' },
      { status: 400 }
    );
  }

  try {
    const tables = await prisma.table.findMany({
      where: { venueId },
      include: { area: true },
      orderBy: [{ name: 'asc' }]
    });

    return NextResponse.json({ tables });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  await requireRole(['SUPER_ADMIN', 'ORGANIZATION_ADMIN', 'VENUE_MANAGER']);

  const payload = await request.json();

  try {
    const table = await createTable(payload);
    return NextResponse.json({ table }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
