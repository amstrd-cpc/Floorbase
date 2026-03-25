import { requireRole } from '@/server/auth/authorization';

export default async function AdminHomePage() {
  const user = await requireRole(['SUPER_ADMIN', 'ORGANIZATION_ADMIN', 'VENUE_MANAGER', 'HOST']);

  return (
    <section className="rounded-lg border bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold">Reservation Admin Dashboard</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Protected internal area. Current user has {user.adminRoles.length} active admin role assignment(s).
      </p>
    </section>
  );
}
