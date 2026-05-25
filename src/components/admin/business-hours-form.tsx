'use client';

import { useState } from 'react';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

type DayHours = {
  dayOfWeek: number;
  isClosed: boolean;
  openTime: string;
  closeTime: string;
};

export function BusinessHoursForm({ initialHours }: { initialHours: DayHours[] }) {
  const [hours, setHours] = useState<DayHours[]>(initialHours);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<'saved' | 'error' | null>(null);

  function updateField(
    dayOfWeek: number,
    field: 'isClosed' | 'openTime' | 'closeTime',
    value: boolean | string
  ) {
    setHours((prev) =>
      prev.map((h) => (h.dayOfWeek === dayOfWeek ? { ...h, [field]: value } : h))
    );
    setResult(null);
  }

  async function handleSave() {
    setSaving(true);
    setResult(null);
    try {
      const res = await fetch('/api/onboarding/hours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hours }),
      });
      setResult(res.ok ? 'saved' : 'error');
    } catch {
      setResult('error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {hours.map((h) => (
          <div key={h.dayOfWeek} className="flex items-center gap-3 text-sm">
            <span className="w-24 font-medium">{DAYS[h.dayOfWeek]}</span>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={h.isClosed}
                onChange={(e) => updateField(h.dayOfWeek, 'isClosed', e.target.checked)}
                className="h-4 w-4"
              />
              <span>Closed</span>
            </label>
            {!h.isClosed && (
              <>
                <input
                  type="time"
                  value={h.openTime}
                  onChange={(e) => updateField(h.dayOfWeek, 'openTime', e.target.value)}
                  className="rounded border p-1 text-sm"
                />
                <span className="text-muted-foreground">–</span>
                <input
                  type="time"
                  value={h.closeTime}
                  onChange={(e) => updateField(h.dayOfWeek, 'closeTime', e.target.value)}
                  className="rounded border p-1 text-sm"
                />
              </>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save hours'}
        </button>
        {result === 'saved' && (
          <p className="text-sm text-green-700">Hours saved.</p>
        )}
        {result === 'error' && (
          <p className="text-sm text-red-700">Failed to save. Check times and try again.</p>
        )}
      </div>
    </div>
  );
}
