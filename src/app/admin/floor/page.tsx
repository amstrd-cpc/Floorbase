import { FloorManager } from '@/components/admin/floor-manager';
import { PageHeader } from '@/components/admin/page-header';
import { getAdminContext } from '@/server/auth/admin-context';
import { prisma } from '@/server/db/prisma/client';

export default async function FloorManagementPage() {
  const { venueId } = await getAdminContext();
  if (!venueId) return <p>Missing venue scope.</p>;

  const areas = await prisma.area.findMany({
    where: { venueId },
    include: { tables: { orderBy: { name: 'asc' } } },
    orderBy: { sortOrder: 'asc' }
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Areas & Tables"
        description="Operational floor setup for zoning, capacities, and reservation assignment constraints."
      />
      <FloorManager
        venueId={venueId}
        initialAreas={areas.map((area) => ({
          id: area.id,
          name: area.name,
          sortOrder: area.sortOrder,
          isActive: area.isActive,
          tables: area.tables.map((table) => ({
            id: table.id,
            name: table.name,
            code: table.code,
            shape: table.shape,
            tableType: table.tableType,
            canCombine: table.canCombine,
            combineGroup: table.combineGroup,
            capacityMin: table.capacityMin,
            capacityMax: table.capacityMax,
            isActive: table.isActive
          }))
        }))}
      />
    </div>
  );
}
