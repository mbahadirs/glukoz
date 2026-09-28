import { loadEnv } from './config/env.js';
import { createPrisma } from './lib/prisma.js';
import { buildApp } from './app.js';
import { startRetentionJob } from './jobs/retention.js';
import { mergeDuplicatePatients } from './jobs/merge-duplicates.js';

async function main(): Promise<void> {
  let env;
  try {
    env = loadEnv();
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }
  const prisma = createPrisma();
  const app = await buildApp({ env, prisma });
  if (env.LLU_MOCK)
    app.log.warn('LLU_MOCK=true — sentetik veri kullanılıyor, LibreLinkUp çağrısı yapılmıyor');
  if (!app.ctx.push.enabled) app.log.warn('VAPID anahtarları yok — Web Push devre dışı');

  await app.listen({ port: env.PORT, host: env.HOST });
  if (env.MERGE_DUPLICATE_PATIENTS) {
    // Collector başlamadan önce: aynı LLU hastasının çift kayıtlarını birleştir.
    try {
      const merged = await mergeDuplicatePatients(prisma);
      app.log.warn(
        { merged },
        merged.length ? 'çift hasta kayıtları birleştirildi' : 'birleştirilecek çift kayıt yok',
      );
    } catch (err) {
      app.log.error({ err }, 'çift kayıt birleştirme başarısız (veri değişmedi)');
    }
  }
  if (env.COLLECTOR_ENABLED) app.ctx.collector.start();
  const retention = startRetentionJob(prisma, env, app.log);

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    app.log.info({ signal }, 'kapanıyor');
    retention.stop();
    await app.ctx.collector.stop(10_000);
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

void main();
