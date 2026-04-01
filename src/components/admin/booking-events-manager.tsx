'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type BookingEvent = {
  id: string;
  isActive: boolean;
  name: string;
  priority: number;
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

const EMPTY_EVENT: Omit<BookingEvent, 'id'> = {
  isActive: true,
  name: '',
  priority: 100,
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

  const overrideSummary = useMemo(() => {
    return (event: BookingEvent) => {
      const overrides: string[] = [];
      if (event.confirmationMode) overrides.push(`confirmation:${event.confirmationMode}`);
      if (event.placementMode) overrides.push(`placement:${event.placementMode}`);
      if (event.minPartySize) overrides.push(`minParty:${event.minPartySize}`);
      if (event.maxOnlinePartySize) overrides.push(`maxParty:${event.maxOnlinePartySize}`);
      if (event.durationMinutes) overrides.push(`duration:${event.durationMinutes}m`);
      if (event.publicLabel) overrides.push('label');
      if (event.publicInstructions) overrides.push('instructions');
      if (event.allowedAreaIds.length) overrides.push('areas');
      if (event.allowedTableIds.length) overrides.push('tables');
      return overrides.join(', ') || 'No overrides';
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
    setMessage('Event saved.');
    await loadEvents();
  }

  async function removeEvent(id: string) {
    await fetch(`/api/admin/venues/${venueId}/booking-events?id=${id}`, {
      method: 'DELETE'
    });
    await loadEvents();
  }

  return (
    <section className="space-y-3 rounded-lg border bg-white p-4 md:max-w-3xl">
      <h3 className="text-lg font-semibold">Events</h3>
      {message ? <p className="rounded border p-2 text-sm">{message}</p> : null}
      <div className="space-y-2 rounded border p-3">
        <p className="text-sm font-medium">{editingId ? 'Edit Event' : 'Create Event'}</p>
        <input className="w-full rounded border p-2 text-sm" placeholder="Event name" value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} />
        <div className="grid gap-2 md:grid-cols-3">
          <select className="rounded border p-2 text-sm" value={form.eventType} onChange={(e)=>setForm({...form,eventType:e.target.value as BookingEvent['eventType']})}>
            <option value="SINGLE_DATE">Single date</option>
            <option value="WEEKLY_RECURRING">Weekly recurring</option>
            <option value="DATE_RANGE">Date range</option>
          </select>
          <input type="number" className="rounded border p-2 text-sm" value={form.priority} onChange={(e)=>setForm({...form,priority:Number(e.target.value)})} placeholder="Priority"/>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isActive} onChange={(e)=>setForm({...form,isActive:e.target.checked})}/>Active</label>
        </div>
        {form.eventType === 'SINGLE_DATE' ? <input type="date" className="rounded border p-2 text-sm" value={form.singleDate?.slice(0,10) ?? ''} onChange={(e)=>setForm({...form,singleDate:e.target.value||null})}/> : null}
        {form.eventType === 'DATE_RANGE' ? <div className="grid gap-2 md:grid-cols-2"><input type="date" className="rounded border p-2 text-sm" value={form.dateStart?.slice(0,10) ?? ''} onChange={(e)=>setForm({...form,dateStart:e.target.value||null})}/><input type="date" className="rounded border p-2 text-sm" value={form.dateEnd?.slice(0,10) ?? ''} onChange={(e)=>setForm({...form,dateEnd:e.target.value||null})}/></div> : null}
        {form.eventType === 'WEEKLY_RECURRING' ? (
          <div className="flex flex-wrap gap-2 text-xs">
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((label,index)=><button key={label} type="button" className={`rounded border px-2 py-1 ${form.weekdays.includes(index)?'bg-slate-900 text-white':''}`} onClick={()=>setForm((cur)=>({...cur,weekdays:cur.weekdays.includes(index)?cur.weekdays.filter((d)=>d!==index):[...cur.weekdays,index]}))}>{label}</button>)}
          </div>
        ) : null}
        <div className="grid gap-2 md:grid-cols-2">
          <select className="rounded border p-2 text-sm" value={form.confirmationMode ?? ''} onChange={(e)=>setForm({...form,confirmationMode:(e.target.value||null) as BookingEvent['confirmationMode']})}><option value="">Confirmation override</option><option value="AUTO_CONFIRM">AUTO_CONFIRM</option><option value="REQUEST_ONLY">REQUEST_ONLY</option></select>
          <select className="rounded border p-2 text-sm" value={form.placementMode ?? ''} onChange={(e)=>setForm({...form,placementMode:(e.target.value||null) as BookingEvent['placementMode']})}><option value="">Placement override</option><option value="AUTO_ASSIGN">AUTO_ASSIGN</option><option value="TABLE_SELECTION">TABLE_SELECTION</option></select>
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          <input type="number" className="rounded border p-2 text-sm" placeholder="Min party" value={form.minPartySize ?? ''} onChange={(e)=>setForm({...form,minPartySize:e.target.value?Number(e.target.value):null})}/>
          <input type="number" className="rounded border p-2 text-sm" placeholder="Max online party" value={form.maxOnlinePartySize ?? ''} onChange={(e)=>setForm({...form,maxOnlinePartySize:e.target.value?Number(e.target.value):null})}/>
          <input type="number" className="rounded border p-2 text-sm" placeholder="Duration mins" value={form.durationMinutes ?? ''} onChange={(e)=>setForm({...form,durationMinutes:e.target.value?Number(e.target.value):null})}/>
        </div>
        <input className="w-full rounded border p-2 text-sm" placeholder="Public label" value={form.publicLabel ?? ''} onChange={(e)=>setForm({...form,publicLabel:e.target.value||null})}/>
        <textarea className="w-full rounded border p-2 text-sm" rows={2} placeholder="Public instructions" value={form.publicInstructions ?? ''} onChange={(e)=>setForm({...form,publicInstructions:e.target.value||null})}/>
        <input className="w-full rounded border p-2 text-sm" placeholder="Allowed area IDs (comma separated)" value={form.allowedAreaIds.join(',')} onChange={(e)=>setForm({...form,allowedAreaIds:e.target.value.split(',').map((v)=>v.trim()).filter(Boolean)})}/>
        <input className="w-full rounded border p-2 text-sm" placeholder="Allowed table IDs (comma separated)" value={form.allowedTableIds.join(',')} onChange={(e)=>setForm({...form,allowedTableIds:e.target.value.split(',').map((v)=>v.trim()).filter(Boolean)})}/>
        <button type="button" onClick={saveEvent} className="rounded bg-slate-900 px-3 py-2 text-sm text-white">{editingId ? 'Update event' : 'Create event'}</button>
      </div>

      <div className="space-y-2">
        {events.map((event) => (
          <div key={event.id} className="rounded border p-3 text-sm">
            <p className="font-medium">{event.name}</p>
            <p className="text-xs text-slate-600">{event.isActive ? 'Active' : 'Inactive'} • {event.eventType} • Priority {event.priority}</p>
            <p className="mt-1 text-xs text-slate-600">Overrides: {overrideSummary(event)}</p>
            <div className="mt-2 flex gap-2">
              <button type="button" className="rounded border px-2 py-1" onClick={()=>{ setForm({ isActive: event.isActive, name: event.name, priority: event.priority, eventType: event.eventType, singleDate: event.singleDate, dateStart: event.dateStart, dateEnd: event.dateEnd, weekdays: event.weekdays, confirmationMode: event.confirmationMode, placementMode: event.placementMode, minPartySize: event.minPartySize, maxOnlinePartySize: event.maxOnlinePartySize, minAdvanceNoticeMinutes: event.minAdvanceNoticeMinutes, maxDaysAhead: event.maxDaysAhead, durationMinutes: event.durationMinutes, publicInstructions: event.publicInstructions, publicLabel: event.publicLabel, allowedAreaIds: event.allowedAreaIds, allowedTableIds: event.allowedTableIds }); setEditingId(event.id); }}>Edit</button>
              <button type="button" className="rounded border px-2 py-1" onClick={()=>removeEvent(event.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
