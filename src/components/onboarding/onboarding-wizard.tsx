'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const DEFAULT_HOURS = [
  { dayOfWeek: 0, isClosed: false, openTime: '11:00', closeTime: '21:00' },
  { dayOfWeek: 1, isClosed: false, openTime: '11:30', closeTime: '22:00' },
  { dayOfWeek: 2, isClosed: false, openTime: '11:30', closeTime: '22:00' },
  { dayOfWeek: 3, isClosed: false, openTime: '11:30', closeTime: '22:00' },
  { dayOfWeek: 4, isClosed: false, openTime: '11:30', closeTime: '23:00' },
  { dayOfWeek: 5, isClosed: false, openTime: '10:30', closeTime: '23:00' },
  { dayOfWeek: 6, isClosed: false, openTime: '10:30', closeTime: '21:30' },
];

type Props = {
  venueId: string;
  orgId: string;
  venueName: string;
  venueSlug: string;
  timezone: string;
  city: string | null;
  country: string | null;
  addressLine: string | null;
};

export function OnboardingWizard(props: Props) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Step 1 state
  const [venueName, setVenueName] = useState(props.venueName);
  const [city, setCity] = useState(props.city ?? '');
  const [country, setCountry] = useState(props.country ?? '');
  const [addressLine, setAddressLine] = useState(props.addressLine ?? '');

  // Step 2 state
  const [hours, setHours] = useState(DEFAULT_HOURS);

  // Step 3 state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'HOST' | 'VENUE_MANAGER'>('HOST');

  async function saveVenueDetails() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/venues/${props.venueId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: venueName,
          slug: props.venueSlug,
          city: city || null,
          country: country || null,
          addressLine: addressLine || null,
          timezone: props.timezone,
          currency: 'USD',
          isActive: true,
          publicBookingEnabled: false,
          bookingMode: 'AUTO_CONFIRM',
          placementMode: 'AUTO_ASSIGN',
          minPartySize: 1,
          maxOnlinePartySize: 12,
          minAdvanceNoticeMinutes: 120,
          maxDaysAhead: 60,
          defaultReservationDurationMinutes: 120,
        }),
      });
      if (!res.ok) throw new Error('Failed to save venue details.');
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  async function saveHours() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/onboarding/hours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hours }),
      });
      if (!res.ok) throw new Error('Failed to save business hours.');
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  async function sendInvite() {
    if (!inviteEmail) { setStep(4); return; }
    setSaving(true);
    setError(null);
    try {
      const body = new FormData();
      body.append('email', inviteEmail);
      body.append('role', inviteRole);
      body.append('organizationId', props.orgId);
      body.append('venueId', props.venueId);
      const res = await fetch('/api/admin/users/invite', { method: 'POST', body });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to send invite.');
      }
      setStep(4);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send invite.');
    } finally {
      setSaving(false);
    }
  }

  async function completeOnboarding() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/onboarding/complete', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to complete onboarding.');
      router.push('/admin');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed.');
      setSaving(false);
    }
  }

  function updateHourField(
    dayOfWeek: number,
    field: 'isClosed' | 'openTime' | 'closeTime',
    value: boolean | string
  ) {
    setHours((prev) =>
      prev.map((h) => (h.dayOfWeek === dayOfWeek ? { ...h, [field]: value } : h))
    );
  }

  const progressPct = step === 1 ? 33 : step === 2 ? 66 : 100;

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Welcome! Let&apos;s get you set up.</h1>
        <p className="mt-1 text-sm text-muted-foreground">Step {Math.min(step, 3)} of 3</p>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-black transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {step === 1 && (
        <div className="border border-border bg-card p-6 space-y-4">
          <h2 className="font-medium">Step 1 — Venue details</h2>

          <label className="block text-sm">
            Venue name
            <input
              value={venueName}
              onChange={(e) => setVenueName(e.target.value)}
              required
              className="mt-1 w-full rounded border p-2 text-sm"
            />
          </label>

          <label className="block text-sm">
            Address
            <input
              value={addressLine}
              onChange={(e) => setAddressLine(e.target.value)}
              placeholder="123 Main St"
              className="mt-1 w-full rounded border p-2 text-sm"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              City
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="New York"
                className="mt-1 w-full rounded border p-2 text-sm"
              />
            </label>
            <label className="block text-sm">
              Country
              <input
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="US"
                className="mt-1 w-full rounded border p-2 text-sm"
              />
            </label>
          </div>

          <p className="text-xs text-muted-foreground">
            Timezone: <strong>{props.timezone}</strong> (set during signup — change in Settings if needed)
          </p>

          <button
            onClick={saveVenueDetails}
            disabled={saving || !venueName}
            className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Next →'}
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="border border-border bg-card p-6 space-y-4">
          <h2 className="font-medium">Step 2 — Business hours</h2>
          <p className="text-sm text-muted-foreground">Set your regular operating hours.</p>

          <div className="space-y-2">
            {hours.map((h) => (
              <div key={h.dayOfWeek} className="flex items-center gap-3 text-sm">
                <span className="w-24 font-medium">{DAYS[h.dayOfWeek]}</span>
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={h.isClosed}
                    onChange={(e) => updateHourField(h.dayOfWeek, 'isClosed', e.target.checked)}
                  />
                  Closed
                </label>
                {!h.isClosed && (
                  <>
                    <input
                      type="time"
                      value={h.openTime}
                      onChange={(e) => updateHourField(h.dayOfWeek, 'openTime', e.target.value)}
                      className="rounded border p-1 text-sm"
                    />
                    <span>–</span>
                    <input
                      type="time"
                      value={h.closeTime}
                      onChange={(e) => updateHourField(h.dayOfWeek, 'closeTime', e.target.value)}
                      className="rounded border p-1 text-sm"
                    />
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="rounded border px-4 py-2 text-sm"
            >
              ← Back
            </button>
            <button
              onClick={saveHours}
              disabled={saving}
              className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Next →'}
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="border border-border bg-card p-6 space-y-4">
          <h2 className="font-medium">Step 3 — Invite your team (optional)</h2>
          <p className="text-sm text-muted-foreground">
            Add a team member now, or skip and do it later from Settings.
          </p>

          <label className="block text-sm">
            Email address
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="manager@yourrestaurant.com"
              className="mt-1 w-full rounded border p-2 text-sm"
            />
          </label>

          <label className="block text-sm">
            Role
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as 'HOST' | 'VENUE_MANAGER')}
              className="mt-1 w-full rounded border p-2 text-sm"
            >
              <option value="HOST">Host</option>
              <option value="VENUE_MANAGER">Venue Manager</option>
            </select>
          </label>

          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="rounded border px-4 py-2 text-sm">
              ← Back
            </button>
            <button
              onClick={sendInvite}
              disabled={saving}
              className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {saving ? 'Sending…' : inviteEmail ? 'Send invite →' : 'Skip →'}
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="border border-border bg-card p-6 space-y-4 text-center">
          <h2 className="text-xl font-semibold">You&apos;re all set!</h2>
          <p className="text-sm text-muted-foreground">
            Your trial runs for 14 days. No card needed until then.
          </p>
          <button
            onClick={completeOnboarding}
            disabled={saving}
            className="rounded bg-black px-6 py-2 text-sm text-white disabled:opacity-50"
          >
            {saving ? 'Loading…' : 'Go to dashboard →'}
          </button>
        </div>
      )}
    </div>
  );
}
