import Link from 'next/link';

type HeaderAction = {
  href: string;
  label: string;
};

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: HeaderAction[];
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow ? (
          <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            {eyebrow}
          </div>
        ) : null}
        <h2 className="text-[clamp(24px,3vw,34px)] font-bold tracking-tightest">{title}</h2>
        {description ? <p className="mt-2 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions?.length ? (
        <div className="flex flex-wrap gap-2.5">
          {actions.map((action, i) => (
            <Link
              key={action.href}
              href={action.href}
              className={
                i === 0
                  ? 'bg-foreground px-3.5 py-2 text-[13px] font-semibold text-background transition hover:opacity-85'
                  : 'border border-foreground px-3.5 py-2 text-[13px] font-semibold transition hover:bg-secondary'
              }
            >
              {action.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
