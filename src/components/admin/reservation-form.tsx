'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Option = { id: string; label: string; code?: string };

type ReservationFormProps = {
  mode: 'create' | 'edit';
  organizationId: string;
  venueId: string;
  statuses: Option[];
  tables: Option[];
  reservationId?: string;
  initialValues?: {
    fullName: string;
    email: string;
    phone: string;
    startAt: string;
    durationMinutes: number;
    partySize: number;
    reservationStatusId: string;
    tableIds: string[];
    specialRequests: string;
    internalNotes: string;
  };
};

export function ReservationForm(props: ReservationFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [values, setValues] = useState(
    props.initialValues ?? {
      fullName: '',
      email: '',
      phone: '',
      startAt: new Date().toISOString().slice(0, 16),
      durationMinutes: 90,
      partySize: 2,
      reservationStatusId: props.statuses[0]?.id ?? '',
      tableIds: [],
      specialRequests: '',
      internalNotes: ''
    }
  );

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const startAt = new Date(values.startAt);
    const endAt = new Date(startAt.getTime() + values.durationMinutes * 60000);

    const payload = {
      venueId: props.venueId,
      reservationDate: startAt.toISOString(),
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      partySize: values.partySize,
      reservationStatusId: values.reservationStatusId,
      tableIds: values.tableIds,
      guest: {
        fullName: values.fullName,
        email: values.email || null,
        phone: values.phone || null
      },
      specialRequests: values.specialRequests || null,
      internalNotes: values.internalNotes || null
    };

    const url = props.mode === 'create' ? '/api/admin/reservations' : `/api/admin/reservations/${props.reservationId}?organizationId=${props.organizationId}`;
    const method = props.mode === 'create' ? 'POST' : 'PUT';

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error ?? 'Unable to save reservation.');
      setSubmitting(false);
      return;
    }

    const reservationId = body.reservation?.id ?? props.reservationId;
    router.push(`/admin/reservations/${reservationId}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-lg border bg-white p-4 md:p-6">
      {error ? <p className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm">Guest Name<input required className="mt-1 w-full rounded border p-2" value={values.fullName} onChange={(e) => setValues({ ...values, fullName: e.target.value })} /></label>
        <label className="text-sm">Email<input type="email" className="mt-1 w-full rounded border p-2" value={values.email} onChange={(e) => setValues({ ...values, email: e.target.value })} /></label>
        <label className="text-sm">Phone<input className="mt-1 w-full rounded border p-2" value={values.phone} onChange={(e) => setValues({ ...values, phone: e.target.value })} /></label>
        <label className="text-sm">Party Size<input required min={1} max={20} type="number" className="mt-1 w-full rounded border p-2" value={values.partySize} onChange={(e) => setValues({ ...values, partySize: Number(e.target.value) })} /></label>
        <label className="text-sm">Start<input required type="datetime-local" className="mt-1 w-full rounded border p-2" value={values.startAt} onChange={(e) => setValues({ ...values, startAt: e.target.value })} /></label>
        <label className="text-sm">Duration (min)<input required min={30} step={15} type="number" className="mt-1 w-full rounded border p-2" value={values.durationMinutes} onChange={(e) => setValues({ ...values, durationMinutes: Number(e.target.value) })} /></label>
        <label className="text-sm">Status<select className="mt-1 w-full rounded border p-2" value={values.reservationStatusId} onChange={(e) => setValues({ ...values, reservationStatusId: e.target.value })}>{props.statuses.map((status) => <option key={status.id} value={status.id}>{status.label}</option>)}</select></label>
        <label className="text-sm">Assigned Tables<select multiple className="mt-1 h-28 w-full rounded border p-2" value={values.tableIds} onChange={(e) => setValues({ ...values, tableIds: Array.from(e.target.selectedOptions).map((opt) => opt.value) })}>{props.tables.map((table) => <option key={table.id} value={table.id}>{table.label}</option>)}</select></label>
      </div>
      <label className="block text-sm">Special Requests<textarea className="mt-1 w-full rounded border p-2" value={values.specialRequests} onChange={(e) => setValues({ ...values, specialRequests: e.target.value })} /></label>
      <label className="block text-sm">Internal Notes<textarea className="mt-1 w-full rounded border p-2" value={values.internalNotes} onChange={(e) => setValues({ ...values, internalNotes: e.target.value })} /></label>
      <button disabled={submitting} className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60" type="submit">{submitting ? 'Saving…' : props.mode === 'create' ? 'Create Reservation' : 'Save Changes'}</button>
    </form>
  );
}
