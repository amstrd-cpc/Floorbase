import { requireAuthenticatedUser } from '@/server/auth/authorization';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuthenticatedUser();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white px-6 py-4">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Floorbase Admin</h1>
            <p className="text-xs text-muted-foreground">Signed in as {user.email}</p>
          </div>
          <form action="/api/auth/logout" method="post">
            <button className="rounded border px-3 py-1 text-sm" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl p-6">{children}</main>
    </div>
  );
}
