import { NextResponse } from 'next/server';
import { createAccount, SignupError } from '@/server/auth/signup';
import { createSession } from '@/server/auth/session';
import { checkRateLimit } from '@/server/rate-limit';

function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim() || 'unknown';
  return 'unknown';
}

function isStrongPassword(password: string): boolean {
  return (
    password.length >= 12 &&
    /[a-zA-Z]/.test(password) &&
    /[0-9]/.test(password)
  );
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rate = checkRateLimit({ key: `signup_ip:${ip}`, limit: 5, windowMs: 60 * 60_000 });
  if (!rate.allowed) {
    return NextResponse.redirect(new URL('/signup?error=too_many_requests', request.url));
  }

  const formData = await request.formData();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const orgName = String(formData.get('orgName') ?? '').trim();
  const venueName = String(formData.get('venueName') ?? '').trim();
  const timezone = String(formData.get('timezone') ?? '').trim();

  if (!email || !orgName || !venueName || !timezone || !isStrongPassword(password)) {
    return NextResponse.redirect(new URL('/signup?error=invalid_input', request.url));
  }

  try {
    const { userId } = await createAccount({ email, password, orgName, venueName, timezone });
    await createSession(userId);
    return NextResponse.redirect(new URL('/onboarding', request.url));
  } catch (error) {
    if (error instanceof SignupError) {
      const code = error.code === 'EMAIL_TAKEN' ? 'email_taken' : 'invalid_input';
      return NextResponse.redirect(new URL(`/signup?error=${code}`, request.url));
    }
    console.error('Signup error', error);
    return NextResponse.redirect(new URL('/signup?error=server_error', request.url));
  }
}
