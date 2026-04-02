'use client';

import { useMemo, useState } from 'react';
import type { TableShape } from '@prisma/client';
import { FloorLayoutRenderer } from './floor-layout-renderer';
import type { FloorLayoutDto } from '@/lib/floor-layout/types';
import { SectionCard } from './section-card';

type DomainTable = {
  id: string;
  name: string;
  areaId: string;
  capacityMin: number | null;
  capacityMax: number;
  shape: TableShape;
  isActive: boolean;
  canCombine: boolean;
  combineGroup: string | null;
};

type DomainArea = {
  id: string;
  name: string;
};

const SHAPES: TableShape[] = ['ROUND', 'SQUARE', 'RECTANGLE'];
const SIZE_PRESETS = {
  SMALL: { width: 72, height: 72, label: 'Small footprint' },
  MEDIUM: { width: 96, height: 96, label: 'Medium footprint' },
  LARGE: { width: 128, height: 128, label: 'Large footprint' }
} as const;

function newId() {
  return `c${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36).slice(-8)}`;
}

function getVisualSizeKey(width: number, height: number) {
  if (width === SIZE_PRESETS.SMALL.width && height === SIZE_PRESETS.SMALL.height) return 'SMALL';
  if (width === SIZE_PRESETS.MEDIUM.width && height === SIZE_PRESETS.MEDIUM.height) return 'MEDIUM';
  if (width === SIZE_PRESETS.LARGE.width && height === SIZE_PRESETS.LARGE.height) return 'LARGE';
  return 'CUSTOM';
}

