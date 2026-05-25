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
  if (!isSuperAdmin) {
    // Non-super-admins cannot touch null-org users (e.g. SUPER_ADMINs) and
    // must have scope over the target's organization.
    if (
      !target.organizationId ||
      !hasAdminScope(actor, { organizationId: target.organizationId })
    ) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }
  }

  // Revoke role assignments. Scope to the target org when present; revoke all
  // roles for global (null-org) users so they don't regain access on reactivation.
  const orgId = target.organizationId;
  await prisma.adminRoleAssignment.updateMany({
    where: orgId
      ? { userId: target.id, organizationId: orgId }
      : { userId: target.id },
    data: { isActive: false },
  });

  await prisma.user.update({
    where: { id: target.id },
    data: { isActive: false },
  });

  return NextResponse.json({ ok: true });
}
