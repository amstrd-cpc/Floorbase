import { AdminRole } from '@prisma/client';
import { NextResponse } from 'next/server';
import { createInvite } from '@/server/auth/invite';
import { requireRole } from '@/server/auth/authorization';
import { isAdminRole } from '@/server/auth/roles';

export async function POST(request: Request) {
  const currentUser = await requireRole([
    AdminRole.SUPER_ADMIN,
    AdminRole.ORGANIZATION_ADMIN
  ]);
  const formData = await request.formData();

  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const rawRole = String(formData.get('role') ?? '').trim();
  const role = isAdminRole(rawRole) ? rawRole : null;
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
    (assignment) => assignment.role === AdminRole.SUPER_ADMIN
  );

  if (!isSuperAdmin && role === AdminRole.SUPER_ADMIN) {
    return NextResponse.json(
      { error: 'Only super admins can invite super admins.' },
      { status: 403 }
    );
  }

  const organizationId = isSuperAdmin
    ? requestedOrganizationId
    : (currentUser.organizationId ?? requestedOrganizationId);

  if (!organizationId && role !== AdminRole.SUPER_ADMIN) {
    return NextResponse.json(
      { error: 'organizationId is required for non-global roles.' },
      { status: 400 }
    );
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
