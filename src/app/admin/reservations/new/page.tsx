import { PageHeader } from '@/components/admin/page-header';
import { ReservationForm } from '@/components/admin/reservation-form';
import { getAdminContext } from '@/server/auth/admin-context';
import { prisma } from '@/server/db/prisma/client';

export default async function NewReservationPage() {
  const { organizationId, venueId } = await getAdminContext();
  if (!organizationId || !venueId) return <p>Missing admin scope.</p>;

  const [statuses, tables] = await Promise.all([
    prisma.reservationStatus.findMany({ where: { organizationId, isActive: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.table.findMany({ where: { venueId, isActive: true }, orderBy: [{ name: 'asc' }] })
  ]);

  return (
    <div className="space-y-4">
      <PageHeader title="Create Reservation" description="Use this flow during calls, walk-ins, and manager overrides." />
      <ReservationForm
        mode="create"
        organizationId={organizationId}
        venueId={venueId}
        statuses={statuses.map((status: { id: string; label: string }) => ({ id: status.id, label: status.label }))}
        tables={tables.map((table: { id: string; name: string; capacityMax: number }) => ({ id: table.id, label: `${table.name} (${table.capacityMax})` }))}
      />
    </div>
  );
}
