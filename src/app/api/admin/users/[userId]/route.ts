import { NextResponse } from 'next/server';
import { hasAdminScope, requireRole } from '@/server/auth/authorization';
import { prisma } from '@/server/db/prisma/client';

export async function DELETE(
  _request: Request,
  { params }: { params: { userId: string } }
) {
  const actor = await requireRole(['SUPER_ADMIN', 'ORGANIZATION_ADMIN']);

  const target = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { id: true, organizationId: true },
  });

  if (!target) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 });
  }

  if (target.id === actor.id) {
    return NextResponse.json({ error: 'Cannot revoke your own access.' }, { status: 400 });
  }

  const isSuperAdmin = actor.adminRoles.some((r: { role: string }) => r.role === 'SUPER_ADMIN');
  if (!isSuperAdmin && target.organizationId) {
    if (!hasAdminScope(actor, { organizationId: target.organizationId })) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }
  }

  // Deactivate all role assignments for this user in the org.
  const orgId = target.organizationId;
  if (orgId) {
    await prisma.adminRoleAssignment.updateMany({
      where: { userId: target.id, organizationId: orgId },
      data: { isActive: false },
    });
  }

  await prisma.user.update({
    where: { id: target.id },
    data: { isActive: false },
  });

  return NextResponse.json({ ok: true });
}
