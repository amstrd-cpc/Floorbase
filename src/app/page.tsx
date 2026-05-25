import Link from 'next/link';

const FEATURES = [
  {
    title: 'Floor-aware reservations',
    body: 'Drag-and-drop floor plan editor. Auto-assign or let guests pick their table. Every booking lands exactly where it should.',
  },
  {
    title: 'Real-time availability',
    body: 'Slot engine respects business hours, booking events, table capacity, and advance-notice windows — automatically.',
  },
  {
    title: 'Multi-venue ready',
    body: 'One login, multiple locations. Switch venues instantly from the admin header.',
  },
  {
    title: 'Custom booking events',
    body: 'Override hours, restrict sections, or open exclusive seatings for special nights — without touching code.',
  },
  {
    title: 'Role-based access',
    body: 'Super Admin → Org Admin → Venue Manager → Host. Invite staff and scope their access to exactly what they need.',
  },
  {
    title: 'Stripe billing built in',
    body: 'Subscription management, trial periods, and billing portal — included out of the box.',
  },
];

const PRICING = [
  { tier: 'Starter', venues: '1 venue', price: '$49', period: '/venue/mo' },
  { tier: 'Growth', venues: '2–5 venues', price: '$39', period: '/venue/mo' },
  { tier: 'Scale', venues: '6–15 venues', price: '$29', period: '/venue/mo' },
  { tier: 'Enterprise', venues: '16+ venues', price: 'Custom', period: '' },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="border-b px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <span className="text-lg font-semibold tracking-tight">Floorbase</span>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-slate-600 hover:text-slate-900">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded bg-black px-4 py-1.5 text-sm text-white hover:bg-slate-800"
            >
              Start free trial
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="px-6 py-20 text-center">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Reservation management built for hospitality operators
          </h1>
          <p className="mt-6 text-lg text-slate-600">
            Floorbase gives restaurants and bars a complete booking system — floor layout editor, availability engine, team access controls, and public booking page — ready to use in minutes.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link
              href="/signup"
              className="rounded-lg bg-black px-6 py-3 text-sm font-medium text-white hover:bg-slate-800"
            >
              Start 14-day free trial
            </Link>
            <Link
              href="/login"
              className="rounded-lg border px-6 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Sign in
            </Link>
          </div>
          <p className="mt-3 text-xs text-slate-400">No credit card required. Cancel any time.</p>
        </div>
      </section>

      {/* Features */}
      <section className="bg-slate-50 px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-2xl font-semibold">Everything your team needs</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-lg border bg-white p-6 shadow-sm">
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-semibold">Simple, venue-based pricing</h2>
          <p className="mt-2 text-center text-sm text-slate-500">
            Pay per active venue. Volume discounts apply automatically.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PRICING.map((p) => (
              <div
                key={p.tier}
                className="rounded-lg border p-5 text-center shadow-sm"
              >
                <div className="text-sm font-medium text-slate-500">{p.tier}</div>
                <div className="mt-1 text-xs text-slate-400">{p.venues}</div>
                <div className="mt-3 text-3xl font-bold">{p.price}</div>
                {p.period && <div className="text-sm text-slate-500">{p.period}</div>}
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-sm text-slate-500">
            All plans include unlimited reservations, guests, and staff accounts.
          </p>
          <div className="mt-6 text-center">
            <Link
              href="/signup"
              className="rounded-lg bg-black px-6 py-3 text-sm font-medium text-white hover:bg-slate-800"
            >
              Get started free
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t px-6 py-8 text-center text-xs text-slate-400">
        <p>© {new Date().getFullYear()} Floorbase. All rights reserved.</p>
      </footer>
    </div>
  );
}
