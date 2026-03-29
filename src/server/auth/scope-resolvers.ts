import { prisma } from '@/server/db/prisma/client';

export async function getVenueScope(venueId: string) {
  return prisma.venue.findUnique({
    where: { id: venueId },
    select: { id: true, organizationId: true }
  });
}

export async function getAreaScope(areaId: string) {
  return prisma.area.findUnique({
    where: { id: areaId },
    select: { id: true, venue: { select: { id: true, organizationId: true } } }
  });
}

export async function getTableScope(tableId: string) {
  return prisma.table.findUnique({
    where: { id: tableId },
    select: { id: true, venue: { select: { id: true, organizationId: true } } }
  });
}

export async function getReservationScope(reservationId: string) {
  return prisma.reservation.findUnique({
    where: { id: reservationId },
    select: { id: true, organizationId: true, venueId: true }
  });
}
