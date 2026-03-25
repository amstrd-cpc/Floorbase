import { NextResponse } from 'next/server';
import { acceptInvite } from '@/server/auth/invite';
import { createSession } from '@/server/auth/session';

export async function POST(request: Request) {
  const formData = await request.formData();
  const token = String(formData.get('token') ?? '');
  const password = String(formData.get('password') ?? '');
  const firstName = String(formData.get('firstName') ?? '') || undefined;
  const lastName = String(formData.get('lastName') ?? '') || undefined;

  if (!token || password.length < 8) {
    return NextResponse.redirect(new URL('/login?error=invalid_invite', request.url));
  }

  try {
    const user = await acceptInvite({ token, password, firstName, lastName });
    await createSession(user.id);
    return NextResponse.redirect(new URL('/admin', request.url));
  } catch {
    return NextResponse.redirect(new URL('/login?error=invalid_invite', request.url));
  }
}
