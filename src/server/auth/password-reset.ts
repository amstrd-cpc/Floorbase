import { createHash, randomBytes } from 'crypto';
import { env } from '@/env';
import { prisma } from '@/server/db/prisma/client';
import { hashPassword } from './password';

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

function hashToken(rawToken: string) {
  return createHash('sha256')
    .update(`${rawToken}.${env.AUTH_SESSION_SECRET}`)
    .digest('hex');
}

export async function createPasswordResetToken(
  email: string
): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, isActive: true }
  });

  if (!user || !user.isActive) {
    return null;
  }

  // Invalidate any existing unexpired tokens for this user
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
    data: { expiresAt: new Date() }
  });

  const rawToken = randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + RESET_TTL_MS)
    }
  });

  return rawToken;
}

export async function consumePasswordResetToken(
  rawToken: string,
  newPassword: string
): Promise<{ ok: boolean; error?: string }> {
  if (!rawToken || !newPassword) {
    return { ok: false, error: 'Missing token or password.' };
  }

  if (newPassword.length < 12 || newPassword.length > 128) {
    return {
      ok: false,
      error: 'Password must be between 12 and 128 characters.'
    };
  }

  const tokenHash = hashToken(rawToken);

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, isActive: true } } }
  });

  if (!record || record.usedAt || record.expiresAt <= new Date()) {
    return { ok: false, error: 'This reset link is invalid or has expired.' };
  }

  if (!record.user.isActive) {
    return { ok: false, error: 'Account is inactive.' };
  }

  const passwordHash = await hashPassword(newPassword);

  // Atomically claim the token by flipping usedAt only if it is still null.
  // This prevents two concurrent requests for the same token from both
  // succeeding and the second overwriting the first user-chosen password.
  const claimed = await prisma.passwordResetToken.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() }
  });

  if (claimed.count === 0) {
    return { ok: false, error: 'This reset link is invalid or has expired.' };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash }
    }),
    // Invalidate all active sessions so old sessions can't be reused
    prisma.authSession.deleteMany({ where: { userId: record.userId } })
  ]);

  return { ok: true };
}
