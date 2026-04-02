import { FloorLayoutEditor } from '@/components/admin/floor-layout-editor';
import { PageHeader } from '@/components/admin/page-header';
import { getAdminContext } from '@/server/auth/admin-context';
import { prisma } from '@/server/db/prisma/client';
import {
  getOrCreateDraftLayout,
  getPublishedLayout
} from '@/server/floor-layout/service';

export default async function FloorManagementPage() {
  const { venueId } = await getAdminContext();
  if (!venueId) return <p>Missing venue scope.</p>;

  const [draft, published, tables] = await Promise.all([
    getOrCreateDraftLayout(venueId),
    getPublishedLayout(venueId),
    prisma.table.findMany({ where: { venueId }, orderBy: { name: 'asc' } })
  ]);

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4">
      <PageHeader
        title="Visual Floor Layout"
        description="Create and publish the seating plan used by operations today and by visual booking workflows in upcoming phases."
      />
      <FloorLayoutEditor
        venueId={venueId}
        initialDraft={draft}
        initialPublished={published}
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
