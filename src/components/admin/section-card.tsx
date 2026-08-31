import { cn } from '@/lib/utils';

export function SectionCard({
  className,
  title,
  description,
  children
}: {
  className?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn('border border-border bg-card p-5', className)}>
      <h3 className="text-[15px] font-bold tracking-tight">{title}</h3>
      {description ? (
        <p className="mb-3 mt-1 text-sm text-muted-foreground">{description}</p>
      ) : null}
      <div className={description ? '' : 'mt-3'}>{children}</div>
    </section>
  );
}