export function FloorLayoutEditor({
  venueId,
  initialDraft,
  initialPublished,
  initialTables,
  initialAreas
}: {
  venueId: string;
  initialDraft: FloorLayoutDto;
  initialPublished: FloorLayoutDto | null;
  initialTables: DomainTable[];
  initialAreas: DomainArea[];
}) {
  const [draft, setDraft] = useState(initialDraft);
  const [published, setPublished] = useState(initialPublished);
  const [tables, setTables] = useState(initialTables);
  const [areas, setAreas] = useState(initialAreas);
  const [selectedTableInventoryId, setSelectedTableInventoryId] = useState<string | null>(
    initialDraft.tables[0]?.tableId ?? initialTables[0]?.id ?? null
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const selectedDomainTable = useMemo(
    () => tables.find((table) => table.id === selectedTableInventoryId) ?? null,
    [tables, selectedTableInventoryId]
  );

  const selectedPlacedTable = useMemo(
    () =>
      draft.tables.find((table) => table.tableId === selectedTableInventoryId) ??
      null,
    [draft.tables, selectedTableInventoryId]
  );

  const placedByDomainId = useMemo(
    () => new Map(draft.tables.map((table) => [table.tableId, table.id])),
    [draft.tables]
  );

  function markDirty(nextDraft: FloorLayoutDto) {
    setDraft(nextDraft);
    setDirty(true);
    setSuccess(null);
  }

  function patchPlacedTable(patch: Partial<FloorLayoutDto['tables'][number]>) {
    if (!selectedPlacedTable) return;
    markDirty({
      ...draft,
      tables: draft.tables.map((table) =>
        table.id === selectedPlacedTable.id ? { ...table, ...patch } : table
      )
    });
  }

  async function saveDraft() {
    setIsSaving(true);
    setError(null);

    const res = await fetch('/api/admin/floor-layout', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        venueId,
        canvasWidth: draft.canvasWidth,
        canvasHeight: draft.canvasHeight,
        gridSize: draft.gridSize,
        areas: draft.areas,
        tables: draft.tables
      })
    });

    const body = await res.json().catch(() => ({}));
    setIsSaving(false);

    if (!res.ok) {
      setError(body.error ?? 'Failed to save draft layout.');
      return;
    }

    setDraft(body.draft);
    setDirty(false);
    setSuccess('Draft saved.');
  }

  async function publishDraft() {
    if (!window.confirm('Publish current draft as live layout?')) return;
    setIsPublishing(true);
    setError(null);

    const res = await fetch('/api/admin/floor-layout/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ venueId })
    });

    const body = await res.json().catch(() => ({}));
    setIsPublishing(false);

    if (!res.ok) {
      setError(body.error ?? 'Failed to publish layout.');
      return;
    }

    setPublished(body.published);
    setSuccess('Layout published.');
  }

  async function createZone(formData: FormData) {
    setError(null);
    const name = String(formData.get('name') ?? '').trim();
    if (!name) return;

    const res = await fetch('/api/admin/areas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ venueId, name, sortOrder: draft.areas.length, isActive: true })
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? 'Failed to create zone.');
      return;
    }

    setAreas((current) => [...current, { id: body.area.id, name: body.area.name }]);

    markDirty({
      ...draft,
      areas: [
        ...draft.areas,
        {
          id: newId(),
          areaId: body.area.id,
          name: body.area.name,
          sortOrder: body.area.sortOrder,
          isActive: body.area.isActive
        }
      ]
    });
  }

  async function createTable(formData: FormData) {
    setError(null);
    const name = String(formData.get('name') ?? '').trim();
    if (!name) return;

    const areaId = String(formData.get('areaId') ?? '');
    const capacityMax = Number(formData.get('capacityMax') ?? 2);
    const capacityMin = Number(formData.get('capacityMin') ?? 1);
    const shape = String(formData.get('shape') ?? 'SQUARE') as TableShape;

    const res = await fetch('/api/admin/tables', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        venueId,
        areaId,
        name,
        shape,
        tableType: 'STANDARD',
        capacityMin,
        capacityMax,
        isActive: true,
        canCombine: false,
        combineGroup: null
      })
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? 'Failed to create table.');
      return;
    }

    const nextTable = body.table as {
      id: string;
      name: string;
      areaId: string;
      capacityMin: number | null;
      capacityMax: number;
      shape: TableShape;
      isActive: boolean;
      canCombine: boolean;
      combineGroup: string | null;
    };

    setTables((current) => [...current, nextTable]);
    setSelectedTableInventoryId(nextTable.id);
    setSuccess('Table created. Add it to this draft when ready.');
  }

  function addTableToDraft(tableId: string) {
    const domainTable = tables.find((table) => table.id === tableId);
    if (!domainTable) return;
    if (placedByDomainId.has(tableId)) return;

    const index = draft.tables.length;
    const spacing = draft.gridSize * 4;

    markDirty({
      ...draft,
      tables: [
        ...draft.tables,
        {
          id: newId(),
          tableId: domainTable.id,
          floorLayoutAreaId:
            draft.areas.find((area) => area.areaId === domainTable.areaId)?.id ?? null,
          label: domainTable.name,
          capacityMin: domainTable.capacityMin,
          capacityMax: domainTable.capacityMax,
          shape: domainTable.shape,
          x: draft.gridSize + (index % 6) * spacing,
          y: draft.gridSize + Math.floor(index / 6) * spacing,
          width: SIZE_PRESETS.MEDIUM.width,
          height: SIZE_PRESETS.MEDIUM.height,
          rotation: 0,
          isActive: domainTable.isActive,
          combinableMeta: domainTable.canCombine
            ? { combineGroup: domainTable.combineGroup }
            : null
        }
      ]
    });

    setSelectedTableInventoryId(tableId);
  }

  async function updateDomainTable(payload: Partial<DomainTable>) {
    if (!selectedDomainTable) return;
    setError(null);

    const res = await fetch(`/api/admin/tables/${selectedDomainTable.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(body.error ?? 'Failed to update table.');
      return;
    }

    const next = body.table as DomainTable;
    setTables((current) => current.map((table) => (table.id === next.id ? next : table)));

    if (selectedPlacedTable) {
      patchPlacedTable({
        label: next.name,
        capacityMin: next.capacityMin,
        capacityMax: next.capacityMax,
        shape: next.shape,
        isActive: next.isActive,
        combinableMeta: next.canCombine ? { combineGroup: next.combineGroup } : null,
        floorLayoutAreaId:
          draft.areas.find((area) => area.areaId === next.areaId)?.id ?? null
      });
    }
  }

  async function duplicateSelectedTable() {
    if (!selectedDomainTable) return;

    const res = await fetch('/api/admin/tables', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        venueId,
        areaId: selectedDomainTable.areaId,
        name: `${selectedDomainTable.name} Copy`,
        shape: selectedDomainTable.shape,
        tableType: 'STANDARD',
        capacityMin: selectedDomainTable.capacityMin,
        capacityMax: selectedDomainTable.capacityMax,
        isActive: selectedDomainTable.isActive,
        canCombine: selectedDomainTable.canCombine,
        combineGroup: selectedDomainTable.combineGroup
      })
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? 'Failed to duplicate table.');
      return;
    }

    setTables((current) => [...current, body.table as DomainTable]);
    setSelectedTableInventoryId(body.table.id);
  }

  async function deleteSelectedTable() {
    if (!selectedDomainTable) return;
    if (!window.confirm('Delete this table from venue inventory? This is permanent.')) return;

    const res = await fetch(`/api/admin/tables/${selectedDomainTable.id}`, {
      method: 'DELETE'
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? 'Failed to delete table.');
      return;
    }

    setTables((current) => current.filter((table) => table.id !== selectedDomainTable.id));
    markDirty({
      ...draft,
      tables: draft.tables.filter((table) => table.tableId !== selectedDomainTable.id)
    });

    setSelectedTableInventoryId(null);
    setSuccess('Table deleted from inventory.');
  }

  function removeFromDraftOnly() {
    if (!selectedPlacedTable) return;
    if (!window.confirm('Remove this table from this draft layout only?')) return;

    markDirty({
      ...draft,
      tables: draft.tables.filter((table) => table.id !== selectedPlacedTable.id)
    });
  }

  return (
    <div className="w-full min-w-0 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2 shadow-sm">
        <div>
          <h2 className="text-sm font-semibold">Floor Layout Editor</h2>
          <p className="text-xs text-slate-500">
            Draft v{draft.version} • {dirty ? 'Unsaved changes' : 'Saved'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            disabled={isSaving || !dirty}
            onClick={saveDraft}
            className="rounded border px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {isSaving ? 'Saving…' : 'Save Draft'}
          </button>
          <button
            disabled={isPublishing || dirty}
            onClick={publishDraft}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            {isPublishing ? 'Publishing…' : 'Publish Draft'}
          </button>
        </div>
      </div>

      {error ? <p className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}
      {success ? <p className="rounded border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-700">{success}</p> : null}

      <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
        <SectionCard
          className="min-w-0"
          title="Draft Canvas"
          description="Select, drag, resize, and rotate placed tables."
        >
          <FloorLayoutRenderer
            layout={{ ...draft, canvasWidth: Math.min(draft.canvasWidth, 1200), canvasHeight: Math.min(draft.canvasHeight, 760) }}
            selectedTableId={selectedPlacedTable?.id ?? null}
            onSelectTable={(layoutTableId) => {
              const hit = draft.tables.find((table) => table.id === layoutTableId);
              setSelectedTableInventoryId(hit?.tableId ?? null);
            }}
          >
            {selectedPlacedTable ? (
              <>
                <div
                  className="absolute h-4 w-4 cursor-se-resize rounded border border-blue-600 bg-white"
                  style={{ left: selectedPlacedTable.x + selectedPlacedTable.width - 8, top: selectedPlacedTable.y + selectedPlacedTable.height - 8 }}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    const startX = event.clientX;
                    const startY = event.clientY;
                    const initialW = selectedPlacedTable.width;
                    const initialH = selectedPlacedTable.height;

                    const onMove = (moveEvent: MouseEvent) => {
                      const nextW = Math.max(40, initialW + (moveEvent.clientX - startX));
                      const nextH = Math.max(40, initialH + (moveEvent.clientY - startY));
                      patchPlacedTable({
                        width: Math.round(nextW / draft.gridSize) * draft.gridSize,
                        height: Math.round(nextH / draft.gridSize) * draft.gridSize
                      });
                    };

                    const onUp = () => {
                      window.removeEventListener('mousemove', onMove);
                      window.removeEventListener('mouseup', onUp);
                    };

                    window.addEventListener('mousemove', onMove);
                    window.addEventListener('mouseup', onUp);
                  }}
                />

                <div
                  className="absolute cursor-move"
                  style={{ left: selectedPlacedTable.x, top: selectedPlacedTable.y, width: selectedPlacedTable.width, height: selectedPlacedTable.height }}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    const startX = event.clientX;
                    const startY = event.clientY;
                    const initialX = selectedPlacedTable.x;
                    const initialY = selectedPlacedTable.y;

                    const onMove = (moveEvent: MouseEvent) => {
                      const nextX = Math.max(0, initialX + (moveEvent.clientX - startX));
                      const nextY = Math.max(0, initialY + (moveEvent.clientY - startY));
                      patchPlacedTable({
                        x: Math.round(nextX / draft.gridSize) * draft.gridSize,
                        y: Math.round(nextY / draft.gridSize) * draft.gridSize
                      });
                    };

                    const onUp = () => {
                      window.removeEventListener('mousemove', onMove);
                      window.removeEventListener('mouseup', onUp);
                    };

                    window.addEventListener('mousemove', onMove);
                    window.addEventListener('mouseup', onUp);
                  }}
                />
              </>
            ) : null}
          </FloorLayoutRenderer>
        </SectionCard>

        <div className="min-w-0 space-y-3">
          <SectionCard title="Tables" description="Venue table inventory and draft placement status.">
            <form action={createTable} className="mb-3 space-y-2 rounded border p-2">
              <input name="name" required placeholder="New table name" className="w-full rounded border p-1.5 text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <select name="areaId" className="rounded border p-1.5 text-sm" defaultValue={areas[0]?.id}>
                  {areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
                </select>
                <select name="shape" className="rounded border p-1.5 text-sm" defaultValue="SQUARE">
                  {SHAPES.map((shape) => <option key={shape} value={shape}>{shape}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input name="capacityMin" type="number" min={1} defaultValue={1} className="rounded border p-1.5 text-sm" />
                <input name="capacityMax" type="number" min={1} defaultValue={4} className="rounded border p-1.5 text-sm" />
              </div>
              <button className="rounded border px-2 py-1 text-xs">Create table</button>
            </form>

            <ul className="max-h-56 space-y-1 overflow-auto text-sm">
              {tables.map((table) => {
                const placed = placedByDomainId.has(table.id);
                const selected = selectedTableInventoryId === table.id;
                return (
                  <li key={table.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedTableInventoryId(table.id)}
                      className={`flex w-full items-center justify-between rounded border px-2 py-1 text-left ${selected ? 'border-blue-500 bg-blue-50' : 'border-slate-200'}`}
                    >
                      <span>{table.name}</span>
                      <span className={`text-xs ${placed ? 'text-emerald-700' : 'text-slate-500'}`}>{placed ? 'Placed' : 'Unplaced'}</span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {selectedDomainTable ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedPlacedTable ? (
                  <button onClick={removeFromDraftOnly} className="rounded border px-2 py-1 text-xs">
                    Remove from draft
                  </button>
                ) : (
                  <button onClick={() => addTableToDraft(selectedDomainTable.id)} className="rounded border px-2 py-1 text-xs">
                    Add to draft
                  </button>
                )}
                <button onClick={duplicateSelectedTable} className="rounded border px-2 py-1 text-xs">Duplicate</button>
              </div>
            ) : null}
          </SectionCard>

          <SectionCard title="Zones" description="Manage zone labels used by draft placement.">
            <form action={createZone} className="mb-2 flex gap-2">
              <input name="name" className="w-full rounded border p-1.5 text-sm" placeholder="New zone" required />
              <button className="rounded border px-2 text-sm">Add</button>
            </form>
            <ul className="space-y-1 text-sm">
              {draft.areas.map((area) => (
                <li key={area.id} className="rounded border p-1.5">{area.name}</li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard title="Selected Table" description="Business settings and layout properties for the selected table.">
            {!selectedDomainTable ? (
              <p className="text-sm text-slate-500">Select a table from the list or canvas.</p>
            ) : (
              <div className="space-y-2 text-sm">
                <label className="block">
                  <span className="mb-1 block text-xs text-slate-500">Name</span>
                  <input
                    value={selectedDomainTable.name}
                    onChange={(event) =>
                      setTables((current) =>
                        current.map((table) =>
                          table.id === selectedDomainTable.id
                            ? { ...table, name: event.target.value }
                            : table
                        )
                      )
                    }
                    onBlur={() => updateDomainTable({ name: selectedDomainTable.name })}
                    className="w-full rounded border p-1.5"
                  />
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <label>
                    <span className="mb-1 block text-xs text-slate-500">Min seats</span>
                    <input
                      type="number"
                      min={1}
                      value={selectedDomainTable.capacityMin ?? 1}
                      onChange={(event) =>
                        setTables((current) =>
                          current.map((table) =>
                            table.id === selectedDomainTable.id
                              ? { ...table, capacityMin: Number(event.target.value) }
                              : table
                          )
                        )
                      }
                      onBlur={() => updateDomainTable({ capacityMin: selectedDomainTable.capacityMin })}
                      className="w-full rounded border p-1.5"
                    />
                  </label>
                  <label>
                    <span className="mb-1 block text-xs text-slate-500">Max seats</span>
                    <input
                      type="number"
                      min={1}
                      value={selectedDomainTable.capacityMax}
                      onChange={(event) =>
                        setTables((current) =>
                          current.map((table) =>
                            table.id === selectedDomainTable.id
                              ? { ...table, capacityMax: Number(event.target.value) }
                              : table
                          )
                        )
                      }
                      onBlur={() => updateDomainTable({ capacityMax: selectedDomainTable.capacityMax })}
                      className="w-full rounded border p-1.5"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="mb-1 block text-xs text-slate-500">Shape</span>
                  <select
                    value={selectedDomainTable.shape}
                    onChange={(event) => {
                      const shape = event.target.value as TableShape;
                      setTables((current) =>
                        current.map((table) =>
                          table.id === selectedDomainTable.id ? { ...table, shape } : table
                        )
                      );
                      void updateDomainTable({ shape });
                    }}
                    className="w-full rounded border p-1.5"
                  >
                    {SHAPES.map((shape) => (
                      <option key={shape} value={shape}>{shape}</option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs text-slate-500">Zone</span>
                  <select
                    value={selectedDomainTable.areaId}
                    onChange={(event) => {
                      const areaId = event.target.value;
                      setTables((current) =>
                        current.map((table) =>
                          table.id === selectedDomainTable.id ? { ...table, areaId } : table
                        )
                      );
                      void updateDomainTable({ areaId });
                    }}
                    className="w-full rounded border p-1.5"
                  >
                    {areas.map((area) => (
                      <option key={area.id} value={area.id}>{area.name}</option>
                    ))}
                  </select>
                </label>

                {selectedPlacedTable ? (
                  <>
                    <label className="block">
                      <span className="mb-1 block text-xs text-slate-500">Visual footprint</span>
                      <select
                        value={getVisualSizeKey(selectedPlacedTable.width, selectedPlacedTable.height)}
                        onChange={(event) => {
                          const value = event.target.value as keyof typeof SIZE_PRESETS | 'CUSTOM';
                          if (value === 'CUSTOM') return;
                          const preset = SIZE_PRESETS[value];
                          patchPlacedTable({ width: preset.width, height: preset.height });
                        }}
                        className="w-full rounded border p-1.5"
                      >
                        <option value="SMALL">Small footprint</option>
                        <option value="MEDIUM">Medium footprint</option>
                        <option value="LARGE">Large footprint</option>
                        <option value="CUSTOM">Custom footprint</option>
                      </select>
                    </label>

                    <div className="grid grid-cols-2 gap-2">
                      <label>
                        <span className="mb-1 block text-xs text-slate-500">Width (visual)</span>
                        <input
                          type="number"
                          value={selectedPlacedTable.width}
                          onChange={(event) => patchPlacedTable({ width: Number(event.target.value) })}
                          className="w-full rounded border p-1.5"
                        />
                      </label>
                      <label>
                        <span className="mb-1 block text-xs text-slate-500">Height (visual)</span>
                        <input
                          type="number"
                          value={selectedPlacedTable.height}
                          onChange={(event) => patchPlacedTable({ height: Number(event.target.value) })}
                          className="w-full rounded border p-1.5"
                        />
                      </label>
                    </div>

                    <label className="block">
                      <span className="mb-1 block text-xs text-slate-500">Rotation (degrees)</span>
                      <input
                        type="number"
                        min={-180}
                        max={180}
                        value={selectedPlacedTable.rotation}
                        onChange={(event) => patchPlacedTable({ rotation: Number(event.target.value) })}
                        className="w-full rounded border p-1.5"
                      />
                    </label>
                  </>
                ) : (
                  <p className="rounded border bg-slate-50 p-2 text-xs text-slate-600">
                    This table is currently unplaced in the draft. Add it from the Tables panel to edit visual footprint.
                  </p>
                )}

                <label className="flex items-center gap-2 rounded border p-2">
                  <input
                    type="checkbox"
                    checked={selectedDomainTable.isActive}
                    onChange={(event) => {
                      const isActive = event.target.checked;
                      setTables((current) =>
                        current.map((table) =>
                          table.id === selectedDomainTable.id ? { ...table, isActive } : table
                        )
                      );
                      void updateDomainTable({ isActive });
                    }}
                  />
                  Active table
                </label>

                <div className="rounded border border-red-200 bg-red-50 p-2">
                  <p className="mb-2 text-xs font-medium text-red-700">Actions</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedPlacedTable ? (
                      <button onClick={removeFromDraftOnly} className="rounded border border-red-300 px-2 py-1 text-xs text-red-700">
                        Remove from draft only
                      </button>
                    ) : null}
                    <button onClick={deleteSelectedTable} className="rounded border border-red-300 px-2 py-1 text-xs text-red-700">
                      Delete table inventory
                    </button>
                  </div>
                </div>
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      <SectionCard title="Published Layout" description="Current live layout snapshot.">
        {published ? <FloorLayoutRenderer layout={published} /> : <p className="text-sm text-slate-500">No published layout yet.</p>}
      </SectionCard>
    </div>
  );
}
