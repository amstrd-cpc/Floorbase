import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url(),
  APP_URL: z.string().url().default('http://localhost:3000'),
  AUTH_SESSION_SECRET: z.string().min(32),
  AUTH_SESSION_TTL_HOURS: z.coerce.number().int().positive().default(12),
  AUTH_INVITE_TTL_HOURS: z.coerce.number().int().positive().default(72),
  AUTH_COOKIE_NAME: z.string().min(1).default('floorbase_session')
});

export const env = envSchema.parse(process.env);
