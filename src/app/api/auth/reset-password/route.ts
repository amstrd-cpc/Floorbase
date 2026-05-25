import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/server/rate-limit';
import { consumePasswordResetToken } from '@/server/auth/password-reset';

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rl = checkRateLimit({ key: `reset-password:${ip}`, limit: 10, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  }

  let token: string;
  let password: string;
  try {
    const body = await request.json();
    token = String(body.token ?? '').trim();
    password = String(body.password ?? '');
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const result = await consumePasswordResetToken(token, password);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
