'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    setSubmitted(true);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl items-center p-6">
      <section className="w-full rounded-lg border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Reset password</h1>

        {submitted ? (
          <div className="mt-6">
            <p className="text-sm text-slate-700">
              If that email address is registered, you&apos;ll receive a password reset link shortly. Check your inbox.
            </p>
            <p className="mt-4 text-sm">
              <Link href="/login" className="underline">Back to sign in</Link>
            </p>
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              Enter your work email and we&apos;ll send a reset link if an account exists.
            </p>
            <form onSubmit={handleSubmit} className="mt-6 space-y-3">
              <label className="block text-sm">
                Work email
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@yourrestaurant.com"
                  className="mt-1 w-full rounded border p-2 text-sm"
                />
              </label>
              <button
                type="submit"
                disabled={loading}
                className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
            <p className="mt-4 text-sm">
              <Link href="/login" className="underline text-muted-foreground">Back to sign in</Link>
            </p>
          </>
        )}
      </section>
    </main>
  );
}
