import type { FastifyBaseLogger } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import type { Env } from '../config/env.js';

const DAY = 86_400_000;
const OPERATIONAL_RETENTION_DAYS = 90;

/** KVKK saklama süresi: eski okumalar, notlar, logbook ve operasyonel kayıtlar silinir. */
export async function runRetention(prisma: PrismaClient, env: Env, now = Date.now()) {
  const cutoff = new Date(now - env.DATA_RETENTION_DAYS * DAY);
  const opsCutoff = new Date(now - OPERATIONAL_RETENTION_DAYS * DAY);
  const [readings, notes, logbook, alerts, runs, sessions] = await prisma.$transaction([
    prisma.reading.deleteMany({ where: { ts: { lt: cutoff } } }),
    prisma.note.deleteMany({ where: { ts: { lt: cutoff } } }),
    prisma.logbookEntry.deleteMany({ where: { ts: { lt: cutoff } } }),
    prisma.alertEvent.deleteMany({ where: { firedAt: { lt: cutoff } } }),
    prisma.collectorRun.deleteMany({ where: { startedAt: { lt: opsCutoff } } }),
    prisma.session.deleteMany({ where: { expiresAt: { lt: new Date(now) } } }),
  ]);
  return {
    readings: readings.count,
    notes: notes.count,
    logbook: logbook.count,
    alerts: alerts.count,
    runs: runs.count,
    sessions: sessions.count,
  };
}

export function startRetentionJob(
  prisma: PrismaClient,
  env: Env,
  log: FastifyBaseLogger,
): { stop: () => void } {
  const run = () =>
    runRetention(prisma, env)
      .then((r) => log.info(r, 'saklama işi tamamlandı'))
      .catch((err) => log.error({ err }, 'saklama işi hata verdi'));
  const first = setTimeout(run, 60_000);
  const timer = setInterval(run, DAY);
  return {
    stop: () => {
      clearTimeout(first);
      clearInterval(timer);
    },
  };
}
