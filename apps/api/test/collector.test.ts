import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { LluError } from '../src/llu/errors.js';
import { FakeLlu } from './fake-llu.js';
import { makeApp, resetDb, testPrisma } from './helpers.js';

const MIN = 60_000;
const prisma = testPrisma();
let fake: FakeLlu;
let app: FastifyInstance;

async function account(label = 'Hesap') {
  return prisma.lluAccount.create({
    data: {
      label,
      emailEnc: app.ctx.cipher.encrypt('f@example.com'),
      passwordEnc: app.ctx.cipher.encrypt('pw'),
    },
  });
}
const readings = async () => prisma.reading.findMany({ orderBy: { ts: 'asc' } });

beforeAll(async () => {
  app = await makeApp(() => fake);
});
afterAll(async () => {
  await app.close();
});
beforeEach(async () => {
  await resetDb();
  fake = new FakeLlu();
  app.ctx.collector.forget('*');
});

describe('Collector', () => {
  it('ilk döngü: hasta, varsayılan kurallar, sensör, current + graph backfill, logbook', async () => {
    const now = Date.now() - (Date.now() % 1000);
    fake.current = { ms: now, mgdl: 120, trend: 4 };
    fake.graphPoints = [
      [now - 30 * MIN, 100],
      [now - 15 * MIN, 110],
    ];
    fake.logbookPoints = [
      [now - 60 * MIN, 95, null],
      [now - 90 * MIN, 60, 0],
    ];
    const acc = await account();
    const r = await app.ctx.collector.runAccount(acc);
    expect(r).toMatchObject({ ok: true, newReadings: 3 });

    const patient = await prisma.patient.findFirstOrThrow();
    expect(patient).toMatchObject({
      firstName: 'Fake',
      lluTargetLow: 70,
      timezone: 'Europe/Istanbul',
    });
    expect(await prisma.alertRule.count({ where: { patientId: patient.id } })).toBe(7);
    expect(await prisma.sensor.count()).toBe(1);
    const rows = await readings();
    expect(rows.map((x) => [x.mgdl, x.source])).toEqual([
      [60, 'logbook'],
      [95, 'logbook'],
      [100, 'graph'],
      [110, 'graph'],
      [120, 'current'],
    ]);
    expect(rows[4]?.trend).toBe(4);
    expect(await prisma.logbookEntry.count({ where: { kind: 'alarm' } })).toBe(1);
    expect((await prisma.collectorRun.findFirstOrThrow()).ok).toBe(true);
  });

  it('tekrar yok: aynı veriyle ikinci döngü yeni okuma eklemez', async () => {
    const acc = await account();
    await app.ctx.collector.runAccount(acc);
    const r2 = await app.ctx.collector.runAccount(acc);
    expect(r2.newReadings).toBe(0);
    expect(await prisma.reading.count()).toBe(1);
    expect(fake.calls.graph).toBe(1); // 15 dk dolmadan graph tekrar çağrılmaz
  });

  it('öncelik: current > graph; graph aynı ts current değerini ezmez', async () => {
    const now = Date.now() - (Date.now() % 1000);
    fake.current = { ms: now, mgdl: 150, trend: 3 };
    fake.graphPoints = [[now, 149]];
    const acc = await account();
    await app.ctx.collector.runAccount(acc);
    const rows = await readings();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ mgdl: 150, source: 'current' });
  });

  it('> 15 dk boşlukta graph ile backfill', async () => {
    const t0 = Date.now() - 60 * MIN;
    fake.current = { ms: t0, mgdl: 100, trend: 3 };
    const acc = await account();
    await app.ctx.collector.runAccount(acc);
    expect(fake.calls.graph).toBe(1);
    fake.current = { ms: t0 + 40 * MIN, mgdl: 130, trend: 3 };
    fake.graphPoints = [
      [t0 + 15 * MIN, 110],
      [t0 + 30 * MIN, 120],
    ];
    const r = await app.ctx.collector.runAccount(acc);
    expect(fake.calls.graph).toBe(2);
    expect(r.newReadings).toBe(3);
  });

  it('sensör değişimi eskisini kapatır', async () => {
    const acc = await account();
    await app.ctx.collector.runAccount(acc);
    fake.sensor = { sn: 'SN2', a: Math.floor(Date.now() / 1000), pt: 4 };
    fake.current = { ...fake.current, ms: fake.current.ms + MIN };
    await app.ctx.collector.runAccount(acc);
    const sensors = await prisma.sensor.findMany({ orderBy: { activatedAt: 'asc' } });
    expect(sensors.map((s) => [s.serial, s.endedAt !== null])).toEqual([
      ['SN1', true],
      ['SN2', false],
    ]);
    expect(sensors[1]!.expectedEnd.getTime() - sensors[1]!.activatedAt.getTime()).toBe(
      15 * 86_400_000,
    );
  });

  it('eşzamanlılık: aynı hesap için ikinci döngü atlanır; advisory lock tutuluyorsa atlanır', async () => {
    const acc = await account();
    const [a, b] = await Promise.all([
      app.ctx.collector.runAccount(acc),
      app.ctx.collector.runAccount(acc),
    ]);
    expect([a.skipped, b.skipped]).toContain('busy');

    let release!: () => void;
    const held = new Promise<void>((r) => (release = r));
    const locker = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'collector:' + acc.id}))::text AS locked`;
      await held;
    });
    await new Promise((r) => setTimeout(r, 100));
    const res = await app.ctx.collector.runAccount(acc);
    release();
    await locker;
    expect(res.skipped).toBe('locked');
  });

  it('hatalı kimlik bilgisi → hesap hemen duraklatılır', async () => {
    const acc = await account();
    fake.fail = new LluError('LLU_BAD_CREDENTIALS', 'x');
    const r = await app.ctx.collector.runAccount(acc);
    expect(r).toMatchObject({ ok: false, errorCode: 'LLU_BAD_CREDENTIALS' });
    expect(await prisma.lluAccount.findUniqueOrThrow({ where: { id: acc.id } })).toMatchObject({
      status: 'paused',
      failCount: 1,
    });
  });

  it('art arda 3 yetki hatası → paused; ağ hatası duraklatmaz ama geri çekilir', async () => {
    const acc = await account();
    fake.fail = new LluError('LLU_NETWORK', 'x');
    await app.ctx.collector.runAccount(acc);
    expect(await prisma.lluAccount.findUniqueOrThrow({ where: { id: acc.id } })).toMatchObject({
      status: 'active',
      failCount: 0,
    });
    expect((await app.ctx.collector.runAccount(acc)).skipped).toBe('backoff');

    fake.fail = new LluError('LLU_UNAUTHORIZED', 'x');
    for (let i = 0; i < 3; i++) {
      app.ctx.collector.forget(acc.id);
      await app.ctx.collector.runAccount(
        await prisma.lluAccount.findUniqueOrThrow({ where: { id: acc.id } }),
      );
    }
    const final = await prisma.lluAccount.findUniqueOrThrow({ where: { id: acc.id } });
    expect(final).toMatchObject({ status: 'paused', failCount: 3 });
    expect(final.lastError).toContain('LLU_UNAUTHORIZED');
    expect(await prisma.collectorRun.count({ where: { ok: false } })).toBe(4);
  });

  it('920 → minimumVersion ayara kaydedilir', async () => {
    const acc = await account();
    fake.fail = new LluError('LLU_VERSION_TOO_OLD', 'x', { minimumVersion: '5.0.0' });
    await app.ctx.collector.runAccount(acc);
    expect(await app.ctx.settings.get('llu.minimumVersionSeen')).toBe('5.0.0');
  });

  it('düşük değer uyarı olayı üretir ve cooldown uygular', async () => {
    const acc = await account();
    fake.current = { ms: Date.now(), mgdl: 50, trend: 2 };
    await app.ctx.collector.runAccount(acc);
    const events = await prisma.alertEvent.findMany();
    expect(events.map((e) => e.message)).toEqual([expect.stringContaining('Çok düşük')]);
    fake.current = { ms: Date.now() + 1000, mgdl: 49, trend: 2 };
    await app.ctx.collector.runAccount(acc);
    expect(await prisma.alertEvent.count()).toBe(1);
  });
});
