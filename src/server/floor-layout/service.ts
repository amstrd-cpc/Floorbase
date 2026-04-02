import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db/prisma/client';
import { FloorNotFoundError, FloorValidationError } from '@/server/floor/errors';
import { saveFloorLayoutSchema } from './validation';
import type { FloorLayoutDto } from '@/lib/floor-layout/types';

function toError(error: unknown) {
  if (error instanceof FloorValidationError || error instanceof FloorNotFoundError) {
    return error;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return new FloorValidationError('Layout persistence failed.');
  }

  return new FloorValidationError('Invalid layout payload.');
}

type LayoutWithEntities = Prisma.FloorLayoutGetPayload<{
  include: { areas: true; tables: true };
}>;

function mapLayout(layout: LayoutWithEntities): FloorLayoutDto {
  return {
    ...layout,
    updatedAt: layout.updatedAt.toISOString(),
    tables: layout.tables.map((table) => ({
      ...table,
      combinableMeta: table.combinableMeta
    }))
  };
}

function defaultTablePlacement(index: number, grid: number) {
  const columns = 8;
  const spacing = grid * 5;
  return {
    x: grid + (index % columns) * spacing,
    y: grid + Math.floor(index / columns) * spacing,
    width: grid * 4,
    height: grid * 4
  };
}

