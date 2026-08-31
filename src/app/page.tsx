import Link from 'next/link';

const FEATURES = [
  {
    n: '01',
    title: 'Floor-aware reservations',
    body: 'Drag-and-drop floor plan editor. Auto-assign or let guests pick their table — every booking lands exactly where it should.'
  },
  {
    n: '02',
    title: 'Real-time availability',
    body: 'A slot engine that respects business hours, booking events, table capacity, and advance-notice windows. Automatically.'
  },
  {
    n: '03',
    title: 'Multi-venue ready',
    body: 'One login, every location. Switch venues instantly from the admin header without losing context.'
  },
  {
    n: '04',
    title: 'Custom booking events',
    body: 'Override hours, restrict sections, or open exclusive seatings for special nights — without touching code.'
  },
  {
    n: '05',
    title: 'Role-based access',
    body: 'Super Admin → Org Admin → Venue Manager → Host. Invite staff and scope access to exactly what they need.'
  },
  {
    n: '06',
    title: 'Billing built in',
    body: 'Subscription management, trial periods, and a billing portal — included from the first day.'
  }
];

const PRICING = [
  { tier: 'Starter', venues: '1 venue', price: '$49', period: '/venue · mo' },
  {
    tier: 'Growth',
    venues: '2–5 venues',
    price: '$39',
    period: '/venue · mo',
    feature: true
  },
  { tier: 'Scale', venues: '6–15 venues', price: '$29', period: '/venue · mo' },
  { tier: 'Enterprise', venues: '16+ venues', price: 'Custom', period: '' }
];

