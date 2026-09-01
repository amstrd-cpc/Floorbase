import { z } from 'zod';

export const listOrdersSchema = z
  .object({
    venueId: z.string().cuid(),
    status: z.enum(['OPEN', 'CLOSED', 'CANCELLED']).optional()
  })
  .strict();

export const createOrderSchema = z
  .object({
    venueId: z.string().cuid(),
    tableId: z.string().cuid().nullable().optional(),
    reservationId: z.string().cuid().nullable().optional(),
    notes: z.string().trim().max(500).nullable().optional()
  })
  .strict();

export const addOrderLineSchema = z
  .object({
    menuItemId: z.string().cuid(),
    quantity: z.number().int().min(1).max(50).optional(),
    notes: z.string().trim().max(300).nullable().optional()
  })
  .strict();

export const updateOrderLineSchema = z
  .object({
    quantity: z.number().int().min(1).max(50).optional(),
    notes: z.string().trim().max(300).nullable().optional(),
    kitchenStatus: z.enum(['PENDING', 'READY']).optional()
  })
  .strict();

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type AddOrderLineInput = z.infer<typeof addOrderLineSchema>;
export type UpdateOrderLineInput = z.infer<typeof updateOrderLineSchema>;
