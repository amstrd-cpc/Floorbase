import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/prisma/client';
import { verifyPassword, DUMMY_HASH } from '@/server/auth/password';
import { createSession } from '@/server/auth/session';
import { checkRateLimit } from '@/server/rate-limit';

function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim() || 'unknown';
  }
  return 'unknown';
}

export async function POST(request: Request) {
  const ip = getClientIp(request);

  const ipRate = checkRateLimit({ key: `login_ip:${ip}`, limit: 20, windowMs: 15 * 60_000 });
  if (!ipRate.allowed) {
    return NextResponse.redirect(new URL('/login?error=too_many_requests', request.url));
  }

  const formData = await request.formData();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');

  if (!email || !password || email.length > 254) {
    return NextResponse.redirect(new URL('/login?error=invalid_credentials', request.url));
  }

  const emailRate = checkRateLimit({ key: `login_email:${email}`, limit: 5, windowMs: 15 * 60_000 });
  if (!emailRate.allowed) {
    return NextResponse.redirect(new URL('/login?error=too_many_requests', request.url));
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // Always run verifyPassword regardless of whether user exists to prevent
  // timing-based email enumeration (scrypt takes ~100ms either way).
  const passwordHash = user?.passwordHash ?? DUMMY_HASH;
  const matches = await verifyPassword(password, passwordHash);

  if (!user || !user.isActive || !matches) {
    await prisma.auditLog.create({
      data: {
        organizationId: user?.organizationId ?? null,
        actorUserId: user?.id ?? null,
        entityType: 'auth',
        entityId: email,
        action: 'LOGIN_FAILURE',
        metadata: {
          ip,
          reason: !user ? 'user_not_found' : !user.isActive ? 'user_inactive' : 'wrong_password'
        }
      }
    });
    return NextResponse.redirect(new URL('/login?error=invalid_credentials', request.url));
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() }
  });

  await createSession(user.id);

  await prisma.auditLog.create({
    data: {
      organizationId: user.organizationId ?? null,
      actorUserId: user.id,
      entityType: 'auth',
      entityId: user.id,
      action: 'LOGIN_SUCCESS',
      metadata: { ip }
    }
  });

  return NextResponse.redirect(new URL('/admin', request.url));
}
