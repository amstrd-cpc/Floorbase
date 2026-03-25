import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/prisma/client';
import { verifyPassword } from '@/server/auth/password';
import { createSession } from '@/server/auth/session';

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return NextResponse.redirect(new URL('/login?error=invalid_credentials', request.url));
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.passwordHash || !user.isActive) {
    return NextResponse.redirect(new URL('/login?error=invalid_credentials', request.url));
  }

  const matches = await verifyPassword(password, user.passwordHash);

  if (!matches) {
    return NextResponse.redirect(new URL('/login?error=invalid_credentials', request.url));
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() }
  });

  await createSession(user.id);

  return NextResponse.redirect(new URL('/admin', request.url));
}
