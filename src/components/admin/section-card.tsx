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
    <section className={cn('rounded-lg border bg-white p-4 shadow-sm md:p-5', className)}>
      <h3 className="text-base font-semibold">{title}</h3>
      {description ? <p className="mb-3 mt-1 text-sm text-muted-foreground">{description}</p> : null}
      {children}
    </section>
  );
}
