import { execSync } from 'node:child_process';

/**
 * Test veritabanına migration'ları uygular (yıkıcı değildir). Testler arası temizlik
 * `helpers.resetDb` ile yalnızca test veritabanında yapılır.
 */
export default function setup(): void {
  const user = process.env.USER ?? 'postgres';
  const url = process.env.TEST_DATABASE_URL ?? `postgresql://${user}@localhost:5432/glukoz_test`;
  if (!/_test(\?|$)/.test(new URL(url).pathname + (new URL(url).search || ''))) {
    throw new Error('Testler yalnızca adı _test ile biten bir veritabanında çalışır.');
  }
  execSync('npx prisma migrate deploy', {
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: url },
  });
}
