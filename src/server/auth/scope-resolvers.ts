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

export async function getMenuCategoryScope(categoryId: string) {
  return prisma.menuCategory.findUnique({
    where: { id: categoryId },
    select: { id: true, venue: { select: { id: true, organizationId: true } } }
  });
}

export async function getMenuItemScope(itemId: string) {
  return prisma.menuItem.findUnique({
    where: { id: itemId },
    select: { id: true, venue: { select: { id: true, organizationId: true } } }
  });
}

export async function getOrderScope(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, organizationId: true, venueId: true }
  });
}

export async function getOrderLineScope(lineId: string) {
  return prisma.orderLine.findUnique({
    where: { id: lineId },
    select: {
      id: true,
      order: { select: { id: true, organizationId: true, venueId: true } }
    }
  });
}

export async function getOrderPaymentScope(orderPaymentId: string) {
  return prisma.orderPayment.findUnique({
    where: { id: orderPaymentId },
    select: {
      id: true,
      order: { select: { id: true, organizationId: true, venueId: true } }
    }
  });
}
