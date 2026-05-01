import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  REFRESH_SECRET: z.string().min(32, 'REFRESH_SECRET must be at least 32 characters'),
  REFRESH_EXPIRES_IN: z.string().default('30d'),
  COOKIE_SECRET: z.string().min(32, 'COOKIE_SECRET must be at least 32 characters').default('change-me-at-least-32-chars-long-cookie-secret'),
  COOKIE_SECURE: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  COOKIE_DOMAIN: z.string().optional(),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  PHOTOS_DIR: z.string().default('./data/photos'),
  FACE_SERVICE_URL: z.string().default('http://localhost:8001'),
  FACE_MATCH_THRESHOLD: z.coerce.number().min(0).max(1).default(0.6),

  // Backups
  BACKUPS_DIR: z.string().default('./data/backups'),
  BACKUP_CRON: z.string().default('0 3 * * *'),
  BACKUP_RETENTION_DAILY: z.coerce.number().int().positive().default(30),
  BACKUP_RETENTION_MONTHLY: z.coerce.number().int().positive().default(12),
  BACKUP_MODE: z.enum(['prisma', 'pgdump']).default('prisma'),
  BACKUP_AUTO_ON_PAYMENT: z
    .string()
    .default('true')
    .transform((v) => v === 'true'),
  PG_DUMP_PATH: z.string().default('pg_dump'),
  BACKUP_RESTORE_TOKEN: z.string().min(16, 'BACKUP_RESTORE_TOKEN must be at least 16 characters').optional(),

  // SMS
  SMS_PROVIDER: z.enum(['console', 'twilio', 'vonage', 'http']).default('console'),
  SMS_FROM: z.string().default(''),
  SMS_DAILY_PER_MEMBER_CAP: z.coerce.number().int().positive().default(5),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  VONAGE_API_KEY: z.string().optional(),
  VONAGE_API_SECRET: z.string().optional(),
  SMS_HTTP_URL: z.string().optional(),
  SMS_HTTP_TOKEN: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}
