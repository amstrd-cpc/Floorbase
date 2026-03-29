import { prisma } from '@/server/db/prisma/client';
import { requireRole } from './authorization';

export async function getAdminContext() {
  const user = await requireRole([
    'SUPER_ADMIN',
    'ORGANIZATION_ADMIN',
    'VENUE_MANAGER',
    'HOST'
  ]);

  const roles = user.adminRoles as Array<{
    role: string;
    organizationId: string | null;
    venueId: string | null;
  }>;

  const orgRole =
    roles.find((role) => role.organizationId) ??
    roles.find((role) => role.role === 'SUPER_ADMIN');

  const organizationId = orgRole?.organizationId;

  const venueRole =
    roles.find((role) => role.venueId) ??
    roles.find((role) => role.organizationId === organizationId);

  const venueId = venueRole?.venueId;

  if (!organizationId || !venueId) {
    throw new Error('Unable to resolve scoped admin context for current user.');
  }

  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    select: { organizationId: true }
  });

  return {
    user,
    venueId,
    organizationId: organizationId ?? venue?.organizationId
  };
}
