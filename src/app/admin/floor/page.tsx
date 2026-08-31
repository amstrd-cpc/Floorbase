import { FloorLayoutEditor } from '@/components/admin/floor-layout-editor';
import { getAdminContext } from '@/server/auth/admin-context';
import { prisma } from '@/server/db/prisma/client';
import {
  getOrCreateDraftLayout,
  getPublishedLayout
} from '@/server/floor-layout/service';

export default async function FloorManagementPage() {
  const { venueId } = await getAdminContext();
  if (!venueId) return <p>Missing venue scope.</p>;

  const [draft, published, tables, areas] = await Promise.all([
    getOrCreateDraftLayout(venueId),
    getPublishedLayout(venueId),
    prisma.table.findMany({ where: { venueId }, orderBy: { name: 'asc' } }),
    prisma.area.findMany({
      where: { venueId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
    })
  ]);

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4">
      <FloorLayoutEditor
        venueId={venueId}
        initialDraft={draft}
        initialPublished={published}
        initialAreas={areas.map((area) => ({ id: area.id, name: area.name }))}
        initialTables={tables.map((table) => ({
          id: table.id,
          name: table.name,
          areaId: table.areaId,
          capacityMin: table.capacityMin,
          capacityMax: table.capacityMax,
          shape: table.shape,
          isActive: table.isActive,
          canCombine: table.canCombine,
          combineGroup: table.combineGroup
        }))}
      />
    </div>
  );
}
