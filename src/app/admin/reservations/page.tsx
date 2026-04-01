import Link from 'next/link';
import { PageHeader } from '@/components/admin/page-header';
import { SectionCard } from '@/components/admin/section-card';
import {
  formatDateForTimeZone,
  startOfZonedDayUtc,
  zonedTimeToUtc
} from '@/lib/timezone';
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

function parseDateFilter(dateText: string, timeZone: string, endOfDay = false) {
  const [yearText, monthText, dayText] = dateText.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if ([year, month, day].some((value) => Number.isNaN(value))) {
    return null;
  }

  return zonedTimeToUtc({
    year,
    month,
    day,
    hour: endOfDay ? 23 : 0,
    minute: endOfDay ? 59 : 0,
    timeZone
  });
}

export default async function ReservationListPage({
  searchParams
}: {
  searchParams?: { dateFrom?: string; dateTo?: string; statusId?: string };
}) {
  const { organizationId, venueId } = await getAdminContext();
  if (!organizationId || !venueId) return <p>Missing admin scope.</p>;

  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    select: { timezone: true }
  });
  const timezone = venue?.timezone ?? 'UTC';

  const todayStart = startOfZonedDayUtc(new Date(), timezone);
  const dateFrom = searchParams?.dateFrom
    ? parseDateFilter(searchParams.dateFrom, timezone)
    : todayStart;
  const dateTo = searchParams?.dateTo
    ? parseDateFilter(searchParams.dateTo, timezone, true)
    : undefined;

  const [statuses, reservations] = await Promise.all([
    prisma.reservationStatus.findMany({
      where: { organizationId, isActive: true },
      orderBy: { sortOrder: 'asc' }
    }),
    prisma.reservation.findMany({
      where: {
        organizationId,
        venueId,
        startAt: { gte: dateFrom ?? todayStart, ...(dateTo ? { lte: dateTo } : {}) },
        ...(searchParams?.statusId
          ? { reservationStatusId: searchParams.statusId }
          : {})
      },
      include: {
        guest: true,
        status: true,
        reservationTables: { include: { table: true } }
      },
      orderBy: { startAt: 'asc' },
      take: 150
    })
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Reservation List"
        description="Operational list with quick scanning and status context."
        actions={[{ href: '/admin/reservations/new', label: 'New Reservation' }]}
      />
      <SectionCard title="Filters">
        <form className="grid gap-3 md:grid-cols-4" method="get">
          <label className="text-sm">
            From
            <input
              type="date"
              name="dateFrom"
              defaultValue={searchParams?.dateFrom ?? formatDateForTimeZone(todayStart, timezone)}
              className="mt-1 w-full rounded border p-2"
            />
          </label>
          <label className="text-sm">
            To
            <input
              type="date"
              name="dateTo"
              defaultValue={searchParams?.dateTo ?? ''}
              className="mt-1 w-full rounded border p-2"
            />
          </label>
          <label className="text-sm">
            Status
            <select
              name="statusId"
              defaultValue={searchParams?.statusId ?? ''}
              className="mt-1 w-full rounded border p-2"
            >
              <option value="">All</option>
              {statuses.map((status: { id: string; label: string }) => (
                <option key={status.id} value={status.id}>
                  {status.label}
                </option>
              ))}
            </select>
          </label>
          <div className="self-end">
            <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white">
              Apply
            </button>
          </div>
        </form>
      </SectionCard>
      <SectionCard title={`Results (${reservations.length})`}>
        <p className="mb-2 text-xs text-slate-500">Times shown in {timezone}</p>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase text-muted-foreground">
                <th className="py-2">Time</th>
                <th>Guest</th>
                <th>Party</th>
                <th>Status</th>
                <th>Tables</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {reservations.map(
                (reservation: {
                  id: string;
                  startAt: Date;
                  partySize: number;
                  guest: { fullName: string | null };
                  status: { label: string };
                  reservationTables: Array<{ table: { name: string } }>;
                }) => (
                  <tr key={reservation.id} className="border-b">
                    <td className="py-2">{formatDateTime(new Date(reservation.startAt), timezone)}</td>
                    <td>{reservation.guest.fullName ?? 'Guest'}</td>
                    <td>{reservation.partySize}</td>
                    <td>{reservation.status.label}</td>
                    <td>
                      {reservation.reservationTables
                        .map((rt: { table: { name: string } }) => rt.table.name)
                        .join(', ') || 'Unassigned'}
                    </td>
                    <td>
                      <Link
                        className="text-sm text-blue-700 hover:underline"
                        href={`/admin/reservations/${reservation.id}`}
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
