import Link from 'next/link';
import { PageHeader } from '@/components/admin/page-header';
import { SectionCard } from '@/components/admin/section-card';
import { getAdminContext } from '@/server/auth/admin-context';
import { prisma } from '@/server/db/prisma/client';

function dayRange() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export default async function AdminHomePage() {
  const { organizationId, venueId } = await getAdminContext();
  if (!organizationId || !venueId) return <p>Missing admin scope. Seed venue and role data first.</p>;

  const { start, end } = dayRange();
  const nextWeek = new Date(start);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const [todayReservations, upcomingReservations] = await Promise.all([
    prisma.reservation.findMany({
      where: { organizationId, venueId, startAt: { gte: start, lt: end } },
      include: { guest: true, status: true },
      orderBy: { startAt: 'asc' }
    }),
    prisma.reservation.findMany({
      where: { organizationId, venueId, startAt: { gte: end, lt: nextWeek } },
      include: { guest: true, status: true },
      orderBy: { startAt: 'asc' },
      take: 8
    })
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Daily Operations"
        description="Fast access for hosts and managers working the floor."
        actions={[{ href: '/admin/reservations/new', label: 'New Reservation' }, { href: '/admin/reservations', label: 'Open Reservation List' }]}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard title={`Today (${todayReservations.length})`} description="Sorted by arrival time.">
          <div className="space-y-2 text-sm">
            {todayReservations.length === 0 ? (
              <p className="text-muted-foreground">No reservations for today.</p>
            ) : (
              todayReservations.map((reservation: { id: string; partySize: number; startAt: Date; status: { label: string }; guest: { fullName: string | null } }) => (
                <Link key={reservation.id} href={`/admin/reservations/${reservation.id}`} className="flex items-center justify-between rounded border p-2 hover:bg-slate-50">
                  <span>{reservation.guest.fullName ?? 'Guest'} · {reservation.partySize}p</span>
                  <span className="text-xs text-muted-foreground">{new Date(reservation.startAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · {reservation.status.label}</span>
                </Link>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard title="Upcoming (next 7 days)" description="Use this for prep and callbacks.">
          <div className="space-y-2 text-sm">
            {upcomingReservations.length === 0 ? (
              <p className="text-muted-foreground">No upcoming reservations.</p>
            ) : (
              upcomingReservations.map((reservation: { id: string; partySize: number; startAt: Date; status: { label: string }; guest: { fullName: string | null } }) => (
                <Link key={reservation.id} href={`/admin/reservations/${reservation.id}`} className="flex items-center justify-between rounded border p-2 hover:bg-slate-50">
                  <span>{reservation.guest.fullName ?? 'Guest'} · {reservation.partySize}p</span>
                  <span className="text-xs text-muted-foreground">{new Date(reservation.startAt).toLocaleDateString()} · {reservation.status.label}</span>
                </Link>
              ))
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
