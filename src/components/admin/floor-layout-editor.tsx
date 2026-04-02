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

const SHAPES: TableShape[] = ['ROUND', 'SQUARE', 'RECTANGLE'];

function newId() {
  return `c${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36).slice(-8)}`;
}

export function FloorLayoutEditor({
  venueId,
  initialDraft,
  initialPublished,
  initialTables
}: {
  venueId: string;
  initialDraft: FloorLayoutDto;
  initialPublished: FloorLayoutDto | null;
  initialTables: DomainTable[];
}) {
  const [draft, setDraft] = useState(initialDraft);
  const [published, setPublished] = useState(initialPublished);
  const [availableTables] = useState(initialTables);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(
    initialDraft.tables[0]?.id ?? null
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const selectedTable = useMemo(
    () => draft.tables.find((table) => table.id === selectedTableId) ?? null,
    [draft.tables, selectedTableId]
  );

  const unplacedTables = useMemo(() => {
    const used = new Set(draft.tables.map((table) => table.tableId));
    return availableTables.filter((table) => !used.has(table.id));
  }, [availableTables, draft.tables]);

  function markDirty(nextDraft: FloorLayoutDto) {
    setDraft(nextDraft);
    setDirty(true);
    setSuccess(null);
  }

  function updateSelectedTable(patch: Partial<FloorLayoutDto['tables'][number]>) {
    if (!selectedTable) return;
    markDirty({
      ...draft,
      tables: draft.tables.map((table) =>
        table.id === selectedTable.id ? { ...table, ...patch } : table
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
      body: JSON.stringify({
        venueId,
        name,
        sortOrder: draft.areas.length,
        isActive: true
      })
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? 'Failed to create zone.');
      return;
    }

    const area = body.area as { id: string; name: string; sortOrder: number; isActive: boolean };
    markDirty({
      ...draft,
      areas: [
        ...draft.areas,
        {
          id: newId(),
          areaId: area.id,
          name: area.name,
          sortOrder: area.sortOrder,
          isActive: area.isActive
        }
      ]
    });
  }

  async function addTableToLayout(tableId: string) {
    const domainTable = availableTables.find((table) => table.id === tableId);
    if (!domainTable) return;

    const index = draft.tables.length;
    const spacing = draft.gridSize * 5;
    const next = {
      id: newId(),
      tableId: domainTable.id,
      floorLayoutAreaId:
        draft.areas.find((area) => area.areaId === domainTable.areaId)?.id ?? null,
      label: domainTable.name,
      capacityMin: domainTable.capacityMin,
      capacityMax: domainTable.capacityMax,
      shape: domainTable.shape,
      x: draft.gridSize + (index % 8) * spacing,
      y: draft.gridSize + Math.floor(index / 8) * spacing,
      width: draft.gridSize * 4,
      height: draft.gridSize * 4,
      rotation: 0,
      isActive: domainTable.isActive,
      combinableMeta: domainTable.canCombine
        ? { combineGroup: domainTable.combineGroup }
        : null
    };

    markDirty({ ...draft, tables: [...draft.tables, next] });
    setSelectedTableId(next.id);
  }

  return (
    <div className="space-y-4">
      {error ? <p className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}
      {success ? <p className="rounded border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-700">{success}</p> : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">Draft v{draft.version} {dirty ? '• Unsaved changes' : '• Saved'}</p>
        <div className="flex gap-2">
          <button disabled={isSaving || !dirty} onClick={saveDraft} className="rounded border px-3 py-2 text-sm disabled:opacity-50">{isSaving ? 'Saving…' : 'Save Draft'}</button>
          <button disabled={isPublishing || dirty} onClick={publishDraft} className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50">{isPublishing ? 'Publishing…' : 'Publish Draft'}</button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <SectionCard title="Draft Canvas" description="Drag tables to position. Use the sidebar to fine-tune dimensions and zone assignment.">
          <FloorLayoutRenderer
            layout={draft}
            selectedTableId={selectedTableId}
            onSelectTable={setSelectedTableId}
          >
            {selectedTable ? (
              <div
                className="absolute h-4 w-4 cursor-se-resize rounded border border-blue-600 bg-white"
                style={{ left: selectedTable.x + selectedTable.width - 8, top: selectedTable.y + selectedTable.height - 8 }}
                onMouseDown={(event) => {
                  event.preventDefault();
                  const startX = event.clientX;
                  const startY = event.clientY;
                  const initialW = selectedTable.width;
                  const initialH = selectedTable.height;

                  const onMove = (moveEvent: MouseEvent) => {
                    const nextW = Math.max(40, initialW + (moveEvent.clientX - startX));
                    const nextH = Math.max(40, initialH + (moveEvent.clientY - startY));
                    updateSelectedTable({
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
            ) : null}

            {draft.tables.map((table) => (
              <div
                key={`${table.id}-drag`}
                className="absolute cursor-move"
                style={{ left: table.x, top: table.y, width: table.width, height: table.height }}
                onMouseDown={(event) => {
                  if (selectedTableId !== table.id) return;
                  event.preventDefault();
                  const startX = event.clientX;
                  const startY = event.clientY;
                  const initialX = table.x;
                  const initialY = table.y;

                  const onMove = (moveEvent: MouseEvent) => {
                    const nextX = Math.max(0, initialX + (moveEvent.clientX - startX));
                    const nextY = Math.max(0, initialY + (moveEvent.clientY - startY));
                    markDirty({
                      ...draft,
                      tables: draft.tables.map((item) =>
                        item.id === table.id
                          ? {
                              ...item,
                              x: Math.round(nextX / draft.gridSize) * draft.gridSize,
                              y: Math.round(nextY / draft.gridSize) * draft.gridSize
                            }
                          : item
                      )
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
            ))}
          </FloorLayoutRenderer>
        </SectionCard>

        <div className="space-y-4">
          <SectionCard title="Zones" description="Zones are backed by existing areas for compatibility with current reservation logic.">
            <form action={createZone} className="mb-2 flex gap-2">
              <input name="name" className="w-full rounded border p-2 text-sm" placeholder="New zone name" required />
              <button className="rounded border px-3 text-sm">Add</button>
            </form>
            <ul className="space-y-1 text-sm">
              {draft.areas.map((area) => (
                <li key={area.id} className="rounded border p-2">
                  <input
                    value={area.name}
                    onChange={(event) =>
                      markDirty({
                        ...draft,
                        areas: draft.areas.map((item) =>
                          item.id === area.id ? { ...item, name: event.target.value } : item
                        )
                      })
                    }
                    className="w-full rounded border p-1"
                  />
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard title="Tables" description="Add existing operational tables to draft layout.">
            {unplacedTables.length === 0 ? (
              <p className="text-sm text-slate-500">All current tables are already placed in this draft.</p>
            ) : (
              <div className="space-y-2">
                {unplacedTables.map((table) => (
                  <button key={table.id} onClick={() => addTableToLayout(table.id)} className="block w-full rounded border px-2 py-1 text-left text-sm">
                    + {table.name}
                  </button>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Table Properties" description="Selected table details.">
            {!selectedTable ? (
              <p className="text-sm text-slate-500">Select a table on the canvas.</p>
            ) : (
              <div className="space-y-2 text-sm">
                <input value={selectedTable.label} onChange={(event) => updateSelectedTable({ label: event.target.value })} className="w-full rounded border p-2" />
                <select value={selectedTable.shape} onChange={(event) => updateSelectedTable({ shape: event.target.value as TableShape })} className="w-full rounded border p-2">
                  {SHAPES.map((shape) => (
                    <option key={shape} value={shape}>{shape}</option>
                  ))}
                </select>
                <select value={selectedTable.floorLayoutAreaId ?? ''} onChange={(event) => updateSelectedTable({ floorLayoutAreaId: event.target.value || null })} className="w-full rounded border p-2">
                  <option value="">No zone</option>
                  {draft.areas.map((area) => (
                    <option key={area.id} value={area.id}>{area.name}</option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" value={selectedTable.width} onChange={(event) => updateSelectedTable({ width: Number(event.target.value) })} className="rounded border p-2" />
                  <input type="number" value={selectedTable.height} onChange={(event) => updateSelectedTable({ height: Number(event.target.value) })} className="rounded border p-2" />
                </div>
                <input type="range" min={-180} max={180} value={selectedTable.rotation} onChange={(event) => updateSelectedTable({ rotation: Number(event.target.value) })} className="w-full" />
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={selectedTable.isActive} onChange={(event) => updateSelectedTable({ isActive: event.target.checked })} /> Active
                </label>
                <button className="rounded border px-3 py-1" onClick={() => {
                  if (!window.confirm('Remove this table from draft layout only?')) return;
                  markDirty({ ...draft, tables: draft.tables.filter((table) => table.id !== selectedTable.id) });
                  setSelectedTableId(null);
                }}>Remove from layout</button>
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      <SectionCard title="Published Layout" description="Current live layout snapshot rendered via the shared renderer.">
        {published ? <FloorLayoutRenderer layout={published} /> : <p className="text-sm text-slate-500">No published layout yet. Publish the draft when ready.</p>}
      </SectionCard>
    </div>
  );
}
