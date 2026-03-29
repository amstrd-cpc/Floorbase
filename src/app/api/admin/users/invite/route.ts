import { AdminRole } from '@prisma/client';
import { NextResponse } from 'next/server';
import { createInvite } from '@/server/auth/invite';
import { hasAdminScope, requireRole } from '@/server/auth/authorization';
import { prisma } from '@/server/db/prisma/client';

function normalizeRole(value: string): AdminRole | null {
  switch (value) {
    case 'SUPER_ADMIN':
    case 'ORGANIZATION_ADMIN':
    case 'VENUE_MANAGER':
    case 'HOST':
      return value;
    default:
      return null;
  }
}

export async function POST(request: Request) {
  const currentUser = await requireRole(['SUPER_ADMIN', 'ORGANIZATION_ADMIN']);
  const formData = await request.formData();

  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const role = normalizeRole(String(formData.get('role') ?? ''));
  const requestedOrganizationId =
    String(formData.get('organizationId') ?? '') || undefined;
  const requestedVenueId = String(formData.get('venueId') ?? '') || undefined;

  if (!email || !role) {
    return NextResponse.json(
      { error: 'Email and valid role are required.' },
      { status: 400 }
    );
  }

  const isSuperAdmin = currentUser.adminRoles.some(
    (assignment) => assignment.role === 'SUPER_ADMIN'
  );

  if (!isSuperAdmin && role === 'SUPER_ADMIN') {
    return NextResponse.json(
      { error: 'Only super admins can invite super admins.' },
      { status: 403 }
    );
  }

  const organizationId =
    role === 'SUPER_ADMIN'
      ? undefined
      : isSuperAdmin
        ? requestedOrganizationId
        : (currentUser.organizationId ?? requestedOrganizationId);
  const venueId = role === 'SUPER_ADMIN' ? undefined : requestedVenueId;

  if (!organizationId && role !== 'SUPER_ADMIN') {
    return NextResponse.json(
      { error: 'organizationId is required for non-global roles.' },
      { status: 400 }
    );
  }

  if (role === 'SUPER_ADMIN' && (requestedOrganizationId || requestedVenueId)) {
    return NextResponse.json(
      { error: 'SUPER_ADMIN invite cannot include organizationId or venueId.' },
      { status: 400 }
    );
  }

  if (
    organizationId &&
    !hasAdminScope(currentUser, { organizationId, venueId })
  ) {
    return NextResponse.json(
      { error: 'Forbidden for requested invite scope.' },
      { status: 403 }
    );
  }

  if (venueId) {
    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
      select: { organizationId: true }
    });

    if (!venue) {
      return NextResponse.json(
        { error: 'Venue not found for invite.' },
        { status: 404 }
      );
    }

    if (organizationId && venue.organizationId !== organizationId) {
      return NextResponse.json(
        { error: 'venueId must belong to organizationId.' },
        { status: 400 }
      );
    }
  }

  try {
    const invite = await createInvite({
      email,
      role,
      invitedByUserId: currentUser.id,
      organizationId,
      venueId
    });

    return NextResponse.json(invite, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to create invite.'
      },
      { status: 400 }
    );
  }
}