function Mark({ className = 'h-[18px] w-[18px]' }: { className?: string }) {
  return (
    <span className={`relative inline-block ${className}`} aria-hidden="true">
      <span className="absolute inset-0 bg-foreground" />
      <span className="absolute bottom-0 right-0 h-1/2 w-1/2 rounded-full bg-background" />
    </span>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-20 border-b border-border bg-background">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <span className="flex items-center gap-2.5">
            <Mark />
            <span className="text-[17px] font-bold tracking-tightest">
              Floorbase
            </span>
          </span>
          <nav className="hidden items-center gap-7 text-[13.5px] text-muted-foreground md:flex">
            <span className="hover:text-foreground">Product</span>
            <span className="hover:text-foreground">Floor plan</span>
            <span className="hover:text-foreground">Pricing</span>
            <span className="hover:text-foreground">Docs</span>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="bg-foreground px-4 py-2 text-[13px] font-semibold text-background transition hover:opacity-85"
            >
              Start free trial
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-border">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-stretch md:grid-cols-[1.15fr_0.85fr]">
          <div className="px-6 py-16 md:py-24 md:pr-14">
            <div className="eyebrow text-muted-foreground">
              01 — Reservation OS for hospitality
            </div>
            <h1 className="mt-7 text-[clamp(40px,6vw,72px)] font-bold leading-[0.98] tracking-tightest">
              Every booking
              <br />
              lands exactly
              <br />
              where it should.
            </h1>
            <p className="mt-7 max-w-md text-[17px] leading-relaxed text-muted-foreground">
              Floorbase is the floor-aware reservation system for restaurants
              and bars — drag-and-drop floor plans, a real-time availability
              engine, and a public booking page, running in minutes.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href="/signup"
                className="bg-foreground px-5 py-3 text-[13.5px] font-semibold text-background transition hover:opacity-85"
              >
                Start 14-day trial
              </Link>
              <Link
                href="/login"
                className="border border-foreground px-5 py-3 text-[13.5px] font-semibold transition hover:bg-secondary"
              >
                View the dashboard
              </Link>
            </div>
            <div className="eyebrow mt-6 text-muted-foreground/70">
              No card required · Cancel anytime
            </div>
          </div>

          {/* Bauhaus geometric composition */}
          <div className="hidden items-center justify-center border-l border-border py-12 pl-14 md:flex">
            <div className="grid aspect-square w-full max-w-[360px] grid-cols-3 grid-rows-3 border border-foreground">
              {/* circle — top, 2 wide */}
              <div className="col-span-2 col-start-1 row-start-1 flex items-center justify-center border border-border">
                <span className="aspect-square h-[66%] rounded-full bg-foreground" />
              </div>
              {/* A2 window — right, 2 tall, dark */}
              <div className="col-start-3 row-span-2 row-start-1 flex items-center justify-center border border-border bg-foreground">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-background">
                  A2 · Window
                </span>
              </div>
              {/* quarter circle — left, rows 2-3 */}
              <div className="col-start-1 row-span-2 row-start-2 flex items-center justify-center border border-border">
                <span className="h-[78%] w-[78%] rounded-tl-full bg-foreground" />
              </div>
              {/* 92% seated — center */}
              <div className="col-start-2 row-start-2 flex items-center justify-center border border-border">
                <div className="text-center">
                  <div className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-muted-foreground">
                    Seated
                  </div>
                  <div className="text-[34px] font-bold tabular-nums leading-none tracking-tightest">
                    92
                    <span className="text-[16px] text-muted-foreground">%</span>
                  </div>
                </div>
              </div>
              {/* square outline — bottom middle */}
              <div className="col-start-2 row-start-3 flex items-center justify-center border border-border">
                <span className="h-[58%] w-[58%] border-2 border-foreground" />
              </div>
              {/* triangle — bottom right */}
              <div className="col-start-3 row-start-3 flex items-center justify-center border border-border">
                <span className="h-0 w-0 border-x-[26px] border-b-[44px] border-x-transparent border-b-foreground" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col gap-5 py-20">
            <div className="eyebrow text-muted-foreground">
              02 — Capabilities
            </div>
            <h2 className="max-w-2xl text-[clamp(28px,3.4vw,44px)] font-bold tracking-tightest">
              Everything the floor needs, nothing it doesn&apos;t.
            </h2>
          </div>
        </div>
        <div className="mx-auto max-w-6xl border-t border-border">
          <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.n} className="bg-background px-8 py-10">
                <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground/70">
                  {f.n}
                </div>
                <h3 className="mt-6 text-[18px] font-bold tracking-tight">
                  {f.title}
                </h3>
                <p className="mt-2.5 text-[14px] leading-relaxed text-muted-foreground">
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col gap-5 py-20">
            <div className="eyebrow text-muted-foreground">03 — Pricing</div>
            <h2 className="max-w-xl text-[clamp(28px,3.4vw,44px)] font-bold tracking-tightest">
              Pay per active venue. Volume discounts apply automatically.
            </h2>
          </div>
        </div>
        <div className="mx-auto max-w-6xl border-t border-border">
          <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
            {PRICING.map((p) => (
              <div
                key={p.tier}
                className={`px-7 py-8 ${p.feature ? 'bg-foreground text-background' : 'bg-background'}`}
              >
                <div
                  className={`font-mono text-[11px] uppercase tracking-[0.16em] ${p.feature ? 'text-background/60' : 'text-muted-foreground'}`}
                >
                  {p.tier}
                </div>
                <div
                  className={`mt-1.5 text-[12.5px] ${p.feature ? 'text-background/60' : 'text-muted-foreground/70'}`}
                >
                  {p.venues}
                </div>
                <div className="mt-7 text-[40px] font-bold tabular-nums leading-none tracking-tightest">
                  {p.price}
                </div>
                <div
                  className={`min-h-[18px] text-[12.5px] ${p.feature ? 'text-background/60' : 'text-muted-foreground/70'}`}
                >
                  {p.period}
                </div>
                <Link
                  href="/signup"
                  className={`mt-7 block w-full px-4 py-2.5 text-center text-[13px] font-semibold transition ${
                    p.feature
                      ? 'bg-background text-foreground hover:opacity-85'
                      : 'border border-foreground hover:bg-secondary'
                  }`}
                >
                  {p.price === 'Custom' ? 'Contact us' : 'Start trial'}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-9">
          <div className="flex items-center gap-2.5">
            <Mark className="h-[15px] w-[15px]" />
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground/70">
              © 2026 Floorbase
            </span>
          </div>
          <div className="flex gap-6 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground/70">
            <span>Privacy</span>
            <span>Terms</span>
            <span>Status</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
