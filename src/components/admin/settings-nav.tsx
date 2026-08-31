'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const ITEMS = [
  { href: '/admin/settings', label: 'Venue' },
  { href: '/admin/settings/hours', label: 'Hours' },
  { href: '/admin/settings/team', label: 'Team' }
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-4 flex gap-1 border-b pb-0">
      {ITEMS.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm font-medium',
              isActive
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
