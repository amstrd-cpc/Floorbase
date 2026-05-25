'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { FloorLayoutDto } from '@/lib/floor-layout/types';
import { formatDateForTimeZone } from '@/lib/timezone';
import {
  FloorLayoutCanvas,
  type PublicTableVisualState
} from './floor-layout-canvas';

type Slot = {
  startAt: string;
  endAt: string;
  localStartAt: string;
  availableTables: Array<{ id: string; name: string; capacityMax: number }>;
  tableStates: Record<string, PublicTableVisualState>;
};

type ResolvedConfig = {
  minPartySize: number;
  maxOnlinePartySize: number;
  placementMode: 'AUTO_ASSIGN' | 'TABLE_SELECTION';
  publicInstructions: string | null;
  publicLabel: string | null;
};

export function PublicBookingForm({
  venueSlug,
  maxOnlinePartySize,
  minPartySize,
  publicInstructions,
  venueTimezone
}: {
  venueSlug: string;
  maxOnlinePartySize: number;
  minPartySize: number;
  publicInstructions: string | null;
  venueTimezone: string;
}) {
  const router = useRouter();
  const [date, setDate] = useState('');
  const [partySize, setPartySize] = useState(Math.max(2, minPartySize));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [layout, setLayout] = useState<FloorLayoutDto | null>(null);
  const [slotId, setSlotId] = useState('');
  const [selectedTableId, setSelectedTableId] = useState('');
  const [resolvedConfig, setResolvedConfig] = useState<ResolvedConfig | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dateMin = useMemo(
    () => formatDateForTimeZone(new Date(), venueTimezone),
    [venueTimezone]
  );

  const selectedSlot = slots.find((slot) => slot.startAt === slotId) ?? null;
  const tableSelectionEnabled =
    resolvedConfig?.placementMode === 'TABLE_SELECTION' && Boolean(selectedSlot);

  async function fetchSlots() {
    if (!date || !partySize) return;

    setLoadingSlots(true);
    setError(null);
    setSlotId('');
    setSelectedTableId('');

    const res = await fetch(
      `/api/public/book/${venueSlug}/slots?date=${encodeURIComponent(date)}&partySize=${partySize}`
    );
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      setSlots([]);
      setLayout(null);
      setError(body.error ?? 'Unable to load available times.');
      setLoadingSlots(false);
      return;
    }

    const nextSlots = (body.slots ?? []) as Slot[];
    setResolvedConfig((body.config ?? null) as ResolvedConfig | null);
    setSlots(nextSlots);
    setLayout((body.layout ?? null) as FloorLayoutDto | null);
    if (nextSlots.length === 0) {
      setError('No openings match that date and party size. Try a different date or party size.');
    }
    setLoadingSlots(false);
  }

  async function submitBooking(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!slotId) {
      setError('Please choose a time.');
      return;
    }
    if (tableSelectionEnabled && !selectedTableId) {
      setError('Please choose a table before continuing.');
      return;
    }

    setSubmitting(true);

    const res = await fetch(`/api/public/book/${venueSlug}/reserve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slotId,
        partySize,
        fullName,
        email,
        phone,
        selectedTableId: selectedTableId || undefined,
        note: note.trim() || undefined,
      }),
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(body.error ?? 'Unable to submit booking.');
      setSubmitting(false);
      return;
    }

    router.push(`/book/${venueSlug}/confirmation?reservationId=${encodeURIComponent(body.reservationId)}`);
  }

  return (
    <form className="space-y-6" onSubmit={submitBooking}>
      {error ? (
        <p className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">{error}</p>
      ) : null}

      <section className="space-y-3">
        <p className="text-sm font-semibold text-slate-900">1. Choose date and party size</p>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            Date
            <input
              type="date"
              min={dateMin}
              className="mt-1 w-full rounded border p-2"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
          <label className="text-sm">
            Party size
            <input
              type="number"
              min={resolvedConfig?.minPartySize ?? minPartySize}
              max={resolvedConfig?.maxOnlinePartySize ?? maxOnlinePartySize}
              className="mt-1 w-full rounded border p-2"
              value={partySize}
              onChange={(event) => setPartySize(Number(event.target.value))}
            />
          </label>
        </div>
        <p className="text-xs text-slate-500">
          {resolvedConfig?.publicLabel ??
            `Online bookings support ${resolvedConfig?.minPartySize ?? minPartySize} to ${resolvedConfig?.maxOnlinePartySize ?? maxOnlinePartySize} guests.`}
        </p>
        {(resolvedConfig?.publicInstructions ?? publicInstructions) ? (
          <p className="rounded border border-slate-200 bg-slate-50 p-2 text-sm text-slate-700">
            {resolvedConfig?.publicInstructions ?? publicInstructions}
          </p>
        ) : null}
        <button
          type="button"
          onClick={fetchSlots}
          className="rounded bg-slate-900 px-4 py-2 text-sm text-white"
          disabled={loadingSlots}
        >
          {loadingSlots ? 'Loading...' : 'Check availability'}
        </button>
      </section>

      {slots.length > 0 ? (
        <section className="space-y-3">
          <p className="text-sm font-semibold text-slate-900">2. Select a time ({venueTimezone})</p>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {slots.map((availableSlot) => {
              const label = availableSlot.localStartAt.slice(11, 16);
              return (
                <button
                  key={availableSlot.startAt}
                  type="button"
                  className={`rounded border px-3 py-2 text-sm ${slotId === availableSlot.startAt ? 'border-slate-900 bg-slate-100' : 'border-slate-200'}`}
                  onClick={() => {
                    setSlotId(availableSlot.startAt);
                    setSelectedTableId('');
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {tableSelectionEnabled ? (
        <section className="space-y-3">
          <p className="text-sm font-semibold text-slate-900">3. Choose your table</p>
          <p className="text-xs text-slate-500">
            Green tables are available. Red tables are already booked for this time.
          </p>
          {layout ? (
            <>
              <FloorLayoutCanvas
                layout={layout}
                selectedTableId={selectedTableId || null}
                tableStates={selectedSlot?.tableStates ?? {}}
                onSelectTable={(tableId) =>
                  setSelectedTableId((current) => (current === tableId ? '' : tableId))
                }
              />
              <input
                type="text"
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
                value={selectedTableId}
                readOnly
                required
              />
            </>
          ) : (
            <label className="block text-sm">
              Select table
              <select
                className="mt-1 w-full rounded border p-2"
                value={selectedTableId}
                onChange={(event) => setSelectedTableId(event.target.value)}
                required
              >
                <option value="">Choose a table</option>
                {(selectedSlot?.availableTables ?? []).map((table) => (
                  <option key={table.id} value={table.id}>
                    {table.name} (up to {table.capacityMax})
                  </option>
                ))}
              </select>
            </label>
          )}
        </section>
      ) : null}

      <section className="space-y-3">
        <p className="text-sm font-semibold text-slate-900">
          {tableSelectionEnabled ? '4.' : '3.'} Enter your details
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            Full name
            <input
              className="mt-1 w-full rounded border p-2"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              required
            />
          </label>
          <label className="text-sm">
            Phone
            <input
              className="mt-1 w-full rounded border p-2"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              required
            />
          </label>
        </div>

        <label className="block text-sm">
          Email
          <input
            type="email"
            className="mt-1 w-full rounded border p-2"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>

        <label className="block text-sm">
          Note (optional)
          <textarea
            className="mt-1 w-full rounded border p-2"
            rows={3}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>

        <button
          className="rounded bg-emerald-600 px-4 py-2 text-sm text-white"
          disabled={submitting}
        >
          {submitting ? 'Submitting...' : 'Book now'}
        </button>
      </section>
    </form>
  );
}
