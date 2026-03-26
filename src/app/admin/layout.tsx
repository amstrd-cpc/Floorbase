import { AdminNav } from '@/components/admin/admin-nav';
import { getAdminContext } from '@/server/auth/admin-context';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, organizationId, venueId } = await getAdminContext();

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b bg-white px-4 py-4 md:px-6">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold">Floorbase Admin</h1>
              <p className="text-xs text-muted-foreground">Signed in as {user.email}</p>
              <p className="text-xs text-muted-foreground">Org: {organizationId ?? 'n/a'} · Venue: {venueId ?? 'n/a'}</p>
            </div>
            <form action="/api/auth/logout" method="post">
              <button className="rounded border px-3 py-1 text-sm" type="submit">
                Sign out
              </button>
            </form>
          </div>
          <AdminNav />
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl p-4 md:p-6">{children}</main>
    </div>
  );
}
