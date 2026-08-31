import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/admin/page-header';
import { ReservationForm } from '@/components/admin/reservation-form';
import { getAdminContext } from '@/server/auth/admin-context';
import { prisma } from '@/server/db/prisma/client';

export default async function EditReservationPage({
  params
}: {
  params: Promise<{ reservationId: string }>;
}) {
  const { reservationId } = await params;
  const { organizationId, venueId } = await getAdminContext();
  if (!organizationId || !venueId) return <p>Missing admin scope.</p>;

  const [statuses, tables, reservation] = await Promise.all([
    prisma.reservationStatus.findMany({
      where: { organizationId, isActive: true },
      orderBy: { sortOrder: 'asc' }
    }),
    prisma.table.findMany({
      where: { venueId, isActive: true },
      include: { area: true },
      orderBy: [{ name: 'asc' }]
    }),
    prisma.reservation.findFirst({
      where: { id: reservationId, organizationId, venueId },
      include: { guest: true, reservationTables: true }
    })
  ]);

  if (!reservation) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Edit Reservation"
        description="Update details with validation and clear error messages."
      />
      <ReservationForm
        mode="edit"
        reservationId={reservation.id}
        organizationId={organizationId}
        venueId={venueId}
        statuses={statuses.map((status: { id: string; label: string }) => ({
          id: status.id,
          label: status.label
        }))}
        tables={tables.map(
          (table: {
            id: string;
            name: string;
            capacityMin: number | null;
            capacityMax: number;
            area: { name: string };
          }) => ({
            id: table.id,
            label: `${table.name} · ${table.area.name} · ${table.capacityMin ?? 1}-${table.capacityMax}`,
            capacityMin: table.capacityMin,
            capacityMax: table.capacityMax
          })
        )}
        initialValues={{
          fullName: reservation.guest.fullName ?? '',
          email: reservation.guest.email ?? '',
          phone: reservation.guest.phone ?? '',
          startAt: new Date(reservation.startAt).toISOString().slice(0, 16),
          durationMinutes: Math.max(
            30,
            (reservation.endAt.getTime() - reservation.startAt.getTime()) /
              60000
          ),
          partySize: reservation.partySize,
          reservationStatusId: reservation.reservationStatusId,
          tableIds: reservation.reservationTables.map(
            (rt: { tableId: string }) => rt.tableId
          ),
          specialRequests: reservation.specialRequests ?? '',
          internalNotes: reservation.internalNotes ?? ''
        }}
      />
    </div>
  );
}
