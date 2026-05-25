'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? 'Unable to reset password.');
      return;
    }

    setSuccess(true);
  }

  if (!token) {
    return (
      <p className="text-sm text-red-700">
        Invalid or missing reset token. Request a{' '}
        <Link href="/forgot-password" className="underline">new reset link</Link>.
      </p>
    );
  }

  if (success) {
    return (
      <div>
        <p className="text-sm text-slate-700">Password updated. You can now sign in with your new password.</p>
        <p className="mt-4 text-sm">
          <Link href="/login" className="underline">Sign in</Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-3">
      {error ? (
        <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
      ) : null}
      <label className="block text-sm">
        New password
        <input
          type="password"
          required
          minLength={12}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="12+ characters"
          className="mt-1 w-full rounded border p-2 text-sm"
        />
      </label>
      <label className="block text-sm">
        Confirm password
        <input
          type="password"
          required
          minLength={12}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Repeat password"
          className="mt-1 w-full rounded border p-2 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={loading}
        className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {loading ? 'Saving…' : 'Set new password'}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl items-center p-6">
      <section className="w-full rounded-lg border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Set new password</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Choose a strong password (12+ characters).
        </p>
        <Suspense>
          <ResetPasswordForm />
        </Suspense>
      </section>
    </main>
  );
}
