import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url(),
  APP_URL: z.string().url().default('http://localhost:3000'),
  AUTH_SESSION_SECRET: z.string().min(32).refine(
    (s) => {
      const freq = new Map<string, number>();
      for (const c of s) freq.set(c, (freq.get(c) ?? 0) + 1);
      const entropy = [...freq.values()].reduce((sum, count) => {
        const p = count / s.length;
        return sum - p * Math.log2(p);
      }, 0);
      return entropy >= 3.5;
    },
    { message: 'AUTH_SESSION_SECRET has insufficient entropy. Generate with: openssl rand -hex 32' }
  ),
  AUTH_SESSION_TTL_HOURS: z.coerce.number().int().positive().default(12),
  AUTH_INVITE_TTL_HOURS: z.coerce.number().int().positive().default(72),
  AUTH_COOKIE_NAME: z.string().min(1).default('floorbase_session')
});

export const env = envSchema.parse(process.env);
