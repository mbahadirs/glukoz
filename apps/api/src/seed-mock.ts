/**
 * `pnpm seed:mock` — mock modda 2 sahte hasta için 90 günlük geçmiş veri, sensör geçmişi ve örnek notlar yükler.
 * Gerçek hesap/veri kullanılmaz.
 */
import pino from 'pino';
import { loadEnv } from './config/env.js';
import { Cipher } from './crypto/aes.js';
import { createPrisma } from './lib/prisma.js';
import { ensureDefaultRules } from './alerts/engine.js';
import { upsertReadings } from './collector/store.js';
import { glucoseAt, isGap, mockPatients, mockSensorAt } from './llu/index.js';
import type { SourceReading } from './sources/types.js';

const DAY = 86_400_000;
const STEP = 5 * 60_000;
const DAYS = Number(process.env.SEED_DAYS ?? 90);

async function main(): Promise<void> {
  const env = loadEnv();
  const log = pino({ level: 'info' });
  if (!env.LLU_MOCK) throw new Error('seed:mock yalnızca LLU_MOCK=true iken çalışır.');
  const prisma = createPrisma();
  const cipher = new Cipher(env.ENCRYPTION_KEY);
  const now = Date.now();

  let account = await prisma.lluAccount.findFirst({ where: { label: 'Mock hesap' } });
  account ??= await prisma.lluAccount.create({
    data: {
      label: 'Mock hesap',
      emailEnc: cipher.encrypt('mock@example.com'),
      passwordEnc: cipher.encrypt('mock-password'),
      region: 'eu',
    },
  });
  const author = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
    orderBy: { createdAt: 'asc' },
  });

  for (const mp of mockPatients(now)) {
    const patient = await prisma.patient.upsert({
      where: { accountId_lluPatientId: { accountId: account.id, lluPatientId: mp.patientId } },
      create: {
        accountId: account.id,
        lluPatientId: mp.patientId,
        firstName: mp.firstName,
        lastName: mp.lastName,
        lluTargetLow: 70,
        lluTargetHigh: 180,
        timezone: env.DEFAULT_TIMEZONE,
      },
      update: {},
    });
    await ensureDefaultRules(prisma, patient.id);

    const readings: SourceReading[] = [];
    const start = now - DAYS * DAY;
    for (let t = start - (start % STEP); t < now; t += STEP) {
      if (!isGap(mp.profile, t))
        readings.push({
          ts: new Date(t),
          mgdl: glucoseAt(mp.profile, t),
          trend: null,
          deviceLocalTs: null,
        });
    }
    let added = 0;
    for (let i = 0; i < readings.length; i += 5000) {
      added += (await upsertReadings(prisma, patient.id, readings.slice(i, i + 5000), 'graph'))
        .length;
    }

    // Sensör geçmişi: 15 günlük döngüler; mevcut sensör açık kalır.
    for (let t = now; t > start - 15 * DAY; t -= 15 * DAY) {
      const s = mockSensorAt(mp, t);
      const activatedAt = new Date(s.a * 1000);
      const expectedEnd = new Date(s.a * 1000 + patient.sensorLifeDays * DAY);
      await prisma.sensor.upsert({
        where: { patientId_serial: { patientId: patient.id, serial: s.sn } },
        create: {
          patientId: patient.id,
          serial: s.sn,
          productType: s.pt,
          activatedAt,
          expectedEnd,
          endedAt: t === now ? null : expectedEnd,
        },
        update: {},
      });
    }

    // Son 14 gün için örnek öğün/insülin notları.
    const existingNotes = await prisma.note.count({ where: { patientId: patient.id } });
    if (existingNotes === 0) {
      const notes = [];
      for (let d = 1; d <= 14; d++) {
        const dayStartUtc = Math.floor((now - d * DAY) / DAY) * DAY - 3 * 3600_000; // İstanbul gece yarısı
        for (const [minute, carbs] of [
          [8 * 60, 45],
          [13 * 60, 60],
          [19 * 60 + 30, 70],
        ] as const) {
          const ts = new Date(dayStartUtc + minute * 60_000);
          notes.push({
            patientId: patient.id,
            authorId: author?.id ?? 'seed',
            ts,
            type: 'meal' as const,
            carbsG: carbs,
            text: null,
          });
          notes.push({
            patientId: patient.id,
            authorId: author?.id ?? 'seed',
            ts,
            type: 'insulin_rapid' as const,
            insulinU: carbs / 10,
            text: null,
          });
        }
      }
      await prisma.note.createMany({ data: notes });
    }
    log.info(
      { patient: `${mp.firstName} ${mp.lastName}`, readings: readings.length, added },
      'mock veri yüklendi',
    );
  }
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
