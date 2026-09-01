'use client';

import { useCallback, useEffect, useState } from 'react';

type StaffMember = {
  id: string;
  name: string;
  isActive: boolean;
};

type Shift = {
  id: string;
  clockInAt: string;
  clockOutAt: string | null;
  staffMember: StaffMember;
};

const EMPTY_STAFF_FORM = { name: '', pin: '', isActive: true };

function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

export function StaffManager({ venueId }: { venueId: string }) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [activeShifts, setActiveShifts] = useState<Shift[]>([]);
  const [recentShifts, setRecentShifts] = useState<Shift[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; kind: 'ok' | 'err' } | null>(null);

  const [staffForm, setStaffForm] = useState(EMPTY_STAFF_FORM);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [staffFormError, setStaffFormError] = useState<string | null>(null);

  const [clockStaffId, setClockStaffId] = useState('');
  const [clockPin, setClockPin] = useState('');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [staffRes, activeRes, recentRes] = await Promise.all([
        fetch(`/api/admin/staff?venueId=${venueId}`),
        fetch(`/api/admin/staff/shifts?venueId=${venueId}&active=true`),
        fetch(`/api/admin/staff/shifts?venueId=${venueId}`)
      ]);
      const staffBody = await staffRes.json().catch(() => ({}));
      const activeBody = await activeRes.json().catch(() => ({}));
      const recentBody = await recentRes.json().catch(() => ({}));
      if (!staffRes.ok || !activeRes.ok || !recentRes.ok) {
        setMessage({ text: 'Failed to load staff data.', kind: 'err' });
        return;
      }
      setStaff(staffBody.staff ?? []);
      setActiveShifts(activeBody.shifts ?? []);
      setRecentShifts(recentBody.shifts ?? []);
    } catch {
      setMessage({ text: 'Failed to load staff data. Please refresh.', kind: 'err' });
    } finally {
      setIsLoading(false);
    }
  }, [venueId]);

  useEffect(() => {
    // Standard fetch-on-mount; this app has no React Compiler / data-fetching
    // library, loadData's setIsLoading(true) is the intended initial state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  async function saveStaff() {
    setStaffFormError(null);
    setMessage(null);
    if (!staffForm.name.trim()) {
      setStaffFormError('Name is required.');
      return;
    }
    if (!editingStaffId && !/^\d{4,6}$/.test(staffForm.pin)) {
      setStaffFormError('PIN must be 4-6 digits.');
      return;
    }
    if (editingStaffId && staffForm.pin && !/^\d{4,6}$/.test(staffForm.pin)) {
      setStaffFormError('PIN must be 4-6 digits.');
      return;
    }

    try {
      const method = editingStaffId ? 'PUT' : 'POST';
      const url = editingStaffId
        ? `/api/admin/staff/${editingStaffId}`
        : '/api/admin/staff';
      const body: Record<string, unknown> = {
        name: staffForm.name,
        isActive: staffForm.isActive
      };
      if (!editingStaffId) {
        body.venueId = venueId;
        body.pin = staffForm.pin;
      } else if (staffForm.pin) {
        body.pin = staffForm.pin;
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const resBody = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ text: resBody.error ?? 'Failed to save staff member.', kind: 'err' });
        return;
      }
      setStaffForm(EMPTY_STAFF_FORM);
      setEditingStaffId(null);
      setMessage({ text: editingStaffId ? 'Staff member updated.' : 'Staff member added.', kind: 'ok' });
      await loadData();
    } catch {
      setMessage({ text: 'Failed to save staff member.', kind: 'err' });
    }
  }

  async function submitClock(action: 'clock-in' | 'clock-out') {
    setMessage(null);
    if (!clockStaffId) {
      setMessage({ text: 'Select a staff member.', kind: 'err' });
      return;
    }
    if (!/^\d{4,6}$/.test(clockPin)) {
      setMessage({ text: 'Enter a valid PIN.', kind: 'err' });
      return;
    }

    try {
      const res = await fetch(`/api/admin/staff/${clockStaffId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: clockPin })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ text: body.error ?? 'Failed to clock in/out.', kind: 'err' });
        return;
      }
      setClockPin('');
      setMessage({
        text: action === 'clock-in' ? 'Clocked in.' : 'Clocked out.',
        kind: 'ok'
      });
      await loadData();
    } catch {
      setMessage({ text: 'Failed to clock in/out.', kind: 'err' });
    }
  }

  return (
    <section className="space-y-4">
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

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2 rounded border p-3">
          <p className="text-sm font-semibold">Clock in / out</p>
          <select
            className="w-full rounded border p-2 text-sm"
            value={clockStaffId}
            onChange={(e) => setClockStaffId(e.target.value)}
          >
            <option value="">Select staff member…</option>
            {staff
              .filter((member) => member.isActive)
              .map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
          </select>
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            className="w-full rounded border p-2 text-sm"
            placeholder="PIN"
            value={clockPin}
            onChange={(e) => setClockPin(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => submitClock('clock-in')}
              className="rounded bg-slate-900 px-3 py-2 text-sm text-white"
            >
              Clock in
            </button>
            <button
              type="button"
              onClick={() => submitClock('clock-out')}
              className="rounded border px-3 py-2 text-sm"
            >
              Clock out
            </button>
          </div>

          <p className="pt-2 text-sm font-semibold">Currently on shift</p>
          {activeShifts.length === 0 ? (
            <p className="text-xs text-muted-foreground">No one is clocked in.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {activeShifts.map((shift) => (
                <li key={shift.id} className="flex justify-between rounded border px-2 py-1">
                  <span>{shift.staffMember.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    since {formatTime(shift.clockInAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-2 rounded border p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">{editingStaffId ? 'Edit staff member' : 'Add staff member'}</p>
            {editingStaffId ? (
              <button
                type="button"
                className="rounded border px-2 py-1 text-xs"
                onClick={() => {
                  setEditingStaffId(null);
                  setStaffForm(EMPTY_STAFF_FORM);
                  setStaffFormError(null);
                }}
              >
                Cancel edit
              </button>
            ) : null}
          </div>
          {staffFormError ? (
            <p className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
              {staffFormError}
            </p>
          ) : null}
          <input
            className="w-full rounded border p-2 text-sm"
            placeholder="Full name"
            value={staffForm.name}
            onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
          />
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            className="w-full rounded border p-2 text-sm"
            placeholder={editingStaffId ? 'New PIN (leave blank to keep current)' : 'PIN (4-6 digits)'}
            value={staffForm.pin}
            onChange={(e) => setStaffForm({ ...staffForm, pin: e.target.value })}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={staffForm.isActive}
              onChange={(e) => setStaffForm({ ...staffForm, isActive: e.target.checked })}
            />
            Active
          </label>
          <button
            type="button"
            onClick={saveStaff}
            className="rounded bg-slate-900 px-3 py-2 text-sm text-white"
          >
            {editingStaffId ? 'Update staff member' : 'Add staff member'}
          </button>

          <div className="mt-3 space-y-1">
            {isLoading ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : null}
            {!isLoading && staff.length === 0 ? (
              <p className="text-xs text-muted-foreground">No staff members yet.</p>
            ) : null}
            {staff.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between rounded border px-2 py-1 text-sm"
              >
                <span>
                  {member.name}
                  {!member.isActive ? (
                    <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                      Inactive
                    </span>
                  ) : null}
                </span>
                <button
                  type="button"
                  className="rounded border px-2 py-1 text-xs"
                  onClick={() => {
                    setStaffForm({ name: member.name, pin: '', isActive: member.isActive });
                    setEditingStaffId(member.id);
                    setStaffFormError(null);
                  }}
                >
                  Edit
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded border p-3">
        <p className="text-sm font-semibold">Recent shifts</p>
        {recentShifts.length === 0 ? (
          <p className="text-xs text-muted-foreground">No shifts recorded yet.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {recentShifts.map((shift) => (
              <li key={shift.id} className="flex justify-between border-b border-border py-1 last:border-0">
                <span>{shift.staffMember.name}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {formatTime(shift.clockInAt)} – {shift.clockOutAt ? formatTime(shift.clockOutAt) : 'on shift'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
