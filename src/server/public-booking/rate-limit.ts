const buckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(input: {
  key: string;
  limit: number;
  windowMs: number;
}) {
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
