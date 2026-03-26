import { prisma } from '@/server/db/prisma/client';
import { requireRole } from './authorization';

export async function getAdminContext() {
  const user = await requireRole([
    'SUPER_ADMIN',
    'ORGANIZATION_ADMIN',
    'VENUE_MANAGER',
    'HOST'
  ]);

  const roles = user.adminRoles as Array<{ role: string; organizationId: string | null; venueId: string | null }>

  const orgRole =
    roles.find((role) => role.organizationId) ??
    roles.find((role) => role.role === 'SUPER_ADMIN');

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
