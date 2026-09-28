import { z } from 'zod';

/** Koddaki sabit alt sınır: polling asla 60 sn'nin altına inemez. */
export const MIN_POLL_SECONDS = 60;

const bool = z
  .enum(['true', 'false', '1', '0', ''])
  .default('false')
  .transform((v) => v === 'true' || v === '1');

const base64Key32 = z
  .string()
  .min(1, 'zorunlu — `openssl rand -base64 32` ile üretin')
  .refine((v) => Buffer.from(v, 'base64').length === 32, '32 bayt base64 olmalı');

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_URL: z.string().url().default('http://localhost:3000'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1),
  ENCRYPTION_KEY: base64Key32,
  SESSION_SECRET: z.string().min(32, 'en az 32 karakter olmalı'),

  LLU_PRODUCT: z.string().min(1).default('llu.android'),
  LLU_VERSION: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/)
    .default('4.16.0'),
  LLU_POLL_SECONDS: z.coerce
    .number()
    .int()
    .default(60)
    .transform((v) => Math.max(MIN_POLL_SECONDS, v)),
  LLU_GRAPH_MINUTES: z.coerce.number().int().min(5).default(15),
  LLU_LOGBOOK_HOURS: z.coerce.number().int().min(1).default(6),
  LLU_MOCK: bool,
  LLU_MOCK_FAIL: z.enum(['none', '401', '429', '920', 'network']).default('none'),
  COLLECTOR_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),

  VAPID_PUBLIC_KEY: z.string().default(''),
  VAPID_PRIVATE_KEY: z.string().default(''),
  VAPID_SUBJECT: z.string().default('mailto:admin@example.com'),

  DEFAULT_TIMEZONE: z.string().default('Europe/Istanbul'),
  DATA_RETENTION_DAYS: z.coerce.number().int().min(30).default(730),
  REPORT_PDF_SERVER: bool,
  ALERT_NOTIFY_RESOLVED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  WEB_DIST: z.string().optional(),
  /** true: açılışta aynı LLU hastasının çift kayıtlarını birleştir (bkz. jobs/merge-duplicates.ts) */
  MERGE_DUPLICATE_PATIENTS: bool,
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Geçersiz ortam değişkenleri (.env):\n${lines.join('\n')}`);
  }
  return parsed.data;
}
