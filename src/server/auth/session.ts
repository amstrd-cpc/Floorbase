import { createHash, randomBytes } from 'crypto';
import { cookies } from 'next/headers';
import { env } from '@/env';
import { prisma } from '@/server/db/prisma/client';
import { AUTH_COOKIE_PATH } from './constants';

function hashToken(rawToken: string) {
  return createHash('sha256').update(`${rawToken}.${env.AUTH_SESSION_SECRET}`).digest('hex');
}

function sessionExpiryDate() {
  return new Date(Date.now() + env.AUTH_SESSION_TTL_HOURS * 60 * 60 * 1000);
}

export async function createSession(userId: string) {
  const rawToken = randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = sessionExpiryDate();

  await prisma.authSession.create({
    data: {
      userId,
      tokenHash,
      expiresAt
    }
  });

  cookies().set(env.AUTH_COOKIE_NAME, rawToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    expires: expiresAt,
    path: AUTH_COOKIE_PATH
  });
}

export async function destroySession() {
  const cookieStore = cookies();
  const rawToken = cookieStore.get(env.AUTH_COOKIE_NAME)?.value;

  if (rawToken) {
    await prisma.authSession.deleteMany({ where: { tokenHash: hashToken(rawToken) } });
  }

  cookieStore.set(env.AUTH_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    expires: new Date(0),
    path: AUTH_COOKIE_PATH
  });
}

export async function getCurrentSession() {
  const rawToken = cookies().get(env.AUTH_COOKIE_NAME)?.value;

  if (!rawToken) {
    return null;
  }

  const tokenHash = hashToken(rawToken);

  const session = await prisma.authSession.findUnique({
    where: { tokenHash },
    include: {
      user: {
        include: {
          adminRoles: {
            where: { isActive: true }
          }
        }
      }
    }
  });

  if (!session || session.expiresAt <= new Date() || !session.user.isActive) {
    await prisma.authSession.deleteMany({ where: { tokenHash } });
    return null;
  }

  return session;
}
