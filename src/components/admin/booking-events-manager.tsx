'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type BookingEvent = {
  id: string;
  isActive: boolean;
  name: string;
  eventType: 'SINGLE_DATE' | 'WEEKLY_RECURRING' | 'DATE_RANGE';
  singleDate: string | null;
  dateStart: string | null;
  dateEnd: string | null;
  weekdays: number[];
  confirmationMode: 'AUTO_CONFIRM' | 'REQUEST_ONLY' | null;
  placementMode: 'AUTO_ASSIGN' | 'TABLE_SELECTION' | null;
  minPartySize: number | null;
  maxOnlinePartySize: number | null;
  minAdvanceNoticeMinutes: number | null;
  maxDaysAhead: number | null;
  durationMinutes: number | null;
  publicInstructions: string | null;
  publicLabel: string | null;
  allowedAreaIds: string[];
  allowedTableIds: string[];
};

type AreaWithTables = {
  id: string;
  name: string;
  tables: { id: string; name: string }[];
};

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const EMPTY_EVENT: Omit<BookingEvent, 'id'> = {
  isActive: true,
  name: '',
  eventType: 'SINGLE_DATE',
  singleDate: null,
  dateStart: null,
  dateEnd: null,
  weekdays: [],
  confirmationMode: null,
  placementMode: null,
  minPartySize: null,
  maxOnlinePartySize: null,
  minAdvanceNoticeMinutes: null,
  maxDaysAhead: null,
  durationMinutes: null,
  publicInstructions: null,
  publicLabel: null,
  allowedAreaIds: [],
  allowedTableIds: []
};

function toDateInputValue(value: string | null) {
  return value?.slice(0, 10) ?? '';
}

function toCalendarDate(value: string | null) {
  if (!value) return null;
  return value.slice(0, 10);
}

function fromEventToForm(event: BookingEvent): Omit<BookingEvent, 'id'> {
  return {
    isActive: event.isActive,
    name: event.name,
    eventType: event.eventType,
    singleDate: toCalendarDate(event.singleDate),
    dateStart: toCalendarDate(event.dateStart),
    dateEnd: toCalendarDate(event.dateEnd),
    weekdays: event.weekdays,
    confirmationMode: event.confirmationMode,
    placementMode: event.placementMode,
    minPartySize: event.minPartySize,
    maxOnlinePartySize: event.maxOnlinePartySize,
    minAdvanceNoticeMinutes: event.minAdvanceNoticeMinutes,
    maxDaysAhead: event.maxDaysAhead,
    durationMinutes: event.durationMinutes,
    publicInstructions: event.publicInstructions,
    publicLabel: event.publicLabel,
    allowedAreaIds: event.allowedAreaIds,
    allowedTableIds: event.allowedTableIds
  };
}

function eventTypeLabel(type: BookingEvent['eventType']) {
  if (type === 'SINGLE_DATE') return 'Single date';
  if (type === 'DATE_RANGE') return 'Date range';
  return 'Weekly recurring';
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function describeOverrideItem(key: string, value: unknown): string {
  if (key === 'confirmationMode') {
    return value === 'AUTO_CONFIRM' ? 'Auto-confirm' : 'Require approval';
  }
  if (key === 'placementMode') {
    return value === 'AUTO_ASSIGN'
      ? 'Auto-assign table'
      : 'Guest chooses table';
  }
  if (key === 'minPartySize') return `Min party: ${String(value)}`;
  if (key === 'maxOnlinePartySize')
    return `Max party (online): ${String(value)}`;
  if (key === 'minAdvanceNoticeMinutes')
    return `Min notice: ${formatMinutes(value as number)}`;
  if (key === 'maxDaysAhead')
    return `Bookable up to ${String(value)} days ahead`;
  if (key === 'durationMinutes')
    return `Duration: ${formatMinutes(value as number)}`;
  return String(value);
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  );
}

