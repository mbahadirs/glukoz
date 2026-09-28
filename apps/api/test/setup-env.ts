// Test ortamı: ayrı veritabanı, sabit anahtarlar, mock kapalı (testler istemciyi kendileri enjekte eder).
const user = process.env.USER ?? 'postgres';
process.env.NODE_ENV = 'test';
// Kabuktaki DATABASE_URL asla kullanılmaz (TRUNCATE yalnızca test veritabanında).
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? `postgresql://${user}@localhost:5432/glukoz_test`;
process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
process.env.SESSION_SECRET = 'test-session-secret-at-least-32-characters-long';
process.env.LLU_MOCK = 'false';
process.env.LOG_LEVEL = 'silent';
process.env.COLLECTOR_ENABLED = 'false';
