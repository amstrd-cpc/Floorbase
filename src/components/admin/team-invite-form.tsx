'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function TeamInviteForm({
  organizationId,
  venueId,
}: {
  organizationId: string;
  venueId: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'HOST' | 'VENUE_MANAGER' | 'ORGANIZATION_ADMIN'>('HOST');
  const [saving, setSaving] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setInviteUrl(null);

    const body = new FormData();
    body.append('email', email);
    body.append('role', role);
    body.append('organizationId', organizationId);
    if (role !== 'ORGANIZATION_ADMIN') body.append('venueId', venueId);

    try {
      const res = await fetch('/api/admin/users/invite', { method: 'POST', body });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to create invite.');
      } else {
        setInviteUrl(data.inviteUrl);
        setEmail('');
        router.refresh();
      }
    } catch {
      setError('Network error. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-sm sm:col-span-2">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="team@yourrestaurant.com"
            className="mt-1 w-full border p-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          Role
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as typeof role)}
            className="mt-1 w-full border p-2 text-sm"
          >
            <option value="HOST">Host</option>
            <option value="VENUE_MANAGER">Venue Manager</option>
            <option value="ORGANIZATION_ADMIN">Org Admin</option>
          </select>
        </label>
      </div>

      {error && <p className="text-sm text-foreground">{error}</p>}

      {inviteUrl && (
        <div className="border border-border bg-secondary p-3 text-sm">
          <p className="font-medium">Invite created.</p>
          <p className="mt-1 break-all text-xs text-muted-foreground">
            Share this link: <strong>{inviteUrl}</strong>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Expires in 72 hours.</p>
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="bg-foreground px-4 py-2 text-sm text-background disabled:opacity-50"
      >
        {saving ? 'Sending…' : 'Send invite'}
      </button>
    </form>
  );
}
