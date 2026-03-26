'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function ReservationActions({
  reservationId,
  organizationId,
  statuses,
  currentStatusId
}: {
  reservationId: string;
  organizationId: string;
  statuses: Array<{ id: string; label: string }>;
  currentStatusId: string;
}) {
  const [statusId, setStatusId] = useState(currentStatusId);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function updateStatus() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/reservations/${reservationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId, action: 'status', reservationStatusId: statusId })
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? 'Failed status update.');
      setBusy(false);
      return;
    }
    router.refresh();
    setBusy(false);
  }

  async function cancelReservation() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/reservations/${reservationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId, action: 'cancel', reason: 'Cancelled from admin UI.' })
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? 'Failed cancellation.');
      setBusy(false);
      return;
    }
    router.refresh();
    setBusy(false);
  }

  return (
    <div className="space-y-2">
      {error ? <p className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">Change status<select className="mt-1 rounded border p-2" value={statusId} onChange={(e) => setStatusId(e.target.value)}>{statuses.map((status) => <option key={status.id} value={status.id}>{status.label}</option>)}</select></label>
        <button type="button" onClick={updateStatus} disabled={busy} className="rounded border px-3 py-2 text-sm">Update</button>
        <button type="button" onClick={cancelReservation} disabled={busy} className="rounded border border-red-300 px-3 py-2 text-sm text-red-700">Cancel Reservation</button>
      </div>
    </div>
  );
}
