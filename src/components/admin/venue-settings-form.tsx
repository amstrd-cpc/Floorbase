'use client';

import { useEffect, useState } from 'react';

type VenueSettings = {
  id: string;
  name: string;
  slug: string;
  country: string | null;
  city: string | null;
  addressLine: string | null;
  timezone: string;
  currency: string;
  isActive: boolean;
  publicBookingEnabled: boolean;
  bookingMode: 'AUTO_CONFIRM' | 'REQUEST_ONLY';
  placementMode: 'AUTO_ASSIGN' | 'TABLE_SELECTION';
  minPartySize: number;
  maxOnlinePartySize: number;
  minAdvanceNoticeMinutes: number;
  maxDaysAhead: number;
  defaultReservationDurationMinutes: number;
  publicInstructions: string | null;
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

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-lg border p-4">
      <div>
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      {children}
    </section>
  );
}

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
    <form onSubmit={onSubmit} className="space-y-4 rounded-lg border bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-slate-50 p-3">
        <div>
          <p className="text-sm font-medium">Default venue configuration</p>
          <p className="text-xs text-slate-500">These values are used for regular service days. Event overrides are managed in the Events section.</p>
        </div>
        <button className="rounded bg-slate-900 px-4 py-2 text-sm text-white">Save settings</button>
      </div>

      {message ? <p className="rounded border p-2 text-sm">{message}</p> : null}

      <Section title="General" description="Core identity and public booking URL details.">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block text-sm">
            Venue name
            <input
              className="mt-1 w-full rounded border p-2"
              value={values.name}
              onChange={(e) => setValues({ ...values, name: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            Public slug
            <input
              className="mt-1 w-full rounded border p-2"
              value={values.slug}
              onChange={(e) => setValues({ ...values, slug: e.target.value })}
            />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={values.isActive}
            onChange={(e) => setValues({ ...values, isActive: e.target.checked })}
          />
          Venue is active for operations
        </label>
      </Section>

      <Section title="Location" description="Physical location and local timezone used by admin and booking workflows.">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            Country
            <input
              className="mt-1 w-full rounded border p-2"
              placeholder="e.g. United States"
              value={values.country ?? ''}
              onChange={(e) => setValues({ ...values, country: e.target.value || null })}
            />
          </label>
          <label className="text-sm">
            City
            <input
              className="mt-1 w-full rounded border p-2"
              placeholder="e.g. New York"
              value={values.city ?? ''}
              onChange={(e) => setValues({ ...values, city: e.target.value || null })}
            />
          </label>
        </div>
        <label className="text-sm">
          Address / location text
          <input
            className="mt-1 w-full rounded border p-2"
            placeholder="Street, district, or landmark"
            value={values.addressLine ?? ''}
            onChange={(e) => setValues({ ...values, addressLine: e.target.value || null })}
          />
        </label>
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
            Uses IANA timezone values. Browser timezone is only a suggestion and remains manually editable.
          </span>
        </label>
      </Section>

      <Section title="Regional" description="Regional display defaults used in customer and admin experiences.">
        <label className="text-sm md:max-w-xs">
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
      </Section>

      <Section title="Booking Defaults" description="Default booking rules for normal days. Use Events for temporary or recurring exceptions.">
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
            Confirmation mode
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
            Placement mode
            <select
              className="mt-1 w-full rounded border p-2"
              value={values.placementMode}
              onChange={(e) =>
                setValues({
                  ...values,
                  placementMode: e.target.value as VenueSettings['placementMode']
                })
              }
            >
              <option value="AUTO_ASSIGN">Auto assign</option>
              <option value="TABLE_SELECTION">Guest table selection</option>
            </select>
          </label>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            Minimum party size
            <input
              type="number"
              min={1}
              className="mt-1 w-full rounded border p-2"
              value={values.minPartySize}
              onChange={(e) =>
                setValues({
                  ...values,
                  minPartySize: Number(e.target.value)
                })
              }
            />
          </label>
          <label className="text-sm">
            Maximum online party size
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
            Minimum advance notice (minutes)
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
            Maximum days ahead
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
            Default duration (minutes)
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
        <label className="block text-sm">
          Public instructions
          <textarea
            className="mt-1 w-full rounded border p-2"
            rows={3}
            value={values.publicInstructions ?? ''}
            onChange={(e) =>
              setValues({ ...values, publicInstructions: e.target.value || null })
            }
          />
        </label>
      </Section>
    </form>
  );
}
