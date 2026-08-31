import { prisma } from '@/server/db/prisma/client';
import { InventoryError } from './errors';
import {
  type AdjustStockInput,
  adjustStockSchema,
  listLowStockSchema
} from './validation';

type DbClient = Pick<typeof prisma, 'menuItem'>;

// Called from orders/service.ts when a line is added/removed/quantity-changed,
// inside the same transaction as the OrderLine write so a failed line write
// can't leave stock decremented with no line to show for it.
export async function reserveStock(
  client: DbClient,
  input: { menuItemId: string; trackInventory: boolean; quantity: number }
): Promise<boolean> {
  if (!input.trackInventory || input.quantity <= 0) {
    return false;
  }

  const result = await client.menuItem.updateMany({
    where: { id: input.menuItemId, stockQty: { gte: input.quantity } },
    data: { stockQty: { decrement: input.quantity } }
  });

  if (result.count === 0) {
    throw new InventoryError('Insufficient stock for this item.', 409);
  }
  return true;
}

// wasReserved reflects OrderLine.stockReserved, not the item's current
// trackInventory flag — that can be toggled after the line was created, and
// release must match what reserveStock actually did, not the current config.
export async function releaseStock(
  client: DbClient,
  input: { menuItemId: string; wasReserved: boolean; quantity: number }
) {
  if (!input.wasReserved || input.quantity <= 0) {
    return;
  }

  await client.menuItem.update({
    where: { id: input.menuItemId },
    data: { stockQty: { increment: input.quantity } }
  });
}

export async function adjustMenuItemStock(input: {
  menuItemId: string;
  payload: AdjustStockInput;
}) {
  const parsed = adjustStockSchema.safeParse(input.payload);
  if (!parsed.success) {
    throw new InventoryError(
      'quantityDelta is required and must be a non-zero integer.'
    );
  }

  const item = await prisma.menuItem.findUnique({
    where: { id: input.menuItemId },
    select: { id: true, trackInventory: true }
  });
  if (!item) {
    throw new InventoryError('Menu item not found.', 404);
  }
  if (!item.trackInventory) {
    throw new InventoryError('This item does not track inventory.', 409);
  }

  const { quantityDelta } = parsed.data;
  const result = await prisma.menuItem.updateMany({
    where:
      quantityDelta < 0
        ? { id: input.menuItemId, stockQty: { gte: -quantityDelta } }
        : { id: input.menuItemId },
    data: { stockQty: { increment: quantityDelta } }
  });

  if (result.count === 0) {
    throw new InventoryError('Adjustment would take stock below zero.', 409);
  }

  return prisma.menuItem.findUniqueOrThrow({ where: { id: input.menuItemId } });
}

export async function listLowStockItems(input: { venueId: string }) {
  const parsed = listLowStockSchema.safeParse(input);
  if (!parsed.success) {
    throw new InventoryError('Invalid query params.');
  }

  const items = await prisma.menuItem.findMany({
    where: { venueId: parsed.data.venueId, trackInventory: true },
    orderBy: { name: 'asc' }
  });

  return items.filter((item) => item.stockQty <= item.lowStockThreshold);
}
