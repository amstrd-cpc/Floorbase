import { AdminRole } from '@prisma/client';
import { NextResponse } from 'next/server';
import { createInvite } from '@/server/auth/invite';
import { requireRole } from '@/server/auth/authorization';

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

  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const role = normalizeRole(String(formData.get('role') ?? ''));
  const requestedOrganizationId = String(formData.get('organizationId') ?? '') || undefined;
  const requestedVenueId = String(formData.get('venueId') ?? '') || undefined;

  if (!email || !role) {
    return NextResponse.json({ error: 'Email and valid role are required.' }, { status: 400 });
  }

  const isSuperAdmin = currentUser.adminRoles.some((assignment) => assignment.role === 'SUPER_ADMIN');

  if (!isSuperAdmin && role === 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Only super admins can invite super admins.' }, { status: 403 });
  }

  const organizationId = isSuperAdmin ? requestedOrganizationId : currentUser.organizationId ?? requestedOrganizationId;

  if (!organizationId && role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'organizationId is required for non-global roles.' }, { status: 400 });
  }

  const invite = await createInvite({
    email,
    role,
    invitedByUserId: currentUser.id,
    organizationId,
    venueId: requestedVenueId
  });

  return NextResponse.json(invite, { status: 201 });
}
