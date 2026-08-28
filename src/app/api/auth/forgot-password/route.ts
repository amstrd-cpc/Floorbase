import { NextResponse } from 'next/server';
import { env } from '@/env';
import { sendPasswordResetEmail } from '@/server/email/service';
import { createPasswordResetToken } from '@/server/auth/password-reset';
import { checkRateLimit } from '@/server/rate-limit';

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rl = await checkRateLimit({ key: `forgot-password:${ip}`, limit: 5, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json({ ok: true }); // always 200 to avoid enumeration
  }

  let email: string;
  try {
    const body = await request.json();
    email = String(body.email ?? '').trim().toLowerCase();
  } catch {
    return NextResponse.json({ ok: true });
  }

  if (!email) {
    return NextResponse.json({ ok: true });
  }

  const rawToken = await createPasswordResetToken(email);

  if (rawToken) {
    const resetUrl = `${env.APP_URL}/reset-password?token=${encodeURIComponent(rawToken)}`;
    void sendPasswordResetEmail({ to: email, resetUrl });
  }

  // Always return 200 — never confirm whether email exists
  return NextResponse.json({ ok: true });
}
