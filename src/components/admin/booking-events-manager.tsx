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
  if (type === 'SINGLE_DATE') return 'Single Date';
  if (type === 'DATE_RANGE') return 'Date Range';
  return 'Weekly Recurring';
}

export function BookingEventsManager({ venueId }: { venueId: string }) {
  const [events, setEvents] = useState<BookingEvent[]>([]);
  const [form, setForm] = useState<Omit<BookingEvent, 'id'>>(EMPTY_EVENT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    const res = await fetch(`/api/admin/venues/${venueId}/booking-events`);
    const body = await res.json();
    setEvents(body.events ?? []);
  }, [venueId]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const describeWhen = useMemo(() => {
    return (event: BookingEvent) => {
      if (event.eventType === 'SINGLE_DATE') {
        return event.singleDate ? `Applies on ${event.singleDate.slice(0, 10)}` : 'Date missing';
      }
      if (event.eventType === 'DATE_RANGE') {
        return event.dateStart && event.dateEnd
          ? `Applies ${event.dateStart.slice(0, 10)} to ${event.dateEnd.slice(0, 10)}`
          : 'Date range incomplete';
      }

      if (!event.weekdays.length) {
        return 'No weekdays selected';
      }

      return `Applies weekly on ${event.weekdays
        .map((dayIndex) => WEEKDAY_LABELS[dayIndex] ?? `Day ${dayIndex}`)
        .join(', ')}`;
    };
  }, []);

  const describeOverrides = useMemo(() => {
    return (event: BookingEvent) => {
      const overrides: string[] = [];
      if (event.confirmationMode) {
        overrides.push(
          `confirmation ${event.confirmationMode === 'AUTO_CONFIRM' ? 'auto-confirm' : 'request-only'}`
        );
      }
      if (event.placementMode) {
        overrides.push(
          `placement ${event.placementMode === 'AUTO_ASSIGN' ? 'auto-assign' : 'table-selection'}`
        );
      }
      if (event.minPartySize !== null) overrides.push(`min party ${event.minPartySize}`);
      if (event.maxOnlinePartySize !== null) {
        overrides.push(`max online party ${event.maxOnlinePartySize}`);
      }
      if (event.minAdvanceNoticeMinutes !== null) {
        overrides.push(`min notice ${event.minAdvanceNoticeMinutes}m`);
      }
      if (event.maxDaysAhead !== null) overrides.push(`max days ahead ${event.maxDaysAhead}`);
      if (event.durationMinutes !== null) overrides.push(`duration ${event.durationMinutes}m`);
      if (event.publicLabel) overrides.push('public label');
      if (event.publicInstructions) overrides.push('public instructions');
      if (event.allowedAreaIds.length) overrides.push(`${event.allowedAreaIds.length} area filters`);
      if (event.allowedTableIds.length) overrides.push(`${event.allowedTableIds.length} table filters`);
      return overrides.join(' · ') || 'No booking overrides configured';
    };
  }, []);

  async function saveEvent() {
    setMessage(null);
    const method = editingId ? 'PUT' : 'POST';
    const res = await fetch(`/api/admin/venues/${venueId}/booking-events`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, id: editingId ?? undefined })
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(body.error ?? 'Failed to save event.');
      return;
    }
    setForm(EMPTY_EVENT);
    setEditingId(null);
    setMessage(editingId ? 'Event updated.' : 'Event created.');
    await loadEvents();
  }

  async function removeEvent(id: string) {
    const res = await fetch(`/api/admin/venues/${venueId}/booking-events?id=${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) {
      setMessage('Failed to delete event.');
      return;
    }
    setMessage('Event deleted.');
    await loadEvents();
  }

  async function duplicateEvent(event: BookingEvent) {
    const duplicateName = `${event.name} (Copy)`;
    const res = await fetch(`/api/admin/venues/${venueId}/booking-events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...fromEventToForm(event), name: duplicateName })
    });
    if (!res.ok) {
      setMessage('Failed to duplicate event.');
      return;
    }
    setMessage('Event duplicated.');
    await loadEvents();
  }

  async function toggleEventState(event: BookingEvent) {
    const res = await fetch(`/api/admin/venues/${venueId}/booking-events`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: event.id, ...fromEventToForm(event), isActive: !event.isActive })
    });
    if (!res.ok) {
      setMessage('Failed to update event status.');
      return;
    }
    setMessage(event.isActive ? 'Event disabled.' : 'Event enabled.');
    await loadEvents();
  }

  return (
    <section className="space-y-4 rounded-lg border bg-white p-4">
      {message ? <p className="rounded border p-2 text-sm">{message}</p> : null}
      <p className="text-xs text-slate-500">
        Event overrides always take precedence over default venue settings. If multiple events match the same booking date, precedence is: Single Date, then Date Range, then Weekly Recurring. For the same type, the most recently created event wins.
      </p>

      <div className="space-y-3 rounded border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">{editingId ? 'Edit event' : 'Create event'}</p>
          {editingId ? (
            <button
              type="button"
              className="rounded border px-2 py-1 text-xs"
              onClick={() => {
                setEditingId(null);
                setForm(EMPTY_EVENT);
              }}
            >
              Cancel edit
            </button>
          ) : null}
        </div>
        <input className="w-full rounded border p-2 text-sm" placeholder="Event name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <div className="grid gap-2 md:grid-cols-2">
          <select className="rounded border p-2 text-sm" value={form.eventType} onChange={(e) => setForm({ ...form, eventType: e.target.value as BookingEvent['eventType'] })}>
            <option value="SINGLE_DATE">Single date</option>
            <option value="WEEKLY_RECURRING">Weekly recurring</option>
            <option value="DATE_RANGE">Date range</option>
          </select>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />Active</label>
        </div>
        {form.eventType === 'SINGLE_DATE' ? <input type="date" className="rounded border p-2 text-sm" value={toDateInputValue(form.singleDate)} onChange={(e) => setForm({ ...form, singleDate: e.target.value || null })} /> : null}
        {form.eventType === 'DATE_RANGE' ? <div className="grid gap-2 md:grid-cols-2"><input type="date" className="rounded border p-2 text-sm" value={toDateInputValue(form.dateStart)} onChange={(e) => setForm({ ...form, dateStart: e.target.value || null })} /><input type="date" className="rounded border p-2 text-sm" value={toDateInputValue(form.dateEnd)} onChange={(e) => setForm({ ...form, dateEnd: e.target.value || null })} /></div> : null}
        {form.eventType === 'WEEKLY_RECURRING' ? (
          <div className="flex flex-wrap gap-2 text-xs">
            {WEEKDAY_LABELS.map((label, index) => <button key={label} type="button" className={`rounded border px-2 py-1 ${form.weekdays.includes(index) ? 'bg-slate-900 text-white' : ''}`} onClick={() => setForm((cur) => ({ ...cur, weekdays: cur.weekdays.includes(index) ? cur.weekdays.filter((d) => d !== index) : [...cur.weekdays, index] }))}>{label}</button>)}
          </div>
        ) : null}
        <div className="grid gap-2 md:grid-cols-2">
          <select className="rounded border p-2 text-sm" value={form.confirmationMode ?? ''} onChange={(e) => setForm({ ...form, confirmationMode: (e.target.value || null) as BookingEvent['confirmationMode'] })}><option value="">Confirmation override</option><option value="AUTO_CONFIRM">AUTO_CONFIRM</option><option value="REQUEST_ONLY">REQUEST_ONLY</option></select>
          <select className="rounded border p-2 text-sm" value={form.placementMode ?? ''} onChange={(e) => setForm({ ...form, placementMode: (e.target.value || null) as BookingEvent['placementMode'] })}><option value="">Placement override</option><option value="AUTO_ASSIGN">AUTO_ASSIGN</option><option value="TABLE_SELECTION">TABLE_SELECTION</option></select>
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          <input type="number" className="rounded border p-2 text-sm" placeholder="Min party" value={form.minPartySize ?? ''} onChange={(e) => setForm({ ...form, minPartySize: e.target.value ? Number(e.target.value) : null })} />
          <input type="number" className="rounded border p-2 text-sm" placeholder="Max online party" value={form.maxOnlinePartySize ?? ''} onChange={(e) => setForm({ ...form, maxOnlinePartySize: e.target.value ? Number(e.target.value) : null })} />
          <input type="number" className="rounded border p-2 text-sm" placeholder="Duration mins" value={form.durationMinutes ?? ''} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value ? Number(e.target.value) : null })} />
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <input type="number" className="rounded border p-2 text-sm" placeholder="Min notice mins" value={form.minAdvanceNoticeMinutes ?? ''} onChange={(e) => setForm({ ...form, minAdvanceNoticeMinutes: e.target.value ? Number(e.target.value) : null })} />
          <input type="number" className="rounded border p-2 text-sm" placeholder="Max days ahead" value={form.maxDaysAhead ?? ''} onChange={(e) => setForm({ ...form, maxDaysAhead: e.target.value ? Number(e.target.value) : null })} />
        </div>
        <input className="w-full rounded border p-2 text-sm" placeholder="Public label" value={form.publicLabel ?? ''} onChange={(e) => setForm({ ...form, publicLabel: e.target.value || null })} />
        <textarea className="w-full rounded border p-2 text-sm" rows={2} placeholder="Public instructions" value={form.publicInstructions ?? ''} onChange={(e) => setForm({ ...form, publicInstructions: e.target.value || null })} />
        <input className="w-full rounded border p-2 text-sm" placeholder="Allowed area IDs (comma separated)" value={form.allowedAreaIds.join(',')} onChange={(e) => setForm({ ...form, allowedAreaIds: e.target.value.split(',').map((v) => v.trim()).filter(Boolean) })} />
        <input className="w-full rounded border p-2 text-sm" placeholder="Allowed table IDs (comma separated)" value={form.allowedTableIds.join(',')} onChange={(e) => setForm({ ...form, allowedTableIds: e.target.value.split(',').map((v) => v.trim()).filter(Boolean) })} />
        <button type="button" onClick={saveEvent} className="rounded bg-slate-900 px-3 py-2 text-sm text-white">{editingId ? 'Update event' : 'Create event'}</button>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold">All events ({events.length})</p>
        {events.length === 0 ? <p className="rounded border border-dashed p-3 text-sm text-slate-500">No events yet. Create one to override booking behavior for a date, date range, or recurring weekly schedule.</p> : null}
        {events.map((event) => (
          <div key={event.id} className="rounded border p-3 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">{event.name}</p>
                <p className="text-xs text-slate-600">{event.isActive ? 'Active' : 'Inactive'} · {eventTypeLabel(event.eventType)}</p>
              </div>
            </div>
            <p className="mt-1 text-xs text-slate-600">When: {describeWhen(event)}</p>
            <p className="mt-1 text-xs text-slate-600">Overrides: {describeOverrides(event)}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className="rounded border px-2 py-1" onClick={() => { setForm(fromEventToForm(event)); setEditingId(event.id); }}>Edit</button>
              <button type="button" className="rounded border px-2 py-1" onClick={() => duplicateEvent(event)}>Duplicate</button>
              <button type="button" className="rounded border px-2 py-1" onClick={() => toggleEventState(event)}>{event.isActive ? 'Disable' : 'Enable'}</button>
              <button type="button" className="rounded border px-2 py-1" onClick={() => removeEvent(event.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
