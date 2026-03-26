import Link from 'next/link';

type HeaderAction = {
  href: string;
  label: string;
};

export function PageHeader({
  title,
  description,
  actions
}: {
  title: string;
  description?: string;
  actions?: HeaderAction[];
}) {
  return (
    <div className="flex flex-col gap-3 border-b bg-white px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions?.length ? (
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <Link key={action.href} href={action.href} className="rounded border px-3 py-2 text-sm font-medium hover:bg-slate-50">
              {action.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
