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
  AUTH_COOKIE_NAME: z.string().min(1).default('floorbase_session'),
  // Stripe — required in production, optional in dev/test
  STRIPE_SECRET_KEY: z.string().startsWith('sk_').optional(),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_').optional(),
  STRIPE_PRICE_ID: z.string().startsWith('price_').optional(),
  // Separate webhook endpoint/secret from the SaaS billing one above — this
  // one is for guest-facing reservation deposits, a different Stripe
  // webhook subscription in the dashboard (payment_intent.* events).
  STRIPE_DEPOSITS_WEBHOOK_SECRET: z.string().startsWith('whsec_').optional(),
  // Resend — optional; email sending is skipped when absent
  RESEND_API_KEY: z.string().startsWith('re_').optional(),
  EMAIL_FROM: z.string().default('Floorbase <noreply@floorbase.app>')
});

export const env = envSchema.parse(process.env);
