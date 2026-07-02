'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/client/api';
import {
  MAX_PARTY_SIZE,
  MAX_RESERVATION_DURATION_MINUTES,
  MIN_RESERVATION_DURATION_MINUTES,
  RESERVATION_SLOT_MINUTES
} from '@/lib/reservations/rules';

type Option = {
  id: string;
  label: string;
  code?: string;
  capacityMin?: number | null;
  capacityMax?: number;
  isActive?: boolean;
};

type ReservationFormValues = {
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

type ReservationFormProps = {
  mode: 'create' | 'edit';
  organizationId: string;
  venueId: string;
  statuses: Option[];
  tables: Option[];
  reservationId?: string;
  initialValues?: ReservationFormValues;
};

function roundToNextSlot(now: Date) {
  const result = new Date(now);
  result.setSeconds(0, 0);

  const currentMinutes = result.getMinutes();
  const roundedMinutes =
    Math.ceil(currentMinutes / RESERVATION_SLOT_MINUTES) *
    RESERVATION_SLOT_MINUTES;
  result.setMinutes(roundedMinutes);

  return result;
}

function validateForm(values: ReservationFormValues) {
  const errors: string[] = [];

  if (!values.fullName.trim()) {
    errors.push('Guest name is required.');
  }

  if (!values.email.trim() && !values.phone.trim()) {
    errors.push('Provide at least one guest contact method (email or phone).');
  }

  if (values.partySize < 1 || values.partySize > MAX_PARTY_SIZE) {
    errors.push(`Party size must be between 1 and ${MAX_PARTY_SIZE}.`);
  }

  if (
    values.durationMinutes < MIN_RESERVATION_DURATION_MINUTES ||
    values.durationMinutes > MAX_RESERVATION_DURATION_MINUTES
  ) {
    errors.push(
      `Duration must be between ${MIN_RESERVATION_DURATION_MINUTES} and ${MAX_RESERVATION_DURATION_MINUTES} minutes.`
    );
  }

  if (values.durationMinutes % RESERVATION_SLOT_MINUTES !== 0) {
    errors.push(
      `Duration must be in ${RESERVATION_SLOT_MINUTES}-minute increments.`
    );
  }

  if (values.tableIds.length === 0) {
    errors.push('Assign at least one table.');
  }

  const startAt = new Date(values.startAt);
  if (Number.isNaN(startAt.getTime())) {
    errors.push('Start time is invalid.');
  } else if (startAt.getUTCMinutes() % RESERVATION_SLOT_MINUTES !== 0) {
    errors.push(
      `Start time must align to ${RESERVATION_SLOT_MINUTES}-minute slots.`
    );
  }

  return errors;
}

function isTableCompatible(option: Option, partySize: number) {
  const min = option.capacityMin ?? 1;
  const max = option.capacityMax ?? MAX_PARTY_SIZE;

  return partySize >= min && partySize <= max;
}

export function ReservationForm(props: ReservationFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [availabilityNote, setAvailabilityNote] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const availabilitySeqRef = useRef(0);
  const [values, setValues] = useState<ReservationFormValues>(
    props.initialValues ?? {
      fullName: '',
      email: '',
      phone: '',
      startAt: roundToNextSlot(new Date()).toISOString().slice(0, 16),
      durationMinutes: 90,
      partySize: 2,
      reservationStatusId: props.statuses[0]?.id ?? '',
      tableIds: [],
      specialRequests: '',
      internalNotes: ''
    }
  );

  const incompatibleSelected = useMemo(
    () =>
      props.tables
        .filter((table) => values.tableIds.includes(table.id))
        .filter((table) => !isTableCompatible(table, values.partySize)),
    [props.tables, values.partySize, values.tableIds]
  );

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const clientErrors = validateForm(values);
    if (clientErrors.length > 0) {
      setError(clientErrors.join(' '));
      setSubmitting(false);
      return;
    }

    const startAt = new Date(values.startAt);
    const endAt = new Date(startAt.getTime() + values.durationMinutes * 60000);

    const payload = {
      venueId: props.venueId,
      reservationDate: startAt.toISOString(),
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      durationMinutes: values.durationMinutes,
      partySize: values.partySize,
      reservationStatusId: values.reservationStatusId || undefined,
      tableIds: values.tableIds,
      guest: {
        fullName: values.fullName,
        email: values.email || null,
        phone: values.phone || null
      },
      specialRequests: values.specialRequests || null,
      internalNotes: values.internalNotes || null
    };

    const url =
      props.mode === 'create'
        ? '/api/admin/reservations'
        : `/api/admin/reservations/${props.reservationId}?organizationId=${props.organizationId}`;
    const method = props.mode === 'create' ? 'POST' : 'PUT';

    try {
      const body = await apiFetch<{ reservation?: { id?: string } }>(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const reservationId = body.reservation?.id ?? props.reservationId;
      router.push(`/admin/reservations/${reservationId}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Unable to save reservation.');
    } finally {
      setSubmitting(false);
    }
  }

  async function checkAvailability() {
    const seq = ++availabilitySeqRef.current;
    setCheckingAvailability(true);
    setAvailabilityNote(null);
    const startAt = new Date(values.startAt);
    if (Number.isNaN(startAt.getTime())) {
      setAvailabilityNote('Choose a valid start time to check availability.');
      setCheckingAvailability(false);
      return;
    }
    const params = new URLSearchParams({
      venueId: props.venueId,
      startAt: startAt.toISOString(),
      durationMinutes: String(values.durationMinutes),
      partySize: String(values.partySize)
    });
    if (props.mode === 'edit' && props.reservationId) {
      params.set('reservationIdToExclude', props.reservationId);
    }
    try {
      const body = await apiFetch<{
        reason?: string;
        recommendedTableIds?: string[];
        availableTables?: Array<{ id: string; name: string; capacityMax: number }>;
      }>(`/api/admin/reservations/availability?${params.toString()}`);
      if (seq !== availabilitySeqRef.current) return;
      if (body.recommendedTableIds && body.recommendedTableIds.length > 0) {
        setValues((previous) => ({ ...previous, tableIds: body.recommendedTableIds ?? [] }));
        setAvailabilityNote(`Found availability. Recommended tables have been selected (${body.recommendedTableIds!.length}).`);
        return;
      }
      const availableCount = body.availableTables?.length ?? 0;
      setAvailabilityNote(
        availableCount > 0
          ? `No exact recommendation found, but ${availableCount} table(s) are free.`
          : `No availability for this time. ${body.reason ? `Reason: ${body.reason}.` : ''}`
      );
    } catch (e) {
      if (seq !== availabilitySeqRef.current) return;
      setAvailabilityNote(e instanceof ApiError ? e.message : 'Unable to check availability right now.');
    } finally {
      if (seq === availabilitySeqRef.current) setCheckingAvailability(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 border border-border bg-card p-4 md:p-6"
    >
      {error ? (
        <p className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {availabilityNote ? (
        <p className="rounded border border-blue-200 bg-blue-50 p-2 text-sm text-blue-800">
          {availabilityNote}
        </p>
      ) : null}
      {incompatibleSelected.length > 0 ? (
        <p className="rounded border border-amber-200 bg-amber-50 p-2 text-sm text-amber-800">
          Selected table(s) outside party-size range:{' '}
          {incompatibleSelected.map((table) => table.label).join(', ')}.
        </p>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm">
          Guest Name
          <input
            required
            className="mt-1 w-full rounded border p-2"
            value={values.fullName}
            onChange={(e) => setValues({ ...values, fullName: e.target.value })}
          />
        </label>
        <label className="text-sm">
          Email
          <input
            type="email"
            className="mt-1 w-full rounded border p-2"
            value={values.email}
            onChange={(e) => setValues({ ...values, email: e.target.value })}
          />
        </label>
        <label className="text-sm">
          Phone
          <input
            className="mt-1 w-full rounded border p-2"
            value={values.phone}
            onChange={(e) => setValues({ ...values, phone: e.target.value })}
          />
        </label>
        <label className="text-sm">
          Party Size
          <input
            required
            min={1}
            max={MAX_PARTY_SIZE}
            type="number"
            className="mt-1 w-full rounded border p-2"
            value={values.partySize}
            onChange={(e) =>
              setValues({ ...values, partySize: Number(e.target.value) })
            }
          />
        </label>
        <label className="text-sm">
          Start
          <input
            required
            step={RESERVATION_SLOT_MINUTES * 60}
            type="datetime-local"
            className="mt-1 w-full rounded border p-2"
            value={values.startAt}
            onChange={(e) => setValues({ ...values, startAt: e.target.value })}
          />
        </label>
        <label className="text-sm">
          Duration (min)
          <input
            required
            min={MIN_RESERVATION_DURATION_MINUTES}
            max={MAX_RESERVATION_DURATION_MINUTES}
            step={RESERVATION_SLOT_MINUTES}
            type="number"
            className="mt-1 w-full rounded border p-2"
            value={values.durationMinutes}
            onChange={(e) =>
              setValues({ ...values, durationMinutes: Number(e.target.value) })
            }
          />
        </label>
        <label className="text-sm">
          Status
          <select
            className="mt-1 w-full rounded border p-2"
            value={values.reservationStatusId}
            onChange={(e) =>
              setValues({ ...values, reservationStatusId: e.target.value })
            }
          >
            {props.statuses.map((status) => (
              <option key={status.id} value={status.id}>
                {status.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Assigned Tables
          <select
            required
            multiple
            className="mt-1 h-36 w-full rounded border p-2"
            value={values.tableIds}
            onChange={(e) =>
              setValues({
                ...values,
                tableIds: Array.from(e.target.selectedOptions).map(
                  (opt) => opt.value
                )
              })
            }
          >
            {props.tables.map((table) => {
              const compatible = isTableCompatible(table, values.partySize);

              return (
                <option key={table.id} value={table.id}>
                  {compatible ? '' : '⚠ '} {table.label}
                </option>
              );
            })}
          </select>
        </label>
      </div>
      <button
        type="button"
        onClick={checkAvailability}
        disabled={checkingAvailability}
        className="rounded border px-3 py-2 text-sm"
      >
        {checkingAvailability ? 'Checking…' : 'Check Availability / Suggest Tables'}
      </button>
      <label className="block text-sm">
        Guest Notes / Special Requests
        <textarea
          className="mt-1 w-full rounded border p-2"
          value={values.specialRequests}
          onChange={(e) =>
            setValues({ ...values, specialRequests: e.target.value })
          }
        />
      </label>
      <label className="block text-sm">
        Internal Notes (staff only)
        <textarea
          className="mt-1 w-full rounded border p-2"
          value={values.internalNotes}
          onChange={(e) =>
            setValues({ ...values, internalNotes: e.target.value })
          }
        />
      </label>
      <button
        disabled={submitting}
        className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        type="submit"
      >
        {submitting
          ? 'Saving…'
          : props.mode === 'create'
            ? 'Create Reservation'
            : 'Save Changes'}
      </button>
    </form>
  );
}
