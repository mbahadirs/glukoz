import { beforeEach, describe, expect, it } from 'vitest';
import { mergeDuplicatePatients } from '../src/jobs/merge-duplicates.js';
import { ensureDefaultRules } from '../src/alerts/engine.js';
import { createUser, resetDb, testPrisma } from './helpers.js';

const prisma = testPrisma();
beforeEach(async () => {
  await resetDb();
});

const T = (m: number) => new Date(Date.UTC(2026, 8, 27, 10, m));

async function setup() {
  const userId = await createUser('CAREGIVER', 'c@example.com');
  const oldAcc = await prisma.lluAccount.create({
    data: { label: 'Eski', emailEnc: 'x', passwordEnc: 'x', createdAt: T(0) },
  });
  const newAcc = await prisma.lluAccount.create({
    data: { label: 'Yeni', emailEnc: 'x', passwordEnc: 'x', createdAt: T(30) },
  });
  const old = await prisma.patient.create({
    data: {
      accountId: oldAcc.id,
      lluPatientId: 'llu-1',
      firstName: 'A',
      lastName: 'B',
      displayName: 'Annem',
      targetLow: 80,
      targetHigh: 160,
    },
  });
  const neu = await prisma.patient.create({
    data: { accountId: newAcc.id, lluPatientId: 'llu-1', firstName: 'A', lastName: 'B' },
  });
  await ensureDefaultRules(prisma, old.id);
  await ensureDefaultRules(prisma, neu.id);
  await prisma.collectorRun.create({
    data: { accountId: newAcc.id, startedAt: T(40), durationMs: 1, ok: true },
  });
  await prisma.collectorRun.create({
    data: { accountId: oldAcc.id, startedAt: T(41), durationMs: 1, ok: false },
  });
  await prisma.reading.createMany({
    data: [
      { patientId: old.id, ts: T(1), mgdl: 100, source: 'graph' },
      { patientId: old.id, ts: T(2), mgdl: 105, source: 'current' },
      { patientId: neu.id, ts: T(2), mgdl: 106, source: 'current' }, // çakışma: hedef korunur
      { patientId: neu.id, ts: T(3), mgdl: 110, source: 'current' },
    ],
  });
  await prisma.logbookEntry.create({
    data: { patientId: old.id, ts: T(1), mgdl: 100, kind: 'scan' },
  });
  await prisma.sensor.create({
    data: { patientId: old.id, serial: 'S1', activatedAt: T(0), expectedEnd: T(99) },
  });
  await prisma.sensor.create({
    data: { patientId: neu.id, serial: 'S1', activatedAt: T(0), expectedEnd: T(99) },
  });
  await prisma.note.create({
    data: { patientId: old.id, authorId: userId, ts: T(1), type: 'meal', carbsG: 40 },
  });
  const rule = await prisma.alertRule.findFirstOrThrow({
    where: { patientId: old.id, kind: 'low' },
  });
  await prisma.alertEvent.create({ data: { ruleId: rule.id, patientId: old.id, message: 'x' } });
  await prisma.patientAccess.create({ data: { userId, patientId: old.id, canEdit: true } });
  return { old, neu, oldAcc, newAcc, userId };
}

describe('çift hasta kaydı birleştirme', () => {
  it('eski kaydın verisini çalışan kayda taşır, çakışmada hedefi korur, eski hesabı siler', async () => {
    const { old, neu, oldAcc, userId } = await setup();
    const [r] = await mergeDuplicatePatients(prisma);

    expect(r).toMatchObject({
      targetId: neu.id,
      sourceIds: [old.id],
      deletedAccounts: [oldAcc.id],
    });
    expect(r?.moved).toMatchObject({
      readings: 1,
      logbook: 1,
      sensors: 0,
      notes: 1,
      alertEvents: 1,
    });
    const readings = await prisma.reading.findMany({
      where: { patientId: neu.id },
      orderBy: { ts: 'asc' },
    });
    expect(readings.map((x) => x.mgdl)).toEqual([100, 106, 110]);
    expect(await prisma.patient.count()).toBe(1);
    expect(await prisma.lluAccount.count()).toBe(1);
    const merged = await prisma.patient.findUniqueOrThrow({ where: { id: neu.id } });
    expect(merged).toMatchObject({ displayName: 'Annem', targetLow: 80, targetHigh: 160 });
    const ev = await prisma.alertEvent.findFirstOrThrow();
    const evRule = await prisma.alertRule.findUniqueOrThrow({ where: { id: ev.ruleId } });
    expect(evRule).toMatchObject({ patientId: neu.id, kind: 'low' });
    expect(
      await prisma.patientAccess.findUnique({
        where: { userId_patientId: { userId, patientId: neu.id } },
      }),
    ).not.toBeNull();
    expect(await prisma.note.count({ where: { patientId: neu.id } })).toBe(1);
  });

  it('çift kayıt yoksa hiçbir şey yapmaz; ikinci çalıştırma etkisizdir', async () => {
    expect(await mergeDuplicatePatients(prisma)).toEqual([]);
    await setup();
    await mergeDuplicatePatients(prisma);
    expect(await mergeDuplicatePatients(prisma)).toEqual([]);
    expect(await prisma.reading.count()).toBe(3);
  });
});