async function createInitialDraft(venueId: string) {
  const [areas, tables] = await Promise.all([
    prisma.area.findMany({ where: { venueId }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    prisma.table.findMany({ where: { venueId }, orderBy: { name: 'asc' } })
  ]);

  const layout = await prisma.floorLayout.create({
    data: {
      venueId,
      status: 'DRAFT',
      version: 1,
      isCurrent: true,
      name: 'Draft Layout',
      areas: {
        create: areas.map((area) => ({
          areaId: area.id,
          name: area.name,
          sortOrder: area.sortOrder,
          isActive: area.isActive
        }))
      }
    },
    include: { areas: true }
  });

  const areaByDomainId = new Map(layout.areas.map((area) => [area.areaId, area.id]));

  if (tables.length > 0) {
    await prisma.floorLayoutTable.createMany({
      data: tables.map((table, index) => {
        const placement = defaultTablePlacement(index, layout.gridSize);
        return {
          floorLayoutId: layout.id,
          floorLayoutAreaId: areaByDomainId.get(table.areaId) ?? null,
          tableId: table.id,
          label: table.name,
          capacityMin: table.capacityMin,
          capacityMax: table.capacityMax,
          shape: table.shape,
          x: placement.x,
          y: placement.y,
          width: placement.width,
          height: placement.height,
          rotation: 0,
          isActive: table.isActive,
          combinableMeta: table.canCombine
            ? ({ combineGroup: table.combineGroup } as Prisma.InputJsonValue)
            : Prisma.JsonNull
        };
      })
    });
  }

  return prisma.floorLayout.findUniqueOrThrow({
    where: { id: layout.id },
    include: { areas: { orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }, tables: true }
  });
}

export async function getOrCreateDraftLayout(venueId: string) {
  const venue = await prisma.venue.findFirst({ where: { id: venueId, isActive: true } });
  if (!venue) {
    throw new FloorValidationError('Venue does not exist or is inactive.');
  }

  let layout = await prisma.floorLayout.findFirst({
    where: { venueId, status: 'DRAFT', isCurrent: true },
    include: { areas: { orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }, tables: true }
  });

  if (!layout) {
    layout = await createInitialDraft(venueId);
  }

  return mapLayout(layout);
}

export async function getPublishedLayout(venueId: string) {
  const layout = await prisma.floorLayout.findFirst({
    where: { venueId, status: 'PUBLISHED', isCurrent: true },
    include: { areas: { orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }, tables: true }
  });

  if (!layout) return null;
  return mapLayout(layout);
}

export async function saveDraftLayout(payload: unknown) {
  try {
    const parsed = saveFloorLayoutSchema.parse(payload);

    const draft = await prisma.floorLayout.findFirst({
      where: { venueId: parsed.venueId, status: 'DRAFT', isCurrent: true },
      select: { id: true }
    });

    if (!draft) {
      throw new FloorNotFoundError('Draft layout not found. Refresh and try again.');
    }

    const tableIds = parsed.tables.map((table) => table.tableId);
    const venueTables = tableIds.length
      ? await prisma.table.findMany({
          where: { venueId: parsed.venueId, id: { in: tableIds } },
          select: { id: true }
        })
      : [];

    if (venueTables.length !== new Set(tableIds).size) {
      throw new FloorValidationError('Layout contains table IDs outside the venue scope.');
    }

    const referencedAreaIds = parsed.areas
      .map((area) => area.areaId)
      .filter((areaId): areaId is string => Boolean(areaId));

    const venueAreas = referencedAreaIds.length
      ? await prisma.area.findMany({
          where: { venueId: parsed.venueId, id: { in: referencedAreaIds } },
          select: { id: true }
        })
      : [];

    if (venueAreas.length !== new Set(referencedAreaIds).size) {
      throw new FloorValidationError('Layout contains area IDs outside the venue scope.');
    }

    const areaIds = new Set(parsed.areas.map((area) => area.id));
    for (const table of parsed.tables) {
      if (table.floorLayoutAreaId && !areaIds.has(table.floorLayoutAreaId)) {
        throw new FloorValidationError('Table references an unknown area in this draft.');
      }
      if (table.capacityMin && table.capacityMin > table.capacityMax) {
        throw new FloorValidationError('capacityMin cannot exceed capacityMax.');
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.floorLayout.update({
        where: { id: draft.id },
        data: {
          canvasWidth: parsed.canvasWidth,
          canvasHeight: parsed.canvasHeight,
          gridSize: parsed.gridSize
        }
      });

      await tx.floorLayoutArea.deleteMany({ where: { floorLayoutId: draft.id } });
      await tx.floorLayoutArea.createMany({
        data: parsed.areas.map((area) => ({
          id: area.id,
          floorLayoutId: draft.id,
          areaId: area.areaId,
          name: area.name,
          sortOrder: area.sortOrder,
          isActive: area.isActive
        }))
      });

      await tx.floorLayoutTable.deleteMany({ where: { floorLayoutId: draft.id } });
      await tx.floorLayoutTable.createMany({
        data: parsed.tables.map((table) => ({
          id: table.id,
          floorLayoutId: draft.id,
          floorLayoutAreaId: table.floorLayoutAreaId,
          tableId: table.tableId,
          label: table.label,
          capacityMin: table.capacityMin,
          capacityMax: table.capacityMax,
          shape: table.shape,
          x: table.x,
          y: table.y,
          width: table.width,
          height: table.height,
          rotation: table.rotation,
          isActive: table.isActive,
          combinableMeta:
            table.combinableMeta == null
              ? Prisma.JsonNull
              : (table.combinableMeta as Prisma.InputJsonValue)
        }))
      });
    });

    return getOrCreateDraftLayout(parsed.venueId);
  } catch (error) {
    throw toError(error);
  }
}

export async function publishDraftLayout(venueId: string) {
  const draft = await prisma.floorLayout.findFirst({
    where: { venueId, status: 'DRAFT', isCurrent: true },
    include: { areas: true, tables: true }
  });

  if (!draft) {
    throw new FloorNotFoundError('Draft layout not found.');
  }

  const latestPublished = await prisma.floorLayout.findFirst({
    where: { venueId, status: 'PUBLISHED' },
    orderBy: { version: 'desc' },
    select: { version: true }
  });

  await prisma.$transaction(async (tx) => {
    await tx.floorLayout.updateMany({
      where: { venueId, status: 'PUBLISHED', isCurrent: true },
      data: { isCurrent: false }
    });

    const published = await tx.floorLayout.create({
      data: {
        venueId,
        status: 'PUBLISHED',
        version: (latestPublished?.version ?? 0) + 1,
        name: `Published v${(latestPublished?.version ?? 0) + 1}`,
        canvasWidth: draft.canvasWidth,
        canvasHeight: draft.canvasHeight,
        gridSize: draft.gridSize,
        isCurrent: true,
        publishedFromLayoutId: draft.id,
        areas: {
          create: draft.areas.map((area) => ({
            areaId: area.areaId,
            name: area.name,
            sortOrder: area.sortOrder,
            isActive: area.isActive
          }))
        }
      },
      include: { areas: true }
    });

    const areaMap = new Map(
      published.areas.map((area, idx) => [draft.areas[idx]?.id, area.id] as const)
    );

    if (draft.tables.length > 0) {
      await tx.floorLayoutTable.createMany({
        data: draft.tables.map((table) => ({
          floorLayoutId: published.id,
          floorLayoutAreaId: table.floorLayoutAreaId
            ? (areaMap.get(table.floorLayoutAreaId) ?? null)
            : null,
          tableId: table.tableId,
          label: table.label,
          capacityMin: table.capacityMin,
          capacityMax: table.capacityMax,
          shape: table.shape,
          x: table.x,
          y: table.y,
          width: table.width,
          height: table.height,
          rotation: table.rotation,
          isActive: table.isActive,
          combinableMeta:
            table.combinableMeta == null
              ? Prisma.JsonNull
              : (table.combinableMeta as Prisma.InputJsonValue)
        }))
      });
    }
  });

  return getPublishedLayout(venueId);
}
