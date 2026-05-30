'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { AuthShell, AuthNotice, AuthLink, fieldInput, fieldLabel, primaryButton } from '@/components/auth/auth-ui';

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
      <AuthNotice>
        Invalid or missing reset token. Request a{' '}
        <AuthLink href="/forgot-password">new reset link</AuthLink>.
      </AuthNotice>
    );
  }

  if (success) {
    return (
      <AuthNotice label="Password updated">
        You can now sign in with your new password.{' '}
        <AuthLink href="/login">Sign in</AuthLink>
      </AuthNotice>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      {error ? <AuthNotice>{error}</AuthNotice> : null}
      <label className={fieldLabel}>
        New password
        <input
          type="password"
          required
          minLength={12}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="12+ characters"
          className={fieldInput}
        />
      </label>
      <label className={fieldLabel}>
        Confirm password
        <input
          type="password"
          required
          minLength={12}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Repeat password"
          className={fieldInput}
        />
      </label>
      <button type="submit" disabled={loading} className={primaryButton}>
        {loading ? 'Saving…' : 'Set new password'}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthShell
      eyebrow="Account recovery"
      title="Set new password"
      description="Choose a strong password (12+ characters)."
      footer={
        <p>
          <AuthLink href="/login">Back to sign in</AuthLink>
        </p>
      }
    >
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
