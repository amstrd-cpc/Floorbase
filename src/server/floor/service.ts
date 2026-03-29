import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db/prisma/client';
import { FloorNotFoundError, FloorValidationError } from './errors';
import {
  type CreateAreaInput,
  type CreateTableInput,
  type UpdateAreaInput,
  type UpdateTableInput,
  createAreaSchema,
  createTableSchema,
  listFloorEntitiesSchema,
  updateAreaSchema,
  updateTableSchema
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
    error instanceof FloorValidationError ||
    error instanceof FloorNotFoundError
  ) {
    return error;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return new FloorValidationError(
        'Name or code already exists in this venue.'
      );
    }
  }

  return new FloorValidationError('Invalid floor payload.');
}

async function assertVenue(venueId: string) {
  const venue = await prisma.venue.findFirst({
    where: { id: venueId, isActive: true }
  });
  if (!venue) {
    throw new FloorValidationError('Venue does not exist or is inactive.');
  }
}

async function assertAreaInVenue(input: { areaId: string; venueId: string }) {
  const area = await prisma.area.findFirst({
    where: {
      id: input.areaId,
      venueId: input.venueId
    },
    select: { id: true }
  });

  if (!area) {
    throw new FloorValidationError('Area does not exist in this venue.');
  }
}

function assertTableCapacity(input: {
  capacityMin?: number | null;
  capacityMax: number;
}) {
  if (input.capacityMin && input.capacityMin > input.capacityMax) {
    throw new FloorValidationError('capacityMin cannot exceed capacityMax.');
  }
}

function normalizeCombineGroup(input: {
  canCombine: boolean;
  combineGroup?: string | null;
}) {
  if (!input.canCombine) {
    return null;
  }

  return input.combineGroup ?? null;
}

function assertCombineRule(input: {
  canCombine: boolean;
  combineGroup?: string | null;
}) {
  if (input.combineGroup && !input.canCombine) {
    throw new FloorValidationError(
      'combineGroup can only be set when canCombine is true.'
    );
  }
}

export async function listAreasAndTables(input: { venueId: string }) {
  const parsed = listFloorEntitiesSchema.safeParse(input);
  if (!parsed.success) {
    throw new FloorValidationError(
      'Invalid query params.',
      mapZodErrors(parsed.error.issues)
    );
  }

  await assertVenue(parsed.data.venueId);

  return prisma.area.findMany({
    where: { venueId: parsed.data.venueId },
    include: {
      tables: {
        orderBy: [{ name: 'asc' }]
      }
    },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
  });
}

export async function createArea(payload: CreateAreaInput) {
  try {
    const parsed = createAreaSchema.safeParse(payload);
    if (!parsed.success) {
      throw new FloorValidationError(
        'Area payload validation failed.',
        mapZodErrors(parsed.error.issues)
      );
    }

    await assertVenue(parsed.data.venueId);

    return prisma.area.create({
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

export async function updateArea(input: {
  areaId: string;
  payload: UpdateAreaInput;
}) {
  try {
    const parsed = updateAreaSchema.safeParse(input.payload);
    if (!parsed.success) {
      throw new FloorValidationError(
        'Area payload validation failed.',
        mapZodErrors(parsed.error.issues)
      );
    }

    const current = await prisma.area.findUnique({
      where: { id: input.areaId }
    });
    if (!current) {
      throw new FloorNotFoundError('Area not found.');
    }

    return prisma.area.update({
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

export async function createTable(payload: CreateTableInput) {
  try {
    const parsed = createTableSchema.safeParse(payload);
    if (!parsed.success) {
      throw new FloorValidationError(
        'Table payload validation failed.',
        mapZodErrors(parsed.error.issues)
      );
    }

    await assertVenue(parsed.data.venueId);
    await assertAreaInVenue({
      areaId: parsed.data.areaId,
      venueId: parsed.data.venueId
    });
    assertTableCapacity({
      capacityMin: parsed.data.capacityMin,
      capacityMax: parsed.data.capacityMax
    });
    assertCombineRule({
      canCombine: parsed.data.canCombine ?? false,
      combineGroup: parsed.data.combineGroup
    });

    return prisma.table.create({
      data: {
        venueId: parsed.data.venueId,
        areaId: parsed.data.areaId,
        name: parsed.data.name,
        code: parsed.data.code ?? null,
        shape: parsed.data.shape ?? 'SQUARE',
        tableType: parsed.data.tableType ?? 'STANDARD',
        canCombine: parsed.data.canCombine ?? false,
        combineGroup: normalizeCombineGroup({
          canCombine: parsed.data.canCombine ?? false,
          combineGroup: parsed.data.combineGroup
        }),
        capacityMin: parsed.data.capacityMin ?? null,
        capacityMax: parsed.data.capacityMax,
        isActive: parsed.data.isActive ?? true
      }
    });
  } catch (error) {
    throw toValidationError(error);
  }
}

export async function updateTable(input: {
  tableId: string;
  payload: UpdateTableInput;
}) {
  try {
    const parsed = updateTableSchema.safeParse(input.payload);
    if (!parsed.success) {
      throw new FloorValidationError(
        'Table payload validation failed.',
        mapZodErrors(parsed.error.issues)
      );
    }

    const current = await prisma.table.findUnique({
      where: { id: input.tableId }
    });
    if (!current) {
      throw new FloorNotFoundError('Table not found.');
    }

    if (parsed.data.areaId) {
      await assertAreaInVenue({
        areaId: parsed.data.areaId,
        venueId: current.venueId
      });
    }

    const capacityMin = parsed.data.capacityMin ?? current.capacityMin;
    const capacityMax = parsed.data.capacityMax ?? current.capacityMax;
    const canCombine = parsed.data.canCombine ?? current.canCombine;
    const combineGroup =
      parsed.data.combineGroup === undefined
        ? current.combineGroup
        : parsed.data.combineGroup;

    assertTableCapacity({ capacityMin, capacityMax });
    assertCombineRule({ canCombine, combineGroup });

    return prisma.table.update({
      where: { id: current.id },
      data: {
        areaId: parsed.data.areaId ?? current.areaId,
        name: parsed.data.name ?? current.name,
        code: parsed.data.code === undefined ? current.code : parsed.data.code,
        shape: parsed.data.shape ?? current.shape,
        tableType: parsed.data.tableType ?? current.tableType,
        canCombine,
        combineGroup: normalizeCombineGroup({ canCombine, combineGroup }),
        capacityMin,
        capacityMax,
        isActive: parsed.data.isActive ?? current.isActive
      }
    });
  } catch (error) {
    throw toValidationError(error);
  }
}
