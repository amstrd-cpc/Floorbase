import Link from 'next/link';

export const fieldInput =
  'mt-1.5 w-full border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:border-foreground focus:ring-1 focus:ring-foreground';

export const fieldLabel = 'block text-[13px] font-medium';

export const primaryButton =
  'w-full bg-foreground px-4 py-2.5 text-[13px] font-semibold text-background transition hover:opacity-85 disabled:opacity-50';

function Mark({ className = 'h-[16px] w-[16px]' }: { className?: string }) {
  return (
    <span className={`relative inline-block ${className}`} aria-hidden="true">
      <span className="absolute inset-0 bg-foreground" />
      <span className="absolute bottom-0 right-0 h-1/2 w-1/2 rounded-full bg-background" />
    </span>
  );
}

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
  footer
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-background p-6">
      <section className="w-full max-w-md border border-border bg-card">
        <div className="flex items-center gap-2.5 border-b border-border px-8 py-5">
          <Mark />
          <span className="text-[15px] font-bold tracking-tightest">
            Floorbase
          </span>
        </div>
        <div className="px-8 py-8">
          {eyebrow ? (
            <div className="eyebrow text-muted-foreground">{eyebrow}</div>
          ) : null}
          <h1 className="mt-3 text-[26px] font-bold tracking-tightest">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}
          {children}
        </div>
        {footer ? (
          <div className="space-y-1.5 border-t border-border px-8 py-5 text-xs text-muted-foreground">
            {footer}
          </div>
        ) : null}
      </section>
    </main>
  );
}

export function AuthNotice({
  label = 'Error',
  children
}: {
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-5 border border-foreground bg-secondary px-3.5 py-3">
      <div className="eyebrow text-muted-foreground">{label}</div>
      <p className="mt-1 text-[13px] leading-relaxed text-foreground">
        {children}
      </p>
    </div>
  );
}

export function AuthLink({
  href,
  children
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="font-medium text-foreground underline underline-offset-2 hover:opacity-70"
    >
      {children}
    </Link>
  );
}
