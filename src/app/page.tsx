import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-lg border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Floorbase</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Reservation platform foundation initialized with internal admin auth and role-protected admin routes.
        </p>
        <div className="mt-4 flex gap-2">
          <Link className="rounded border px-3 py-1 text-sm" href="/login">
            Admin Login
          </Link>
          <Link className="rounded border px-3 py-1 text-sm" href="/admin">
            Admin Area
          </Link>
        </div>
      </div>
    </main>
  );
}
