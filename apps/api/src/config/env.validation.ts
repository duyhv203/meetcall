import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  API_PREFIX: z.string().default('/api/v1'),
  WEB_ORIGIN: z.string().default('http://localhost:5173'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters').default('meetcall_super_secret_jwt_key_32_chars_dev_only'),
  JWT_EXPIRES_IN: z.string().default('15m'),

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional().default(''),
  REDIS_URL: z.string().optional(),

  SMTP_HOST: z.string().optional().default('localhost'),
  SMTP_PORT: z.coerce.number().optional().default(1025),
  SMTP_FROM: z.string().optional().default('no-reply@meetcall.local'),

  AGE_VERIFICATION_SECRET: z.string().default('meetcall_age_webhook_secret_dev_only'),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const errorMessages = result.error.errors
      .map((e) => `[${e.path.join('.')}]: ${e.message}`)
      .join('\n');
    throw new Error(`\n❌ Environment variables validation failed:\n${errorMessages}\n`);
  }

  return result.data;
}
