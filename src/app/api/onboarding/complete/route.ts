import { NextResponse } from 'next/server';
import { requireRole } from '@/server/auth/authorization';
import { getAdminContext } from '@/server/auth/admin-context';
import { prisma } from '@/server/db/prisma/client';

export async function POST() {
  await requireRole(['ORGANIZATION_ADMIN']);
  const { organizationId } = await getAdminContext();

  await prisma.organization.update({
    where: { id: organizationId },
    data: { onboardingComplete: true }
  });

  return NextResponse.json({ ok: true });
}
