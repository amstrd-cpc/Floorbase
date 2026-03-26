import { AdminRole } from '@prisma/client';
import { prisma } from '@/server/db/prisma/client';
import { requireRole } from './authorization';

export async function getAdminContext() {
  const user = await requireRole([
    AdminRole.SUPER_ADMIN,
    AdminRole.ORGANIZATION_ADMIN,
    AdminRole.VENUE_MANAGER,
    AdminRole.HOST
  ]);

  const roles = user.adminRoles as Array<{
    role: AdminRole;
    organizationId: string | null;
    venueId: string | null;
  }>;

  const orgRole =
    roles.find((role) => role.organizationId) ??
    roles.find((role) => role.role === AdminRole.SUPER_ADMIN);

  const organizationId = orgRole?.organizationId;

  const venueRole =
    roles.find((role) => role.venueId) ??
    roles.find((role) => role.organizationId === organizationId);

  let venueId = venueRole?.venueId;

  if (!venueId && organizationId) {
    const firstVenue = await prisma.venue.findFirst({
      where: { organizationId, isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true }
    });
    venueId = firstVenue?.id;
  }

  if (!venueId) {
    const firstVenue = await prisma.venue.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, organizationId: true }
    });
    venueId = firstVenue?.id;
    return {
      user,
      venueId,
      organizationId: organizationId ?? firstVenue?.organizationId
    };
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
