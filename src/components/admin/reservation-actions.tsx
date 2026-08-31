'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/client/api';

type Status = { id: string; label: string };

export function ReservationActions({
  reservationId,
  organizationId,
  statuses,
  currentStatusId
}: {
  reservationId: string;
  organizationId: string;
  statuses: Status[];
  currentStatusId: string;
}) {
  const router = useRouter();
  const [selectedStatusId, setSelectedStatusId] = useState(currentStatusId);
  const [statusLoading, setStatusLoading] = useState(false);
  const [cancelConfirming, setCancelConfirming] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function changeStatus() {
    if (selectedStatusId === currentStatusId) return;
    setStatusLoading(true);
    setError(null);
    try {
      await apiFetch<unknown>('/api/admin/reservations/' + reservationId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          action: 'status',
          reservationStatusId: selectedStatusId
        })
      });
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to update status.');
    } finally {
      setStatusLoading(false);
    }
  }

  async function cancelReservation() {
    setCancelLoading(true);
    setError(null);
    try {
      await apiFetch<unknown>('/api/admin/reservations/' + reservationId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId, action: 'cancel' })
      });
      router.refresh();
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : 'Failed to cancel reservation.'
      );
      setCancelConfirming(false);
    } finally {
      setCancelLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="border border-foreground bg-secondary p-2 text-sm text-foreground">
          {error}
        </p>
      ) : null}

      <div className="flex items-end gap-2">
        <label className="block flex-1 text-sm">
          Status
          <select
            value={selectedStatusId}
            onChange={(e) => setSelectedStatusId(e.target.value)}
            className="mt-1 w-full border p-2 text-sm"
          >
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={changeStatus}
          disabled={statusLoading || selectedStatusId === currentStatusId}
          className="bg-foreground px-3 py-2 text-sm text-background disabled:opacity-40"
        >
          {statusLoading ? 'Saving…' : 'Update'}
        </button>
      </div>

      <div>
        {cancelConfirming ? (
          <span className="flex items-center gap-2 text-sm">
            <span className="text-foreground">Cancel this reservation?</span>
            <button
              onClick={cancelReservation}
              disabled={cancelLoading}
              className="text-foreground underline disabled:opacity-50"
            >
              {cancelLoading ? 'Cancelling…' : 'Yes, cancel'}
            </button>
            <button
              onClick={() => setCancelConfirming(false)}
              className="text-muted-foreground underline"
            >
              No
            </button>
          </span>
        ) : (
          <button
            onClick={() => setCancelConfirming(true)}
            className="text-sm text-foreground hover:underline"
          >
            Cancel reservation
          </button>
        )}
      </div>
    </div>
  );
}
