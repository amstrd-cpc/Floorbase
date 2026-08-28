import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db/prisma/client';
import { MenuNotFoundError, MenuValidationError } from './errors';
import {
  type CreateMenuCategoryInput,
  type CreateMenuItemInput,
  type UpdateMenuCategoryInput,
  type UpdateMenuItemInput,
  createMenuCategorySchema,
  createMenuItemSchema,
  listMenuSchema,
  updateMenuCategorySchema,
  updateMenuItemSchema
} from './validation';

function mapZodErrors(
  issues: Array<{ path: Array<string | number>; message: string }>
) {
  return Object.fromEntries(
    issues.map((issue) => [issue.path.join('.') || 'root', issue.message])
  );
}

function toValidationError(error: unknown) {
  if (error instanceof MenuValidationError || error instanceof MenuNotFoundError) {
    return error;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return new MenuValidationError('Name already exists in this venue.');
    }
    if (error.code === 'P2025') {
      return new MenuNotFoundError();
    }
  }

  return new MenuValidationError('Invalid menu payload.');
}

async function assertVenue(venueId: string) {
  const venue = await prisma.venue.findFirst({
    where: { id: venueId, isActive: true }
  });
  if (!venue) {
    throw new MenuValidationError('Venue does not exist or is inactive.');
  }
}

async function assertCategoryInVenue(input: { categoryId: string; venueId: string }) {
  const category = await prisma.menuCategory.findFirst({
    where: { id: input.categoryId, venueId: input.venueId },
    select: { id: true }
  });

  if (!category) {
    throw new MenuValidationError('Category does not exist in this venue.');
  }
}

export async function listMenu(input: { venueId: string }) {
  const parsed = listMenuSchema.safeParse(input);
  if (!parsed.success) {
    throw new MenuValidationError('Invalid query params.', mapZodErrors(parsed.error.issues));
  }

  await assertVenue(parsed.data.venueId);

  return prisma.menuCategory.findMany({
    where: { venueId: parsed.data.venueId },
    include: {
      items: {
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
      }
    },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
  });
}

export async function createMenuCategory(payload: CreateMenuCategoryInput) {
  try {
    const parsed = createMenuCategorySchema.safeParse(payload);
    if (!parsed.success) {
      throw new MenuValidationError(
        'Category payload validation failed.',
        mapZodErrors(parsed.error.issues)
      );
    }

    await assertVenue(parsed.data.venueId);

    return await prisma.menuCategory.create({
      data: {
        venueId: parsed.data.venueId,
        name: parsed.data.name,
        sortOrder: parsed.data.sortOrder ?? 0,
        isActive: parsed.data.isActive ?? true
      }
    });
  } catch (error) {
    throw toValidationError(error);
  }
}

export async function updateMenuCategory(input: {
  categoryId: string;
  payload: UpdateMenuCategoryInput;
}) {
  try {
    const parsed = updateMenuCategorySchema.safeParse(input.payload);
    if (!parsed.success) {
      throw new MenuValidationError(
        'Category payload validation failed.',
        mapZodErrors(parsed.error.issues)
      );
    }

    const current = await prisma.menuCategory.findUnique({
      where: { id: input.categoryId }
    });
    if (!current) {
      throw new MenuNotFoundError('Category not found.');
    }

    return await prisma.menuCategory.update({
      where: { id: current.id },
      data: {
        name: parsed.data.name ?? current.name,
        sortOrder: parsed.data.sortOrder ?? current.sortOrder,
        isActive: parsed.data.isActive ?? current.isActive
      }
    });
  } catch (error) {
    throw toValidationError(error);
  }
}

export async function deleteMenuCategory(input: { categoryId: string }) {
  try {
    await prisma.menuCategory.delete({
      where: { id: input.categoryId }
    });
  } catch (error) {
    throw toValidationError(error);
  }
}

export async function createMenuItem(payload: CreateMenuItemInput) {
  try {
    const parsed = createMenuItemSchema.safeParse(payload);
    if (!parsed.success) {
      throw new MenuValidationError(
        'Item payload validation failed.',
        mapZodErrors(parsed.error.issues)
      );
    }

    await assertVenue(parsed.data.venueId);
    await assertCategoryInVenue({
      categoryId: parsed.data.categoryId,
      venueId: parsed.data.venueId
    });

    return await prisma.menuItem.create({
      data: {
        venueId: parsed.data.venueId,
        categoryId: parsed.data.categoryId,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        priceMinor: parsed.data.priceMinor,
        sortOrder: parsed.data.sortOrder ?? 0,
        isActive: parsed.data.isActive ?? true
      }
    });
  } catch (error) {
    throw toValidationError(error);
  }
}

export async function updateMenuItem(input: {
  itemId: string;
  payload: UpdateMenuItemInput;
}) {
  try {
    const parsed = updateMenuItemSchema.safeParse(input.payload);
    if (!parsed.success) {
      throw new MenuValidationError(
        'Item payload validation failed.',
        mapZodErrors(parsed.error.issues)
      );
    }

    const current = await prisma.menuItem.findUnique({
      where: { id: input.itemId }
    });
    if (!current) {
      throw new MenuNotFoundError('Item not found.');
    }

    if (parsed.data.categoryId) {
      await assertCategoryInVenue({
        categoryId: parsed.data.categoryId,
        venueId: current.venueId
      });
    }

    return await prisma.menuItem.update({
      where: { id: current.id },
      data: {
        categoryId: parsed.data.categoryId ?? current.categoryId,
        name: parsed.data.name ?? current.name,
        description:
          parsed.data.description === undefined ? current.description : parsed.data.description,
        priceMinor: parsed.data.priceMinor ?? current.priceMinor,
        sortOrder: parsed.data.sortOrder ?? current.sortOrder,
        isActive: parsed.data.isActive ?? current.isActive
      }
    });
  } catch (error) {
    throw toValidationError(error);
  }
}

export async function deleteMenuItem(input: { itemId: string }) {
  try {
    await prisma.menuItem.delete({
      where: { id: input.itemId }
    });
  } catch (error) {
    throw toValidationError(error);
  }
}
