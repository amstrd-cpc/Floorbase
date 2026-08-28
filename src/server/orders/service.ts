import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db/prisma/client';
import { OrderNotFoundError, OrderValidationError } from './errors';
import {
  type AddOrderLineInput,
  type CreateOrderInput,
  type UpdateOrderLineInput,
  addOrderLineSchema,
  createOrderSchema,
  listOrdersSchema,
  updateOrderLineSchema
} from './validation';

function mapZodErrors(
  issues: Array<{ path: Array<string | number>; message: string }>
) {
  return Object.fromEntries(
    issues.map((issue) => [issue.path.join('.') || 'root', issue.message])
  );
}

function toValidationError(error: unknown) {
  if (error instanceof OrderValidationError || error instanceof OrderNotFoundError) {
    return error;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
    return new OrderNotFoundError();
  }

  return new OrderValidationError('Invalid order payload.');
}

export function computeOrderTotalMinor(lines: Array<{ priceMinorSnapshot: number; quantity: number }>) {
  return lines.reduce((sum, line) => sum + line.priceMinorSnapshot * line.quantity, 0);
}

async function assertVenue(venueId: string) {
  const venue = await prisma.venue.findFirst({
    where: { id: venueId, isActive: true },
    select: { id: true, organizationId: true }
  });
  if (!venue) {
    throw new OrderValidationError('Venue does not exist or is inactive.');
  }
  return venue;
}

async function assertTableInVenue(input: { tableId: string; venueId: string }) {
  const table = await prisma.table.findFirst({
    where: { id: input.tableId, venueId: input.venueId },
    select: { id: true }
  });
  if (!table) {
    throw new OrderValidationError('Table does not exist in this venue.');
  }
}

async function assertReservationInVenue(input: { reservationId: string; venueId: string }) {
  const reservation = await prisma.reservation.findFirst({
    where: { id: input.reservationId, venueId: input.venueId },
    select: { id: true }
  });
  if (!reservation) {
    throw new OrderValidationError('Reservation does not exist in this venue.');
  }
}

async function getOpenOrderOrThrow(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) {
    throw new OrderNotFoundError();
  }
  if (order.status !== 'OPEN') {
    throw new OrderValidationError('Order is not open.', { status: order.status });
  }
  return order;
}

const orderWithLines = {
  include: { lines: { orderBy: { createdAt: 'asc' as const } } }
} satisfies Prisma.OrderDefaultArgs;

export async function listOrders(input: { venueId: string; status?: string }) {
  const parsed = listOrdersSchema.safeParse(input);
  if (!parsed.success) {
    throw new OrderValidationError('Invalid query params.', mapZodErrors(parsed.error.issues));
  }

  await assertVenue(parsed.data.venueId);

  return prisma.order.findMany({
    where: {
      venueId: parsed.data.venueId,
      status: parsed.data.status
    },
    ...orderWithLines,
    orderBy: { createdAt: 'desc' }
  });
}

export async function getOrder(input: { orderId: string }) {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    ...orderWithLines
  });
  if (!order) {
    throw new OrderNotFoundError();
  }
  return order;
}

export async function createOrder(input: {
  payload: CreateOrderInput;
  actorUserId?: string;
}) {
  try {
    const parsed = createOrderSchema.safeParse(input.payload);
    if (!parsed.success) {
      throw new OrderValidationError(
        'Order payload validation failed.',
        mapZodErrors(parsed.error.issues)
      );
    }

    const venue = await assertVenue(parsed.data.venueId);

    if (parsed.data.tableId) {
      await assertTableInVenue({ tableId: parsed.data.tableId, venueId: parsed.data.venueId });
    }
    if (parsed.data.reservationId) {
      await assertReservationInVenue({
        reservationId: parsed.data.reservationId,
        venueId: parsed.data.venueId
      });
    }

    return await prisma.order.create({
      data: {
        organizationId: venue.organizationId,
        venueId: parsed.data.venueId,
        tableId: parsed.data.tableId ?? null,
        reservationId: parsed.data.reservationId ?? null,
        notes: parsed.data.notes ?? null,
        createdByUserId: input.actorUserId ?? null
      },
      ...orderWithLines
    });
  } catch (error) {
    throw toValidationError(error);
  }
}

export async function addOrderLine(input: {
  orderId: string;
  payload: AddOrderLineInput;
}) {
  try {
    const parsed = addOrderLineSchema.safeParse(input.payload);
    if (!parsed.success) {
      throw new OrderValidationError(
        'Order line payload validation failed.',
        mapZodErrors(parsed.error.issues)
      );
    }

    const order = await getOpenOrderOrThrow(input.orderId);

    const menuItem = await prisma.menuItem.findFirst({
      where: { id: parsed.data.menuItemId, venueId: order.venueId, isActive: true },
      select: { id: true, name: true, priceMinor: true }
    });
    if (!menuItem) {
      throw new OrderValidationError('Menu item does not exist or is inactive in this venue.');
    }

    await prisma.orderLine.create({
      data: {
        orderId: order.id,
        menuItemId: menuItem.id,
        nameSnapshot: menuItem.name,
        priceMinorSnapshot: menuItem.priceMinor,
        quantity: parsed.data.quantity ?? 1,
        notes: parsed.data.notes ?? null
      }
    });

    return getOrder({ orderId: order.id });
  } catch (error) {
    throw toValidationError(error);
  }
}

export async function updateOrderLine(input: {
  lineId: string;
  payload: UpdateOrderLineInput;
}) {
  try {
    const parsed = updateOrderLineSchema.safeParse(input.payload);
    if (!parsed.success) {
      throw new OrderValidationError(
        'Order line payload validation failed.',
        mapZodErrors(parsed.error.issues)
      );
    }

    const line = await prisma.orderLine.findUnique({
      where: { id: input.lineId },
      select: { id: true, orderId: true }
    });
    if (!line) {
      throw new OrderNotFoundError('Order line not found.');
    }

    await getOpenOrderOrThrow(line.orderId);

    await prisma.orderLine.update({
      where: { id: line.id },
      data: {
        quantity: parsed.data.quantity,
        notes: parsed.data.notes
      }
    });

    return getOrder({ orderId: line.orderId });
  } catch (error) {
    throw toValidationError(error);
  }
}

export async function removeOrderLine(input: { lineId: string }) {
  try {
    const line = await prisma.orderLine.findUnique({
      where: { id: input.lineId },
      select: { id: true, orderId: true }
    });
    if (!line) {
      throw new OrderNotFoundError('Order line not found.');
    }

    await getOpenOrderOrThrow(line.orderId);

    await prisma.orderLine.delete({ where: { id: line.id } });

    return getOrder({ orderId: line.orderId });
  } catch (error) {
    throw toValidationError(error);
  }
}

export async function closeOrder(input: { orderId: string }) {
  try {
    await getOpenOrderOrThrow(input.orderId);

    return await prisma.order.update({
      where: { id: input.orderId },
      data: { status: 'CLOSED', closedAt: new Date() },
      ...orderWithLines
    });
  } catch (error) {
    throw toValidationError(error);
  }
}

export async function cancelOrder(input: { orderId: string }) {
  try {
    await getOpenOrderOrThrow(input.orderId);

    return await prisma.order.update({
      where: { id: input.orderId },
      data: { status: 'CANCELLED', closedAt: new Date() },
      ...orderWithLines
    });
  } catch (error) {
    throw toValidationError(error);
  }
}
