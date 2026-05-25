'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function RevokeUserButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleRevoke() {
    setLoading(true);
    await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
    setLoading(false);
    setConfirming(false);
    router.refresh();
  }

  if (confirming) {
    return (
      <span className="flex items-center gap-2 text-sm">
        <span className="text-red-700">Revoke access?</span>
        <button
          onClick={handleRevoke}
          disabled={loading}
          className="text-red-700 underline disabled:opacity-50"
        >
          {loading ? 'Revoking…' : 'Yes, revoke'}
        </button>
        <button onClick={() => setConfirming(false)} className="text-slate-500 underline">
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
