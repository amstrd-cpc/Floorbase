'use client';

import { useMemo, useState } from 'react';
import { SectionCard } from './section-card';

type TableShape =
  | 'SQUARE'
  | 'ROUND'
  | 'RECTANGLE'
  | 'BOOTH'
  | 'HIGH_TOP'
  | 'BAR'
  | 'COUNTER'
  | 'CUSTOM';

type TableType =
  | 'STANDARD'
  | 'OUTDOOR'
  | 'BAR'
  | 'PRIVATE'
  | 'ACCESSIBLE'
  | 'FLEX';

type FloorTable = {
  id: string;
  name: string;
  code: string | null;
  shape: TableShape;
  tableType: TableType;
  canCombine: boolean;
  combineGroup: string | null;
  capacityMin: number | null;
  capacityMax: number;
  isActive: boolean;
};

type Area = {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  tables: FloorTable[];
};

const TABLE_SHAPES: TableShape[] = [
  'SQUARE',
  'ROUND',
  'RECTANGLE',
  'BOOTH',
  'HIGH_TOP',
  'BAR',
  'COUNTER',
  'CUSTOM'
];

const TABLE_TYPES: TableType[] = [
  'STANDARD',
  'OUTDOOR',
  'BAR',
  'PRIVATE',
  'ACCESSIBLE',
  'FLEX'
];

function toLabel(value: string | null | undefined) {
  const normalized = String(value ?? '').trim();

  if (!normalized) {
    return 'Unknown';
  }

  return normalized
    .toLowerCase()
    .split('_')
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ');
}

function formatCapacity(table: FloorTable) {
  if (table.capacityMin) {
    return `${table.capacityMin}-${table.capacityMax}`;
  }

  return `Up to ${table.capacityMax}`;
}

