'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/admin', label: 'Today', n: '01' },
  { href: '/admin/reservations', label: 'Reservations', n: '02' },
  { href: '/admin/floor', label: 'Floor', n: '03' },
  { href: '/admin/menu', label: 'Menu', n: '04' },
  { href: '/admin/events', label: 'Events', n: '05' },
  { href: '/admin/settings', label: 'Settings', n: '06' },
  { href: '/admin/billing', label: 'Billing', n: '07' },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col py-3">
      {NAV_ITEMS.map((item) => {
        const isActive =
          item.href === '/admin'
            ? pathname === '/admin'
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3.5 border-l-2 px-[22px] py-2.5 transition-colors',
              isActive
                ? 'border-foreground bg-foreground text-background'
                : 'border-transparent text-muted-foreground hover:bg-secondary hover:text-foreground'
            )}
          >
            <span
              className={cn(
                'font-mono text-[9.5px] tracking-[0.14em]',
                isActive ? 'text-background/60' : 'text-muted-foreground/70'
              )}
            >
              {item.n}
            </span>
            <span className="text-[13.5px] font-semibold">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
