'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FloorLayoutRenderer } from './floor-layout-renderer';
import { SectionCard } from './section-card';
import type { FloorLayoutDto } from '@/lib/floor-layout/types';
import { apiFetch, ApiError } from '@/lib/client/api';

type Snapshot = {
  reservation: {
    id: string;
    venueId: string;
    partySize: number;
    startAt: string;
    endAt: string;
    bookingStatus: string;
    assignedTableIds: string[];
  };
  publishedLayout: FloorLayoutDto | null;
  tableStates: Array<{
    layoutTableId: string;
    tableId: string;
    tableName: string;
    isActive: boolean;
    status: 'free' | 'assigned-selected' | 'conflict' | 'inactive';
    reason: string | null;
    conflictingReservationId: string | null;
  }>;
};

function formatDateTime(dateText: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'short',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(dateText));
}

export function ReservationFloorAssignment({
  reservationId,
  organizationId,
  timezone
}: {
  reservationId: string;
  organizationId: string;
  timezone: string;
}) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [selectedLayoutTableId, setSelectedLayoutTableId] = useState<
    string | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function loadSnapshot() {
    setLoading(true);
    setError(null);
    try {
      const body = await apiFetch<{ snapshot: Snapshot }>(
        `/api/admin/reservations/${reservationId}/assignment?organizationId=${organizationId}`,
        { cache: 'no-store' }
      );
      const nextSnapshot = body.snapshot;
      setSnapshot(nextSnapshot);
      const firstAssigned = nextSnapshot.tableStates.find(
        (table) => table.status === 'assigned-selected'
      );
      setSelectedLayoutTableId(firstAssigned?.layoutTableId ?? null);
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : 'Failed to load floor assignment state.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSnapshot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservationId, organizationId]);

  const tableByLayoutId = useMemo(() => {
    if (!snapshot) return new Map<string, Snapshot['tableStates'][number]>();
    return new Map(
      snapshot.tableStates.map((table) => [table.layoutTableId, table])
    );
  }, [snapshot]);

  const selectedTableState = selectedLayoutTableId
    ? (tableByLayoutId.get(selectedLayoutTableId) ?? null)
    : null;

  const rendererStates = useMemo<
    Record<
      string,
      {
        tone: 'default' | 'free' | 'assigned' | 'conflict' | 'inactive';
        badge?: string;
        subtitle?: string;
      }
    >
  >(() => {
    if (!snapshot) return {};

    return Object.fromEntries(
      snapshot.tableStates.map((table) => {
        if (table.status === 'assigned-selected') {
          return [
            table.layoutTableId,
            {
              tone: 'assigned',
              badge: 'Assigned',
              subtitle: table.reason ?? undefined
            }
          ];
        }

        if (table.status === 'conflict') {
          return [
            table.layoutTableId,
            {
              tone: 'conflict',
              badge: 'Conflict',
              subtitle: table.reason ?? undefined
            }
          ];
        }

        if (table.status === 'inactive') {
          return [
            table.layoutTableId,
            {
              tone: 'inactive',
              badge: 'Inactive',
              subtitle: table.reason ?? undefined
            }
          ];
        }

        return [
          table.layoutTableId,
          {
            tone: 'free',
            badge: 'Free',
            subtitle: table.reason ?? undefined
          }
        ];
      })
    );
  }, [snapshot]);

  async function saveAssignment(tableId: string | null) {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const body = await apiFetch<{ snapshot: Snapshot }>(
        `/api/admin/reservations/${reservationId}/assignment`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organizationId, tableId })
        }
      );
      setSnapshot(body.snapshot);
      setNotice(
        tableId ? 'Reservation reassigned.' : 'Reservation unassigned.'
      );
      router.refresh();
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : 'Failed to save assignment.'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard
      title="Floor Assignment"
      description="Assign this reservation to a table on the published layout."
    >
      {loading ? (
        <p className="text-sm text-slate-500">Loading floor assignment view…</p>
      ) : null}
      {error ? (
        <p className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="rounded border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-700">
          {notice}
        </p>
      ) : null}

      {!loading && snapshot && !snapshot.publishedLayout ? (
        <p className="text-sm text-slate-600">
          No published layout exists yet. Publish a floor layout before
          assigning reservations visually.
        </p>
      ) : null}

      {!loading && snapshot?.publishedLayout ? (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
          <FloorLayoutRenderer
            layout={snapshot.publishedLayout}
            selectedTableId={selectedLayoutTableId}
            tableStates={rendererStates}
            onSelectTable={(layoutTableId) =>
              setSelectedLayoutTableId(layoutTableId)
            }
          />

          <div className="space-y-3">
            <div className="rounded border p-3 text-sm">
              <p className="font-medium">Reservation window</p>
              <p className="text-slate-600">
                {formatDateTime(snapshot.reservation.startAt, timezone)} -{' '}
                {formatDateTime(snapshot.reservation.endAt, timezone)}
              </p>
              <p className="mt-1 text-slate-600">
                Party size: {snapshot.reservation.partySize}
              </p>
              <p className="mt-1 text-slate-600">
                Current table:{' '}
                {snapshot.tableStates.find(
                  (table) => table.status === 'assigned-selected'
                )?.tableName ?? 'Unassigned'}
              </p>
            </div>

            <div className="rounded border p-3 text-sm">
              <p className="font-medium">Selected table</p>
              {selectedTableState ? (
                <>
                  <p className="mt-1">{selectedTableState.tableName}</p>
                  <p className="mt-1 text-slate-600">
                    {selectedTableState.reason ?? 'No details.'}
                  </p>
                  {selectedTableState.conflictingReservationId ? (
                    <p className="mt-1 text-red-700">
                      Conflicts with reservation{' '}
                      {selectedTableState.conflictingReservationId}.
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={
                        saving ||
                        selectedTableState.status === 'conflict' ||
                        selectedTableState.status === 'inactive'
                      }
                      onClick={() => saveAssignment(selectedTableState.tableId)}
                      className="rounded bg-slate-900 px-3 py-1.5 text-xs text-white disabled:opacity-50"
                    >
                      {saving ? 'Saving…' : 'Assign table'}
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => saveAssignment(null)}
                      className="rounded border border-slate-300 px-3 py-1.5 text-xs"
                    >
                      Unassign
                    </button>
                  </div>
                </>
              ) : (
                <p className="mt-1 text-slate-600">
                  Select a table on the map to assign it.
                </p>
              )}
            </div>

            <div className="rounded border p-3 text-xs text-slate-600">
              <p className="font-medium text-slate-800">Legend</p>
              <ul className="mt-2 space-y-1">
                <li>• Free: available for this reservation window.</li>
                <li>• Assigned: currently assigned to this reservation.</li>
                <li>
                  • Conflict: assigned to another overlapping reservation.
                </li>
                <li>• Inactive: table cannot receive assignments.</li>
              </ul>
            </div>
          </div>
        </div>
      ) : null}
    </SectionCard>
  );
}
