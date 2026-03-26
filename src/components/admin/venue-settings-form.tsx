'use client';

import { useState } from 'react';

export function VenueSettingsForm({
  venue
}: {
  venue: { id: string; name: string; slug: string; timezone: string; currency: string; isActive: boolean };
}) {
  const [values, setValues] = useState(venue);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const res = await fetch(`/api/admin/venues/${venue.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values)
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(body.error ?? 'Unable to save settings.');
      return;
    }
    setMessage('Venue settings saved.');
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-lg border bg-white p-4 md:max-w-2xl">
      {message ? <p className="rounded border p-2 text-sm">{message}</p> : null}
      <label className="block text-sm">Venue Name<input className="mt-1 w-full rounded border p-2" value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} /></label>
      <label className="block text-sm">Venue Slug<input className="mt-1 w-full rounded border p-2" value={values.slug} onChange={(e) => setValues({ ...values, slug: e.target.value })} /></label>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm">Timezone<input className="mt-1 w-full rounded border p-2" value={values.timezone} onChange={(e) => setValues({ ...values, timezone: e.target.value })} /></label>
        <label className="text-sm">Currency<input maxLength={3} className="mt-1 w-full rounded border p-2" value={values.currency} onChange={(e) => setValues({ ...values, currency: e.target.value.toUpperCase() })} /></label>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={values.isActive} onChange={(e) => setValues({ ...values, isActive: e.target.checked })} />Venue is active</label>
      <button className="rounded bg-slate-900 px-4 py-2 text-sm text-white">Save settings</button>
    </form>
  );
}