export function FloorManager({
  venueId,
  initialAreas
}: {
  venueId: string;
  initialAreas: Area[];
}) {
  const [areas, setAreas] = useState(initialAreas);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function refreshAreas() {
    const res = await fetch(`/api/admin/areas?venueId=${venueId}`);
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(body.error ?? 'Failed to refresh floor data.');
    }

    setAreas(body.areas as Area[]);
  }

  const activeAreaCount = useMemo(
    () => areas.filter((area) => area.isActive).length,
    [areas]
  );

  async function createArea(formData: FormData) {
    setError(null);

    const res = await fetch('/api/admin/areas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        venueId,
        name: formData.get('name'),
        sortOrder: Number(formData.get('sortOrder') || 0),
        isActive: formData.get('isActive') === 'on'
      })
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return setError(body.error ?? 'Failed to create area.');
    }

    await refreshAreas();
  }

  async function createTable(formData: FormData) {
    setError(null);

    const canCombine = formData.get('canCombine') === 'on';
    const combineGroupRaw = String(formData.get('combineGroup') ?? '').trim();

    const res = await fetch('/api/admin/tables', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        venueId,
        areaId: formData.get('areaId'),
        name: formData.get('name'),
        code: formData.get('code') || null,
        shape: formData.get('shape'),
        tableType: formData.get('tableType'),
        canCombine,
        combineGroup: canCombine && combineGroupRaw ? combineGroupRaw : null,
        capacityMin: Number(formData.get('capacityMin') || 1),
        capacityMax: Number(formData.get('capacityMax')),
        isActive: formData.get('isActive') === 'on'
      })
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return setError(body.error ?? 'Failed to create table.');
    }

    await refreshAreas();
  }

  async function patchArea(areaId: string, payload: Record<string, unknown>) {
    setError(null);
    setSavingId(areaId);

    try {
      const res = await fetch(`/api/admin/areas/${areaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? 'Failed to update area.');
        return;
      }

      setAreas((current) =>
        current.map((area) =>
          area.id === areaId ? { ...area, ...(body.area as Area) } : area
        )
      );
    } finally {
      setSavingId(null);
    }
  }

  async function patchTable(
    tableId: string,
    payload: Record<string, unknown>,
    onSuccess: (next: FloorTable) => void
  ) {
    setError(null);
    setSavingId(tableId);

    try {
      const res = await fetch(`/api/admin/tables/${tableId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? 'Failed to update table.');
        return;
      }

      onSuccess(body.table as FloorTable);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Add Area / Zone"
          description={`Areas are sections of the venue used for assignment and operational routing. ${activeAreaCount} active.`}
        >
          <form action={createArea} className="space-y-2">
            <input
              required
              name="name"
              placeholder="Area name (e.g. Patio, Main Dining)"
              className="w-full rounded border p-2 text-sm"
            />
            <input
              name="sortOrder"
              type="number"
              defaultValue={0}
              className="w-full rounded border p-2 text-sm"
            />
            <label className="flex items-center gap-2 text-sm">
              <input name="isActive" type="checkbox" defaultChecked /> Active
            </label>
            <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white">
              Create Area
            </button>
          </form>
        </SectionCard>

        <SectionCard
          title="Add Table"
          description="Configure capacity, zoning, and metadata that reservation assignment uses."
        >
          <form action={createTable} className="space-y-2">
            <select
              required
              name="areaId"
              className="w-full rounded border p-2 text-sm"
            >
              {areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name} {area.isActive ? '' : '(inactive)'}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input
                required
                name="name"
                placeholder="Table name"
                className="rounded border p-2 text-sm"
              />
              <input
                name="code"
                placeholder="Code (optional)"
                className="rounded border p-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                name="shape"
                className="rounded border p-2 text-sm"
                defaultValue="SQUARE"
              >
                {TABLE_SHAPES.map((shape) => (
                  <option key={shape} value={shape}>
                    Shape: {toLabel(shape)}
                  </option>
                ))}
              </select>
              <select
                name="tableType"
                className="rounded border p-2 text-sm"
                defaultValue="STANDARD"
              >
                {TABLE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    Type: {toLabel(type)}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                required
                min={1}
                max={20}
                name="capacityMin"
                type="number"
                placeholder="Min party"
                className="rounded border p-2 text-sm"
                defaultValue={1}
              />
              <input
                required
                min={1}
                max={20}
                name="capacityMax"
                type="number"
                placeholder="Max party"
                className="rounded border p-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input name="isActive" type="checkbox" defaultChecked /> Active
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input name="canCombine" type="checkbox" /> Combinable
              </label>
            </div>
            <input
              name="combineGroup"
              placeholder="Combine group (optional, e.g. PATIO-A)"
              className="w-full rounded border p-2 text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Combine group is an extension point for future merge workflows.
            </p>
            <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white">
              Create Table
            </button>
          </form>
        </SectionCard>
      </div>

      <div className="space-y-3">
        {areas.map((area) => (
          <section key={area.id} className="rounded border bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-medium">
                {area.name}{' '}
                <span className="text-xs text-muted-foreground">
                  ({area.tables.length} tables)
                </span>
              </h4>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={area.isActive}
                  disabled={savingId === area.id}
                  onChange={(event) =>
                    patchArea(area.id, { isActive: event.target.checked })
                  }
                />
                Active Area
              </label>
            </div>
            <ul className="mt-2 grid gap-2 text-sm md:grid-cols-2">
              {area.tables.map((table) => (
                <li key={table.id} className="rounded border px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">
                      {table.name} {table.code ? `(${table.code})` : ''}
                    </p>
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={table.isActive}
                        disabled={savingId === table.id}
                        onChange={(event) =>
                          patchTable(
                            table.id,
                            { isActive: event.target.checked },
                            (next) =>
                              setAreas((current) =>
                                current.map((entry) => ({
                                  ...entry,
                                  tables: entry.tables.map((item) =>
                                    item.id === next.id ? next : item
                                  )
                                }))
                              )
                          )
                        }
                      />
                      Active
                    </label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {toLabel(table.tableType)} · {toLabel(table.shape)} · Party{' '}
                    {formatCapacity(table)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {table.canCombine
                      ? `Combinable${table.combineGroup ? ` (${table.combineGroup})` : ''}`
                      : 'Not combinable'}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
