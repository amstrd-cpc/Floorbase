import Link from 'next/link';
import { PageHeader } from '@/components/admin/page-header';
import { ReservationActions } from '@/components/admin/reservation-actions';
import { ReservationFloorAssignment } from '@/components/admin/reservation-floor-assignment';
import { SectionCard } from '@/components/admin/section-card';
import { getAdminContext } from '@/server/auth/admin-context';
import { prisma } from '@/server/db/prisma/client';

function formatDateTime(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
}

function formatTime(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
}

export default async function ReservationDetailsPage({
  params
}: {
  params: { reservationId: string };
}) {
  const { organizationId, venueId } = await getAdminContext();
  if (!organizationId || !venueId) return <p>Missing admin scope.</p>;

  const [reservation, statuses, venue] = await Promise.all([
    prisma.reservation.findFirst({
      where: { id: params.reservationId, organizationId, venueId },
      include: {
        guest: true,
        status: true,
        reservationTables: { include: { table: true } }
      }
    }),
    prisma.reservationStatus.findMany({
      where: { organizationId, isActive: true },
      orderBy: { sortOrder: 'asc' }
    }),
    prisma.venue.findUnique({
      where: { id: venueId },
      select: { timezone: true }
    })
  ]);

  if (!reservation) return <p>Reservation not found.</p>;
  const timezone = venue?.timezone ?? 'UTC';

  return (
    <div className="space-y-4">
      <PageHeader
        title="Reservation Details"
        description="Review contact data, assignment, and status."
        actions={[
          {
            href: `/admin/reservations/${reservation.id}/edit`,
            label: 'Edit Reservation'
          },
          { href: '/admin/reservations', label: 'Back to List' }
        ]}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="Guest" className="lg:col-span-2">
          <dl className="grid gap-2 text-sm md:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Name</dt>
              <dd>{reservation.guest.fullName ?? 'n/a'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Phone</dt>
              <dd>{reservation.guest.phone ?? 'n/a'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd>{reservation.guest.email ?? 'n/a'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Party Size</dt>
              <dd>{reservation.partySize}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Time</dt>
              <dd>
                {formatDateTime(new Date(reservation.startAt), timezone)} -{' '}
                {formatTime(new Date(reservation.endAt), timezone)} ({timezone})
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Tables</dt>
              <dd>
                {reservation.reservationTables
                  .map((rt: { table: { name: string } }) => rt.table.name)
                  .join(', ') || 'Unassigned'}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Special Requests</dt>
              <dd>{reservation.specialRequests ?? 'n/a'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Internal Notes</dt>
              <dd>{reservation.internalNotes ?? 'n/a'}</dd>
            </div>
          </dl>
        </SectionCard>
        <SectionCard title="Actions">
          <p className="mb-2 text-sm">
            Current status: <strong>{reservation.status.label}</strong>
          </p>
          <ReservationActions
            reservationId={reservation.id}
            organizationId={organizationId}
            currentStatusId={reservation.reservationStatusId}
            statuses={statuses.map((status: { id: string; label: string }) => ({
              id: status.id,
              label: status.label
            }))}
          />
          <Link
            href={`/admin/reservations/${reservation.id}/edit`}
            className="mt-3 inline-block text-sm text-blue-700 hover:underline"
          >
            Edit reservation data
          </Link>
        </SectionCard>
      </div>
      <ReservationFloorAssignment
        reservationId={reservation.id}
        organizationId={organizationId}
        timezone={timezone}
      />
    </div>
  );
}
