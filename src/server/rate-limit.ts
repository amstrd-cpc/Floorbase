// Shared rate limiter. Currently in-memory — resets on process restart and
// does not work across multiple instances.
//
// To upgrade to Redis (recommended before horizontal scaling):
//   npm install @upstash/redis @upstash/ratelimit
//   Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in .env
//   Replace this implementation with @upstash/ratelimit sliding window.

const buckets = new Map<string, { count: number; resetAt: number }>();

// Purge expired entries every 10 minutes to prevent unbounded growth.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}, 10 * 60 * 1000).unref();

export function checkRateLimit(input: {
  key: string;
  limit: number;
  windowMs: number;
}): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const current = buckets.get(input.key);

  if (!current || current.resetAt <= now) {
    buckets.set(input.key, { count: 1, resetAt: now + input.windowMs });
    return { allowed: true, remaining: input.limit - 1 };
  }

  if (current.count >= input.limit) {
    return { allowed: false, remaining: 0 };
  }

  current.count += 1;
  buckets.set(input.key, current);
  return { allowed: true, remaining: input.limit - current.count };
}
