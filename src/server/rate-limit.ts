import { prisma } from '@/server/db/prisma/client';

// Shared, DB-backed rate limiter (RateLimitBucket table) so limits hold
// across instances/restarts, not just within one process's memory.
//
// The increment is a single atomic upsert (INSERT ... ON CONFLICT DO
// UPDATE), so concurrent requests for the same key can't race a
// read-then-write like the in-memory Map version could.

export async function checkRateLimit(input: {
  key: string;
  limit: number;
  windowMs: number;
}): Promise<{ allowed: boolean; remaining: number }> {
  const resetAt = new Date(Date.now() + input.windowMs);

  const rows = await prisma.$queryRaw<Array<{ count: number; resetAt: Date }>>`
    INSERT INTO "RateLimitBucket" ("key", "count", "resetAt")
    VALUES (${input.key}, 1, ${resetAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimitBucket"."resetAt" <= now() THEN 1
        ELSE "RateLimitBucket"."count" + 1
      END,
      "resetAt" = CASE
        WHEN "RateLimitBucket"."resetAt" <= now() THEN ${resetAt}
        ELSE "RateLimitBucket"."resetAt"
      END
    RETURNING "count", "resetAt"
  `;

  const { count } = rows[0];

  // ponytail: probabilistic cleanup of expired buckets instead of a cron job —
  // fine at this key cardinality; move to a scheduled delete if it isn't.
  if (Math.random() < 0.01) {
    await prisma.rateLimitBucket.deleteMany({ where: { resetAt: { lt: new Date() } } });
  }

  return {
    allowed: count <= input.limit,
    remaining: Math.max(0, input.limit - count)
  };
}
