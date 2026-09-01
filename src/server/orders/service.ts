import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db/prisma/client';
import { InventoryError } from '@/server/inventory/errors';
import { reserveStock, releaseStock } from '@/server/inventory/service';
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
  if (
    error instanceof OrderValidationError ||
    error instanceof OrderNotFoundError
  ) {
    return error;
  }

  if (error instanceof InventoryError) {
    return new OrderValidationError(error.message);
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2025'
  ) {
    return new OrderNotFoundError();
  }

  return new OrderValidationError('Invalid order payload.');
}

export function computeOrderTotalMinor(
  lines: Array<{ priceMinorSnapshot: number; quantity: number }>
) {
  return lines.reduce(
    (sum, line) => sum + line.priceMinorSnapshot * line.quantity,
    0
  );
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

async function assertReservationInVenue(input: {
  reservationId: string;
  venueId: string;
}) {
  const reservation = await prisma.reservation.findFirst({
    where: { id: input.reservationId, venueId: input.venueId },
    select: { id: true }
  });
  if (!reservation) {
    throw new OrderValidationError('Reservation does not exist in this venue.');
  }
}

// Serializes concurrent mutations of the same order (add/update/remove line,
// close, cancel) so the "is it still OPEN" check inside a transaction can't
// be raced by another mutation that committed in the gap between a plain
// read and $transaction starting. Same pattern as reservations'
// lockTablesForBooking.
export async function lockOrderForMutation(
  tx: Prisma.TransactionClient,
  orderId: string
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${orderId}))`;
}

async function getOpenOrderOrThrowTx(
  tx: Prisma.TransactionClient,
  orderId: string
) {
  const order = await tx.order.findUnique({ where: { id: orderId } });
  if (!order) {
    throw new OrderNotFoundError();
  }
  if (order.status !== 'OPEN') {
    throw new OrderValidationError('Order is not open.', {
      status: order.status
    });
  }
  return order;
}

const orderWithLines = {
  include: { lines: { orderBy: { createdAt: 'asc' as const } } }
} satisfies Prisma.OrderDefaultArgs;

export async function listOrders(input: { venueId: string; status?: string }) {
  const parsed = listOrdersSchema.safeParse(input);
  if (!parsed.success) {
    throw new OrderValidationError(
      'Invalid query params.',
      mapZodErrors(parsed.error.issues)
    );
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
      await assertTableInVenue({
        tableId: parsed.data.tableId,
        venueId: parsed.data.venueId
      });
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

    // Existence-only pre-read, just to scope the menu item lookup to the
    // right venue - not authoritative for order state. The real OPEN check
    // happens inside the locked transaction below.
    const orderRef = await prisma.order.findUnique({
      where: { id: input.orderId },
      select: { id: true, venueId: true }
    });
    if (!orderRef) {
      throw new OrderNotFoundError();
    }

    const menuItem = await prisma.menuItem.findFirst({
      where: {
        id: parsed.data.menuItemId,
        venueId: orderRef.venueId,
        isActive: true
      },
      select: { id: true, name: true, priceMinor: true, trackInventory: true }
    });
    if (!menuItem) {
      throw new OrderValidationError(
        'Menu item does not exist or is inactive in this venue.'
      );
    }

    const quantity = parsed.data.quantity ?? 1;

    await prisma.$transaction(async (tx) => {
      await lockOrderForMutation(tx, orderRef.id);
      await getOpenOrderOrThrowTx(tx, orderRef.id);

      const reserved = await reserveStock(tx, {
        menuItemId: menuItem.id,
        trackInventory: menuItem.trackInventory,
        quantity
      });

      await tx.orderLine.create({
        data: {
          orderId: orderRef.id,
          menuItemId: menuItem.id,
          nameSnapshot: menuItem.name,
          priceMinorSnapshot: menuItem.priceMinor,
          quantity,
          notes: parsed.data.notes ?? null,
          stockReserved: reserved
        }
      });
    });

    return getOrder({ orderId: orderRef.id });
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
      select: {
        id: true,
        orderId: true,
        menuItemId: true,
        quantity: true,
        stockReserved: true
      }
    });
    if (!line) {
      throw new OrderNotFoundError('Order line not found.');
    }

    await prisma.$transaction(async (tx) => {
      await lockOrderForMutation(tx, line.orderId);
      await getOpenOrderOrThrowTx(tx, line.orderId);

      if (
        line.stockReserved &&
        line.menuItemId &&
        parsed.data.quantity !== undefined &&
        parsed.data.quantity !== line.quantity
      ) {
        const delta = parsed.data.quantity - line.quantity;
        if (delta > 0) {
          await reserveStock(tx, {
            menuItemId: line.menuItemId,
            trackInventory: true,
            quantity: delta
          });
        } else {
          await releaseStock(tx, {
            menuItemId: line.menuItemId,
            wasReserved: true,
            quantity: -delta
          });
        }
      }

      await tx.orderLine.update({
        where: { id: line.id },
        data: {
          quantity: parsed.data.quantity,
          notes: parsed.data.notes,
          kitchenStatus: parsed.data.kitchenStatus
        }
      });
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
      select: {
        id: true,
        orderId: true,
        menuItemId: true,
        quantity: true,
        stockReserved: true
      }
    });
    if (!line) {
      throw new OrderNotFoundError('Order line not found.');
    }

    await prisma.$transaction(async (tx) => {
      await lockOrderForMutation(tx, line.orderId);
      await getOpenOrderOrThrowTx(tx, line.orderId);

      if (line.menuItemId) {
        await releaseStock(tx, {
          menuItemId: line.menuItemId,
          wasReserved: line.stockReserved,
          quantity: line.quantity
        });
      }
      await tx.orderLine.delete({ where: { id: line.id } });
    });

    return getOrder({ orderId: line.orderId });
  } catch (error) {
    throw toValidationError(error);
  }
}

export async function closeOrder(input: { orderId: string }) {
  try {
    return await prisma.$transaction(async (tx) => {
      await lockOrderForMutation(tx, input.orderId);
      await getOpenOrderOrThrowTx(tx, input.orderId);

      return tx.order.update({
        where: { id: input.orderId },
        data: { status: 'CLOSED', closedAt: new Date() },
        ...orderWithLines
      });
    });
  } catch (error) {
    throw toValidationError(error);
  }
}

export async function cancelOrder(input: { orderId: string }) {
  try {
    return await prisma.$transaction(async (tx) => {
      await lockOrderForMutation(tx, input.orderId);
      await getOpenOrderOrThrowTx(tx, input.orderId);

      // Read the stock-reserved lines from inside the same locked
      // transaction, not before it starts - otherwise a concurrent
      // addOrderLine that reserves stock and commits in that gap would
      // never have its line's stock released here (it's CANCELLED and
      // permanently un-editable the moment this transaction commits).
      const lines = await tx.orderLine.findMany({
        where: { orderId: input.orderId, stockReserved: true },
        select: { menuItemId: true, quantity: true }
      });

      for (const line of lines) {
        if (line.menuItemId) {
          await releaseStock(tx, {
            menuItemId: line.menuItemId,
            wasReserved: true,
            quantity: line.quantity
          });
        }
      }

      return tx.order.update({
        where: { id: input.orderId },
        data: { status: 'CANCELLED', closedAt: new Date() },
        ...orderWithLines
      });
    });
  } catch (error) {
    throw toValidationError(error);
  }
}
