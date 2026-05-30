'use client';

import { useState } from 'react';
import { AuthShell, AuthNotice, AuthLink, fieldInput, fieldLabel, primaryButton } from '@/components/auth/auth-ui';

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
    <AuthShell
      eyebrow="Account recovery"
      title="Reset password"
      description={
        submitted
          ? undefined
          : "Enter your work email and we'll send a reset link if an account exists."
      }
      footer={
        <p>
          <AuthLink href="/login">Back to sign in</AuthLink>
        </p>
      }
    >
      {submitted ? (
        <AuthNotice label="Check your inbox">
          If that email address is registered, you&apos;ll receive a password reset link shortly.
        </AuthNotice>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className={fieldLabel}>
            Work email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@yourrestaurant.com"
              className={fieldInput}
            />
          </label>
          <button type="submit" disabled={loading} className={primaryButton}>
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
