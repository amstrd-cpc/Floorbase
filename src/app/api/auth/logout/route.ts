import { NextResponse } from 'next/server';
import { destroySession, getCurrentSession } from '@/server/auth/session';
import { prisma } from '@/server/db/prisma/client';

export async function POST(request: Request) {
  const session = await getCurrentSession();

  await destroySession();

  if (session) {
    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId ?? null,
        actorUserId: session.user.id,
        entityType: 'auth',
        entityId: session.user.id,
        action: 'LOGOUT',
        metadata: {}
      }
    });
  }

  return NextResponse.redirect(new URL('/login', request.url));
}
