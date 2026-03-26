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
      <PageHeader title="Areas & Tables" description="Manage the floor map entities used during assignment." />
      <FloorManager
        venueId={venueId}
        initialAreas={areas.map((area: { id: string; name: string; sortOrder: number; isActive: boolean; tables: Array<{ id: string; name: string; capacityMax: number; isActive: boolean }> }) => ({
          id: area.id,
          name: area.name,
          sortOrder: area.sortOrder,
          isActive: area.isActive,
          tables: area.tables.map((table: { id: string; name: string; capacityMax: number; isActive: boolean }) => ({ id: table.id, name: table.name, capacityMax: table.capacityMax, isActive: table.isActive }))
        }))}
      />
    </div>
  );
}