export function BookingEventsManager({ venueId }: { venueId: string }) {
  const [events, setEvents] = useState<BookingEvent[]>([]);
  const [areas, setAreas] = useState<AreaWithTables[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [form, setForm] = useState<Omit<BookingEvent, 'id'>>(EMPTY_EVENT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    text: string;
    kind: 'ok' | 'err';
  } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [eventsRes, areasRes] = await Promise.all([
        fetch(`/api/admin/venues/${venueId}/booking-events`),
        fetch(`/api/admin/areas?venueId=${venueId}`)
      ]);
      const eventsBody = await eventsRes.json();
      const areasBody = await areasRes.json();
      setEvents(eventsBody.events ?? []);
      setAreas(areasBody.areas ?? []);
    } catch {
      setMessage({ text: 'Failed to load data. Please refresh.', kind: 'err' });
    } finally {
      setIsLoading(false);
    }
  }, [venueId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function validateForm(): string | null {
    if (!form.name.trim()) return 'Event name is required.';
    if (form.eventType === 'SINGLE_DATE' && !form.singleDate)
      return 'Select a date.';
    if (form.eventType === 'DATE_RANGE') {
      if (!form.dateStart || !form.dateEnd)
        return 'Select both a start and end date.';
      if (form.dateEnd < form.dateStart)
        return 'End date must be on or after start date.';
    }
    if (form.eventType === 'WEEKLY_RECURRING' && form.weekdays.length === 0) {
      return 'Select at least one day of the week.';
    }
    return null;
  }

  async function saveEvent() {
    setFormError(null);
    setMessage(null);
    const err = validateForm();
    if (err) {
      setFormError(err);
      return;
    }
    try {
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(`/api/admin/venues/${venueId}/booking-events`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, id: editingId ?? undefined })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({
          text: body.error ?? 'Failed to save event.',
          kind: 'err'
        });
        return;
      }
      setForm(EMPTY_EVENT);
      setEditingId(null);
      setMessage({
        text: editingId ? 'Event updated.' : 'Event created.',
        kind: 'ok'
      });
      await loadData();
    } catch {
      setMessage({ text: 'Failed to save event.', kind: 'err' });
    }
  }

  async function removeEvent(id: string) {
    if (!window.confirm('Delete this event? This cannot be undone.')) return;
    try {
      const res = await fetch(
        `/api/admin/venues/${venueId}/booking-events?id=${id}`,
        {
          method: 'DELETE'
        }
      );
      if (!res.ok) {
        setMessage({ text: 'Failed to delete event.', kind: 'err' });
        return;
      }
      setMessage({ text: 'Event deleted.', kind: 'ok' });
      await loadData();
    } catch {
      setMessage({ text: 'Failed to delete event.', kind: 'err' });
    }
  }

  async function duplicateEvent(event: BookingEvent) {
    try {
      const res = await fetch(`/api/admin/venues/${venueId}/booking-events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...fromEventToForm(event),
          name: `${event.name} (Copy)`
        })
      });
      if (!res.ok) {
        setMessage({ text: 'Failed to duplicate event.', kind: 'err' });
        return;
      }
      setMessage({ text: 'Event duplicated.', kind: 'ok' });
      await loadData();
    } catch {
      setMessage({ text: 'Failed to duplicate event.', kind: 'err' });
    }
  }

  async function toggleEventState(event: BookingEvent) {
    try {
      const res = await fetch(`/api/admin/venues/${venueId}/booking-events`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: event.id,
          ...fromEventToForm(event),
          isActive: !event.isActive
        })
      });
      if (!res.ok) {
        setMessage({ text: 'Failed to update event status.', kind: 'err' });
        return;
      }
      setMessage({
        text: event.isActive ? 'Event disabled.' : 'Event enabled.',
        kind: 'ok'
      });
      await loadData();
    } catch {
      setMessage({ text: 'Failed to update event status.', kind: 'err' });
    }
  }

  const describeWhen = useMemo(() => {
    return (event: BookingEvent) => {
      if (event.eventType === 'SINGLE_DATE') {
        return event.singleDate
          ? `On ${event.singleDate.slice(0, 10)}`
          : 'Date missing';
      }
      if (event.eventType === 'DATE_RANGE') {
        return event.dateStart && event.dateEnd
          ? `${event.dateStart.slice(0, 10)} → ${event.dateEnd.slice(0, 10)}`
          : 'Date range incomplete';
      }
      if (!event.weekdays.length) return 'No weekdays selected';
      return `Every ${event.weekdays.map((d) => WEEKDAY_LABELS[d] ?? `Day ${d}`).join(', ')}`;
    };
  }, []);

  const describeOverrides = useMemo(() => {
    return (event: BookingEvent): string[] => {
      const parts: string[] = [];
      if (event.confirmationMode)
        parts.push(
          describeOverrideItem('confirmationMode', event.confirmationMode)
        );
      if (event.placementMode)
        parts.push(describeOverrideItem('placementMode', event.placementMode));
      if (event.minPartySize !== null)
        parts.push(describeOverrideItem('minPartySize', event.minPartySize));
      if (event.maxOnlinePartySize !== null)
        parts.push(
          describeOverrideItem('maxOnlinePartySize', event.maxOnlinePartySize)
        );
      if (event.minAdvanceNoticeMinutes !== null)
        parts.push(
          describeOverrideItem(
            'minAdvanceNoticeMinutes',
            event.minAdvanceNoticeMinutes
          )
        );
      if (event.maxDaysAhead !== null)
        parts.push(describeOverrideItem('maxDaysAhead', event.maxDaysAhead));
      if (event.durationMinutes !== null)
        parts.push(
          describeOverrideItem('durationMinutes', event.durationMinutes)
        );
      if (event.publicLabel) parts.push('Custom public label');
      if (event.publicInstructions) parts.push('Custom public instructions');
      if (event.allowedAreaIds.length) {
        parts.push(
          `${event.allowedAreaIds.length} area restriction${event.allowedAreaIds.length === 1 ? '' : 's'}`
        );
      }
      if (event.allowedTableIds.length) {
        parts.push(
          `${event.allowedTableIds.length} table restriction${event.allowedTableIds.length === 1 ? '' : 's'}`
        );
      }
      return parts;
    };
  }, []);

  function toggleId(list: string[], id: string): string[] {
    return list.includes(id) ? list.filter((v) => v !== id) : [...list, id];
  }

  return (
    <section className="space-y-4 border border-border bg-card p-4">
      {message ? (
        <p
          className={`border p-2 text-sm ${
            message.kind === 'err'
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-border bg-secondary'
          }`}
        >
          {message.text}
        </p>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Event overrides take precedence over default venue settings. When
        multiple events match the same date, more specific events win: Single
        Date beats Date Range (shortest span wins), which beats Weekly
        Recurring.
      </p>

      <div className="space-y-4 rounded border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">
            {editingId ? 'Edit event' : 'Create event'}
          </p>
          {editingId ? (
            <button
              type="button"
              className="rounded border px-2 py-1 text-xs"
              onClick={() => {
                setEditingId(null);
                setForm(EMPTY_EVENT);
                setFormError(null);
              }}
            >
              Cancel edit
            </button>
          ) : null}
        </div>

        {formError ? (
          <p className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
            {formError}
          </p>
        ) : null}

        <div className="space-y-2">
          <SectionLabel>Event name &amp; schedule</SectionLabel>
          <input
            className="w-full rounded border p-2 text-sm"
            placeholder="Event name (e.g. Valentine's Day, Holiday hours)"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <div className="grid gap-2 md:grid-cols-2">
            <select
              className="rounded border p-2 text-sm"
              value={form.eventType}
              onChange={(e) =>
                setForm({
                  ...form,
                  eventType: e.target.value as BookingEvent['eventType']
                })
              }
            >
              <option value="SINGLE_DATE">Single date</option>
              <option value="WEEKLY_RECURRING">Weekly recurring</option>
              <option value="DATE_RANGE">Date range</option>
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) =>
                  setForm({ ...form, isActive: e.target.checked })
                }
              />
              Active (applies to bookings)
            </label>
          </div>

          {form.eventType === 'SINGLE_DATE' ? (
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                Date
              </label>
              <input
                type="date"
                className="rounded border p-2 text-sm"
                value={toDateInputValue(form.singleDate)}
                onChange={(e) =>
                  setForm({ ...form, singleDate: e.target.value || null })
                }
              />
            </div>
          ) : null}

          {form.eventType === 'DATE_RANGE' ? (
            <div className="grid gap-2 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  Start date
                </label>
                <input
                  type="date"
                  className="rounded border p-2 text-sm"
                  value={toDateInputValue(form.dateStart)}
                  onChange={(e) =>
                    setForm({ ...form, dateStart: e.target.value || null })
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  End date
                </label>
                <input
                  type="date"
                  className="rounded border p-2 text-sm"
                  value={toDateInputValue(form.dateEnd)}
                  onChange={(e) =>
                    setForm({ ...form, dateEnd: e.target.value || null })
                  }
                />
              </div>
            </div>
          ) : null}

          {form.eventType === 'WEEKLY_RECURRING' ? (
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                Applies every
              </label>
              <div className="flex flex-wrap gap-2 text-xs">
                {WEEKDAY_LABELS.map((label, index) => (
                  <button
                    key={label}
                    type="button"
                    className={`rounded border px-2 py-1 ${
                      form.weekdays.includes(index)
                        ? 'bg-foreground text-background'
                        : ''
                    }`}
                    onClick={() =>
                      setForm((cur) => ({
                        ...cur,
                        weekdays: cur.weekdays.includes(index)
                          ? cur.weekdays.filter((d) => d !== index)
                          : [...cur.weekdays, index]
                      }))
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          <SectionLabel>
            Booking rules (leave blank to use venue defaults)
          </SectionLabel>
          <div className="grid gap-2 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                Confirmation mode
              </label>
              <select
                className="w-full rounded border p-2 text-sm"
                value={form.confirmationMode ?? ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    confirmationMode: (e.target.value ||
                      null) as BookingEvent['confirmationMode']
                  })
                }
              >
                <option value="">Use venue default</option>
                <option value="AUTO_CONFIRM">Auto-confirm reservations</option>
                <option value="REQUEST_ONLY">Require host approval</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                Table placement
              </label>
              <select
                className="w-full rounded border p-2 text-sm"
                value={form.placementMode ?? ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    placementMode: (e.target.value ||
                      null) as BookingEvent['placementMode']
                  })
                }
              >
                <option value="">Use venue default</option>
                <option value="AUTO_ASSIGN">Auto-assign table</option>
                <option value="TABLE_SELECTION">Let guest choose table</option>
              </select>
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                Min party size
              </label>
              <input
                type="number"
                min={1}
                className="w-full rounded border p-2 text-sm"
                placeholder="e.g. 2"
                value={form.minPartySize ?? ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    minPartySize: e.target.value ? Number(e.target.value) : null
                  })
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                Max party size (online)
              </label>
              <input
                type="number"
                min={1}
                className="w-full rounded border p-2 text-sm"
                placeholder="e.g. 6"
                value={form.maxOnlinePartySize ?? ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    maxOnlinePartySize: e.target.value
                      ? Number(e.target.value)
                      : null
                  })
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                Booking duration (minutes)
              </label>
              <input
                type="number"
                min={15}
                className="w-full rounded border p-2 text-sm"
                placeholder="e.g. 90"
                value={form.durationMinutes ?? ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    durationMinutes: e.target.value
                      ? Number(e.target.value)
                      : null
                  })
                }
              />
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                Minimum advance notice (minutes)
              </label>
              <input
                type="number"
                min={0}
                className="w-full rounded border p-2 text-sm"
                placeholder="e.g. 120 (= 2 hours)"
                value={form.minAdvanceNoticeMinutes ?? ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    minAdvanceNoticeMinutes: e.target.value
                      ? Number(e.target.value)
                      : null
                  })
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                Bookable up to X days ahead
              </label>
              <input
                type="number"
                min={1}
                className="w-full rounded border p-2 text-sm"
                placeholder="e.g. 60"
                value={form.maxDaysAhead ?? ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    maxDaysAhead: e.target.value ? Number(e.target.value) : null
                  })
                }
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <SectionLabel>Guest-facing messaging (optional)</SectionLabel>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              Public label (shown on booking page)
            </label>
            <input
              className="w-full rounded border p-2 text-sm"
              placeholder="e.g. Valentine's Day Menu"
              value={form.publicLabel ?? ''}
              onChange={(e) =>
                setForm({ ...form, publicLabel: e.target.value || null })
              }
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              Public instructions
            </label>
            <textarea
              className="w-full rounded border p-2 text-sm"
              rows={2}
              placeholder="e.g. A fixed prix-fixe menu applies on this date."
              value={form.publicInstructions ?? ''}
              onChange={(e) =>
                setForm({ ...form, publicInstructions: e.target.value || null })
              }
            />
          </div>
        </div>

        {areas.length > 0 ? (
          <div className="space-y-2">
            <SectionLabel>
              Restrict to specific areas / tables (optional)
            </SectionLabel>
            <p className="text-xs text-muted-foreground">
              If selected, only these areas/tables will be available for booking
              during this event. Leave unchecked to allow all.
            </p>
            {areas.map((area) => (
              <div key={area.id} className="rounded border p-2">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={form.allowedAreaIds.includes(area.id)}
                    onChange={() =>
                      setForm((cur) => ({
                        ...cur,
                        allowedAreaIds: toggleId(cur.allowedAreaIds, area.id)
                      }))
                    }
                  />
                  {area.name}
                </label>
                {area.tables.length > 0 ? (
                  <div className="ml-6 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                    {area.tables.map((table) => (
                      <label
                        key={table.id}
                        className="flex items-center gap-1 text-xs text-muted-foreground"
                      >
                        <input
                          type="checkbox"
                          checked={form.allowedTableIds.includes(table.id)}
                          onChange={() =>
                            setForm((cur) => ({
                              ...cur,
                              allowedTableIds: toggleId(
                                cur.allowedTableIds,
                                table.id
                              )
                            }))
                          }
                        />
                        {table.name}
                      </label>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        <button
          type="button"
          onClick={saveEvent}
          className="rounded bg-slate-900 px-3 py-2 text-sm text-white"
        >
          {editingId ? 'Update event' : 'Create event'}
        </button>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold">All events ({events.length})</p>
        {isLoading ? (
          <p className="rounded border border-dashed p-3 text-sm text-muted-foreground">
            Loading…
          </p>
        ) : null}
        {!isLoading && events.length === 0 ? (
          <p className="rounded border border-dashed p-3 text-sm text-muted-foreground">
            No events yet. Create one to override booking rules for a specific
            date, date range, or recurring weekly schedule.
          </p>
        ) : null}
        {events.map((event) => {
          const overrides = describeOverrides(event);
          return (
            <div key={event.id} className="border border-border p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-semibold">{event.name}</p>
                <span
                  className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                    event.isActive
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {event.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {eventTypeLabel(event.eventType)}
                </span>
                {' · '}
                {describeWhen(event)}
              </p>
              {overrides.length > 0 ? (
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                  {overrides.map((o) => (
                    <span
                      key={o}
                      className="text-xs text-muted-foreground before:mr-1 before:content-['·']"
                    >
                      {o}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  No booking overrides configured.
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded border px-2 py-1 text-xs"
                  onClick={() => {
                    setForm(fromEventToForm(event));
                    setEditingId(event.id);
                    setFormError(null);
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="rounded border px-2 py-1 text-xs"
                  onClick={() => duplicateEvent(event)}
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  className="rounded border px-2 py-1 text-xs"
                  onClick={() => toggleEventState(event)}
                >
                  {event.isActive ? 'Disable' : 'Enable'}
                </button>
                <button
                  type="button"
                  className="rounded border px-2 py-1 text-xs text-red-700"
                  onClick={() => removeEvent(event.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
