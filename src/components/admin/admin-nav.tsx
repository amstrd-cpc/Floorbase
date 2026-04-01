'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/admin', label: 'Today' },
  { href: '/admin/reservations', label: 'Reservations' },
  { href: '/admin/floor', label: 'Floor' },
  { href: '/admin/events', label: 'Events' },
  { href: '/admin/settings', label: 'Settings' },
  
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium',
              isActive ? 'bg-slate-900 text-white' : 'border bg-white text-slate-700 hover:bg-slate-100'
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
