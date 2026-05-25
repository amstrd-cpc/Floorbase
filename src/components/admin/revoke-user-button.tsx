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
    const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'Failed to revoke access.');
      return;
    }
    setConfirming(false);
    router.refresh();
  }

  if (confirming) {
    return (
      <span className="flex items-center gap-2 text-sm">
        {error && <span className="text-red-700">{error}</span>}
        {!error && <span className="text-red-700">Revoke access?</span>}
        <button
          onClick={handleRevoke}
          disabled={loading}
          className="text-red-700 underline disabled:opacity-50"
        >
          {loading ? 'Revoking…' : 'Yes, revoke'}
        </button>
        <button onClick={() => { setConfirming(false); setError(null); }} className="text-slate-500 underline">
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-sm text-red-700 hover:underline"
    >
      Revoke
    </button>
  );
}
