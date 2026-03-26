import { NextResponse } from 'next/server';
import { requireRole } from '@/server/auth/authorization';
import {
  FloorNotFoundError,
  FloorValidationError
} from '@/server/floor/errors';
import { updateTable } from '@/server/floor/service';

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

export async function PUT(
  request: Request,
  { params }: { params: { tableId: string } }
) {
  await requireRole(['SUPER_ADMIN', 'ORGANIZATION_ADMIN', 'VENUE_MANAGER']);

  const payload = await request.json();

  try {
    const table = await updateTable({ tableId: params.tableId, payload });
    return NextResponse.json({ table });
  } catch (error) {
    return toErrorResponse(error);
  }
}
