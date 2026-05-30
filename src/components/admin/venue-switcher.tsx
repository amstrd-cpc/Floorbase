'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Venue = { id: string; name: string };

export function VenueSwitcher({
  venues,
  activeVenueId,
}: {
  venues: Venue[];
  activeVenueId: string;
}) {
  const router = useRouter();
  const [switching, setSwitching] = useState(false);

  if (venues.length <= 1) return null;

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const venueId = e.target.value;
    if (venueId === activeVenueId) return;
    setSwitching(true);
    await fetch('/api/admin/switch-venue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ venueId }),
    });
    router.refresh();
    setSwitching(false);
  }

  return (
    <select
      value={activeVenueId}
      onChange={handleChange}
      disabled={switching}
      className="border bg-card px-2 py-1 text-sm disabled:opacity-50"
      aria-label="Switch venue"
    >
      {venues.map((v) => (
        <option key={v.id} value={v.id}>
          {v.name}
        </option>
      ))}
    </select>
  );
}
