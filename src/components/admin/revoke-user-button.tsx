'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function RevokeUserButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRevoke() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Failed to revoke access.');
        return;
      }
      setConfirming(false);
      router.refresh();
    } catch {
      setError('Network error. Try again.');
    } finally {
      setLoading(false);
    }
  }

  if (confirming) {
    return (
      <span className="flex items-center gap-2 text-sm">
        {error && <span className="text-foreground">{error}</span>}
        {!error && <span className="text-foreground">Revoke access?</span>}
        <button
          onClick={handleRevoke}
          disabled={loading}
          className="text-foreground underline disabled:opacity-50"
        >
          {loading ? 'Revoking…' : 'Yes, revoke'}
        </button>
        <button onClick={() => { setConfirming(false); setError(null); }} className="text-muted-foreground underline">
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-sm text-foreground hover:underline"
    >
      Revoke
    </button>
  );
}
