'use client';

import { useState } from 'react';

type Area = { id: string; name: string; sortOrder: number; isActive: boolean; tables: Array<{ id: string; name: string; capacityMax: number; isActive: boolean }> };

export function FloorManager({ venueId, initialAreas }: { venueId: string; initialAreas: Area[] }) {
  const [areas] = useState(initialAreas);
  const [error, setError] = useState<string | null>(null);

  async function createArea(formData: FormData) {
    setError(null);
    const res = await fetch('/api/admin/areas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ venueId, name: formData.get('name'), sortOrder: Number(formData.get('sortOrder') || 0) })
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return setError(body.error ?? 'Failed to create area.');
    window.location.reload();
  }

  async function createTable(formData: FormData) {
    setError(null);
    const res = await fetch('/api/admin/tables', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ venueId, areaId: formData.get('areaId'), name: formData.get('name'), capacityMax: Number(formData.get('capacityMax')), capacityMin: Number(formData.get('capacityMin') || 1) })
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return setError(body.error ?? 'Failed to create table.');
    window.location.reload();
  }

  return (
    <div className="space-y-4">
      {error ? <p className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <form action={createArea} className="space-y-2 rounded border bg-white p-4">
          <h3 className="font-semibold">Add Area</h3>
          <input required name="name" placeholder="Area name" className="w-full rounded border p-2 text-sm" />
          <input name="sortOrder" type="number" defaultValue={0} className="w-full rounded border p-2 text-sm" />
          <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Create Area</button>
        </form>
        <form action={createTable} className="space-y-2 rounded border bg-white p-4">
          <h3 className="font-semibold">Add Table</h3>
          <select required name="areaId" className="w-full rounded border p-2 text-sm">{areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select>
          <input required name="name" placeholder="Table name" className="w-full rounded border p-2 text-sm" />
          <div className="grid grid-cols-2 gap-2"><input required min={1} max={20} name="capacityMin" type="number" placeholder="Min" className="rounded border p-2 text-sm" /><input required min={1} max={20} name="capacityMax" type="number" placeholder="Max" className="rounded border p-2 text-sm" /></div>
          <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Create Table</button>
        </form>
      </div>
      <div className="space-y-3">
        {areas.map((area) => (
          <section key={area.id} className="rounded border bg-white p-4">
            <h4 className="font-medium">{area.name} <span className="text-xs text-muted-foreground">({area.tables.length} tables)</span></h4>
            <ul className="mt-2 grid gap-1 text-sm md:grid-cols-2">
              {area.tables.map((table) => <li key={table.id} className="rounded border px-2 py-1">{table.name} · up to {table.capacityMax}</li>)}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
