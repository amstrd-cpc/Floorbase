'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { FloorLayoutDto } from '@/lib/floor-layout/types';
import { apiFetch, ApiError } from '@/lib/client/api';
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

const bookInput =
  'mt-1.5 w-full border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:border-foreground focus:ring-1 focus:ring-foreground';
const stepEyebrow = 'font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground';
const primaryBtn =
  'bg-foreground px-4 py-2.5 text-[13px] font-semibold text-background transition hover:opacity-85 disabled:opacity-50';

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

    try {
      const body = await apiFetch<{ slots?: Slot[]; config?: ResolvedConfig; layout?: FloorLayoutDto }>(
        `/api/public/book/${venueSlug}/slots?date=${encodeURIComponent(date)}&partySize=${partySize}`
      );
      const nextSlots = (body.slots ?? []) as Slot[];
      setResolvedConfig((body.config ?? null) as ResolvedConfig | null);
      setSlots(nextSlots);
      setLayout((body.layout ?? null) as FloorLayoutDto | null);
      if (nextSlots.length === 0) {
        setError('No openings match that date and party size. Try a different date or party size.');
      }
    } catch (e) {
      setSlots([]);
      setLayout(null);
      setError(e instanceof ApiError ? e.message : 'Unable to load available times.');
    } finally {
      setLoadingSlots(false);
    }
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
    try {
      const data = await apiFetch<{ reservationId: string }>(`/api/public/book/${venueSlug}/reserve`, {
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
      router.push(`/book/${venueSlug}/confirmation?reservationId=${encodeURIComponent(data.reservationId)}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Unable to submit booking.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="space-y-8" onSubmit={submitBooking}>
      {error ? (
        <div className="border border-foreground bg-secondary px-3.5 py-3">
          <div className={stepEyebrow}>Notice</div>
          <p className="mt-1 text-[13px] leading-relaxed text-foreground">{error}</p>
        </div>
      ) : null}

      <section className="space-y-3">
        <p className={stepEyebrow}>Step 01 — Date &amp; party size</p>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block text-[13px] font-medium">
            Date
            <input
              type="date"
              min={dateMin}
              className={bookInput}
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
          <label className="block text-[13px] font-medium">
            Party size
            <input
              type="number"
              min={resolvedConfig?.minPartySize ?? minPartySize}
              max={resolvedConfig?.maxOnlinePartySize ?? maxOnlinePartySize}
              className={bookInput}
              value={partySize}
              onChange={(event) => setPartySize(Number(event.target.value))}
            />
          </label>
        </div>
        <p className="text-xs text-muted-foreground">
          {resolvedConfig?.publicLabel ??
            `Online bookings support ${resolvedConfig?.minPartySize ?? minPartySize} to ${resolvedConfig?.maxOnlinePartySize ?? maxOnlinePartySize} guests.`}
        </p>
        {(resolvedConfig?.publicInstructions ?? publicInstructions) ? (
          <p className="border border-border bg-secondary p-3 text-sm text-muted-foreground">
            {resolvedConfig?.publicInstructions ?? publicInstructions}
          </p>
        ) : null}
        <button
          type="button"
          onClick={fetchSlots}
          className={primaryBtn}
          disabled={loadingSlots}
        >
          {loadingSlots ? 'Loading…' : 'Check availability'}
        </button>
      </section>

      {slots.length > 0 ? (
        <section className="space-y-3">
          <p className={stepEyebrow}>Step 02 — Select a time · {venueTimezone}</p>
          <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4 md:grid-cols-6">
            {slots.map((availableSlot) => {
              const label = availableSlot.localStartAt.slice(11, 16);
              const active = slotId === availableSlot.startAt;
              return (
                <button
                  key={availableSlot.startAt}
                  type="button"
                  className={`px-3 py-2.5 text-[13px] font-medium tabular-nums transition ${
                    active
                      ? 'bg-foreground text-background'
                      : 'bg-background text-foreground hover:bg-secondary'
                  }`}
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
          <p className={stepEyebrow}>Step 03 — Choose your table</p>
          <p className="text-xs text-muted-foreground">
            Outlined tables are open. Shaded tables are already taken for this time.
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
            <label className="block text-[13px] font-medium">
              Select table
              <select
                className={bookInput}
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
        <p className={stepEyebrow}>
          {tableSelectionEnabled ? 'Step 04' : 'Step 03'} — Your details
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block text-[13px] font-medium">
            Full name
            <input
              className={bookInput}
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              required
            />
          </label>
          <label className="block text-[13px] font-medium">
            Phone
            <input
              className={bookInput}
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              required
            />
          </label>
        </div>

        <label className="block text-[13px] font-medium">
          Email
          <input
            type="email"
            className={bookInput}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>

        <label className="block text-[13px] font-medium">
          Note (optional)
          <textarea
            className={bookInput}
            rows={3}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>

        <button className={primaryBtn} disabled={submitting}>
          {submitting ? 'Submitting…' : 'Book now'}
        </button>
      </section>
    </form>
  );
}
