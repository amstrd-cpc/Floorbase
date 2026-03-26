import Link from 'next/link';
import { PageHeader } from '@/components/admin/page-header';
import { SectionCard } from '@/components/admin/section-card';
import { getAdminContext } from '@/server/auth/admin-context';
import { prisma } from '@/server/db/prisma/client';

export default async function ReservationListPage({
  searchParams
}: {
  searchParams?: { dateFrom?: string; dateTo?: string; statusId?: string };
}) {
  const { organizationId, venueId } = await getAdminContext();
  if (!organizationId || !venueId) return <p>Missing admin scope.</p>;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dateFrom = searchParams?.dateFrom ? new Date(searchParams.dateFrom) : today;
  const dateTo = searchParams?.dateTo ? new Date(searchParams.dateTo) : undefined;

  const [statuses, reservations] = await Promise.all([
    prisma.reservationStatus.findMany({ where: { organizationId, isActive: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.reservation.findMany({
      where: {
        organizationId,
        venueId,
        startAt: { gte: dateFrom, ...(dateTo ? { lte: dateTo } : {}) },
        ...(searchParams?.statusId ? { reservationStatusId: searchParams.statusId } : {})
      },
      include: { guest: true, status: true, reservationTables: { include: { table: true } } },
      orderBy: { startAt: 'asc' },
      take: 150
    })
  ]);

  return (
    <div className="space-y-4">
      <PageHeader title="Reservation List" description="Operational list with quick scanning and status context." actions={[{ href: '/admin/reservations/new', label: 'New Reservation' }]} />
      <SectionCard title="Filters">
        <form className="grid gap-3 md:grid-cols-4" method="get">
          <label className="text-sm">From<input type="date" name="dateFrom" defaultValue={dateFrom.toISOString().slice(0, 10)} className="mt-1 w-full rounded border p-2" /></label>
          <label className="text-sm">To<input type="date" name="dateTo" defaultValue={searchParams?.dateTo ?? ''} className="mt-1 w-full rounded border p-2" /></label>
          <label className="text-sm">Status<select name="statusId" defaultValue={searchParams?.statusId ?? ''} className="mt-1 w-full rounded border p-2"><option value="">All</option>{statuses.map((status: { id: string; label: string }) => <option key={status.id} value={status.id}>{status.label}</option>)}</select></label>
          <div className="self-end"><button className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Apply</button></div>
        </form>
      </SectionCard>
      <SectionCard title={`Results (${reservations.length})`}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead><tr className="border-b text-xs uppercase text-muted-foreground"><th className="py-2">Time</th><th>Guest</th><th>Party</th><th>Status</th><th>Tables</th><th></th></tr></thead>
            <tbody>
              {reservations.map((reservation: { id: string; startAt: Date; partySize: number; guest: { fullName: string | null }; status: { label: string }; reservationTables: Array<{ table: { name: string } }> }) => (
                <tr key={reservation.id} className="border-b">
                  <td className="py-2">{new Date(reservation.startAt).toLocaleString()}</td>
                  <td>{reservation.guest.fullName ?? 'Guest'}</td>
                  <td>{reservation.partySize}</td>
                  <td>{reservation.status.label}</td>
                  <td>{reservation.reservationTables.map((rt: { table: { name: string } }) => rt.table.name).join(', ') || 'Unassigned'}</td>
                  <td><Link className="text-sm text-blue-700 hover:underline" href={`/admin/reservations/${reservation.id}`}>Open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
