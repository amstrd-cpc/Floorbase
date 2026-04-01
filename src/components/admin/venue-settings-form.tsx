'use client';

import { useEffect, useState } from 'react';

type VenueSettings = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  currency: string;
  isActive: boolean;
  publicBookingEnabled: boolean;
  bookingMode: 'AUTO_CONFIRM' | 'REQUEST_ONLY';
  maxOnlinePartySize: number;
  minAdvanceNoticeMinutes: number;
  maxDaysAhead: number;
  defaultReservationDurationMinutes: number;
};

const TIMEZONE_SUGGESTIONS = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/Berlin',
  'Europe/Tbilisi',
  'Asia/Yerevan'
];

export function VenueSettingsForm({ venue }: { venue: VenueSettings }) {
  const [values, setValues] = useState(venue);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (values.timezone.trim()) {
      return;
    }

    const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (browserTimezone) {
      setValues((current) => ({
        ...current,
        timezone: current.timezone.trim() || browserTimezone
      }));
    }
  }, [values.timezone]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const res = await fetch(`/api/admin/venues/${venue.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values)
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(body.error ?? 'Unable to save settings.');
      return;
    }
    setMessage('Venue settings saved.');
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-lg border bg-white p-4 md:max-w-2xl"
    >
      {message ? <p className="rounded border p-2 text-sm">{message}</p> : null}
      <label className="block text-sm">
        Venue Name
        <input
          className="mt-1 w-full rounded border p-2"
          value={values.name}
          onChange={(e) => setValues({ ...values, name: e.target.value })}
        />
      </label>
      <label className="block text-sm">
        Venue Slug
        <input
          className="mt-1 w-full rounded border p-2"
          value={values.slug}
          onChange={(e) => setValues({ ...values, slug: e.target.value })}
        />
      </label>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm">
          Timezone
          <input
            list="timezone-suggestions"
            placeholder="e.g. America/New_York"
            className="mt-1 w-full rounded border p-2"
            value={values.timezone}
            onChange={(e) => setValues({ ...values, timezone: e.target.value })}
          />
          <datalist id="timezone-suggestions">
            {TIMEZONE_SUGGESTIONS.map((timezone) => (
              <option key={timezone} value={timezone} />
            ))}
          </datalist>
          <span className="mt-1 block text-xs text-slate-500">
            Uses IANA timezone values. Browser timezone is only a default suggestion.
          </span>
        </label>
        <label className="text-sm">
          Currency
          <input
            maxLength={3}
            className="mt-1 w-full rounded border p-2"
            value={values.currency}
            onChange={(e) =>
              setValues({ ...values, currency: e.target.value.toUpperCase() })
            }
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={values.isActive}
          onChange={(e) => setValues({ ...values, isActive: e.target.checked })}
        />
        Venue is active
      </label>
      <hr />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={values.publicBookingEnabled}
          onChange={(e) =>
            setValues({ ...values, publicBookingEnabled: e.target.checked })
          }
        />
        Enable public booking
      </label>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm">
          Booking mode
          <select
            className="mt-1 w-full rounded border p-2"
            value={values.bookingMode}
            onChange={(e) =>
              setValues({
                ...values,
                bookingMode: e.target.value as VenueSettings['bookingMode']
              })
            }
          >
            <option value="AUTO_CONFIRM">Auto confirm</option>
            <option value="REQUEST_ONLY">Request only</option>
          </select>
        </label>
        <label className="text-sm">
          Max online party size
          <input
            type="number"
            min={1}
            className="mt-1 w-full rounded border p-2"
            value={values.maxOnlinePartySize}
            onChange={(e) =>
              setValues({
                ...values,
                maxOnlinePartySize: Number(e.target.value)
              })
            }
          />
        </label>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="text-sm">
          Min advance notice (mins)
          <input
            type="number"
            min={0}
            className="mt-1 w-full rounded border p-2"
            value={values.minAdvanceNoticeMinutes}
            onChange={(e) =>
              setValues({
                ...values,
                minAdvanceNoticeMinutes: Number(e.target.value)
              })
            }
          />
        </label>
        <label className="text-sm">
          Max days ahead
          <input
            type="number"
            min={1}
            className="mt-1 w-full rounded border p-2"
            value={values.maxDaysAhead}
            onChange={(e) =>
              setValues({ ...values, maxDaysAhead: Number(e.target.value) })
            }
          />
        </label>
        <label className="text-sm">
          Default duration (mins)
          <input
            type="number"
            min={30}
            step={15}
            className="mt-1 w-full rounded border p-2"
            value={values.defaultReservationDurationMinutes}
            onChange={(e) =>
              setValues({
                ...values,
                defaultReservationDurationMinutes: Number(e.target.value)
              })
            }
          />
        </label>
      </div>
      <button className="rounded bg-slate-900 px-4 py-2 text-sm text-white">
        Save settings
      </button>
    </form>
  );
}
