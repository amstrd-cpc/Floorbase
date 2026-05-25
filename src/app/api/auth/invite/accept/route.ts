import { NextResponse } from 'next/server';
import { acceptInvite } from '@/server/auth/invite';
import { createSession } from '@/server/auth/session';
import { prisma } from '@/server/db/prisma/client';

function isStrongPassword(password: string): boolean {
  return (
    password.length >= 12 &&
    /[a-zA-Z]/.test(password) &&
    /[0-9]/.test(password)
  );
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const token = String(formData.get('token') ?? '');
  const password = String(formData.get('password') ?? '');
  const firstName = String(formData.get('firstName') ?? '') || undefined;
  const lastName = String(formData.get('lastName') ?? '') || undefined;

  if (!token || !isStrongPassword(password)) {
    return NextResponse.redirect(new URL('/login?error=invalid_invite', request.url));
  }

  try {
    const user = await acceptInvite({ token, password, firstName, lastName });
    await createSession(user.id);

    await prisma.auditLog.create({
      data: {
        organizationId: user.organizationId ?? null,
        actorUserId: user.id,
        entityType: 'auth',
        entityId: user.id,
        action: 'INVITE_ACCEPTED',
        metadata: {}
      }
    });

    return NextResponse.redirect(new URL('/admin', request.url));
  } catch {
    return NextResponse.redirect(new URL('/login?error=invalid_invite', request.url));
  }
}
