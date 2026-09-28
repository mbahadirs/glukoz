import { beforeEach, describe, expect, it } from 'vitest';
import { exportSnapshot, restoreSnapshot } from '../src/snapshot.js';
import { createPatientFixture, createUser, resetDb, testPrisma } from './helpers.js';

const prisma = testPrisma();
beforeEach(async () => {
  await resetDb();
});

describe('anlık görüntü (taşıma)', () => {
  it('dışa aktarır, boş veritabanına aynen geri yükler', async () => {
    const userId = await createUser('ADMIN', 'a@example.com');
    const { p1 } = await createPatientFixture();
    await prisma.reading.createMany({
      data: [
        {
          patientId: p1.id,
          ts: new Date('2026-09-27T10:00:00Z'),
          mgdl: 120,
          trend: 3,
          source: 'current',
        },
        { patientId: p1.id, ts: new Date('2026-09-27T10:01:00Z'), mgdl: 121, source: 'graph' },
      ],
    });
    await prisma.note.create({
      data: {
        patientId: p1.id,
        authorId: userId,
        ts: new Date(),
        type: 'water',
        waterMl: 330,
        insulinU: '4.50',
      },
    });
    await prisma.auditLog.create({ data: { userId, action: 'login' } });
    await prisma.setting.create({ data: { key: 'llu.version', value: '4.17.0' } });
    await prisma.session.create({
      data: { id: 'x', userId, expiresAt: new Date(Date.now() + 1e6) },
    });

    const b64 = await exportSnapshot(prisma);
    await resetDb();
    const r = await restoreSnapshot(prisma, b64);

    expect(r.restored).toBe(true);
    expect(r.counts).toMatchObject({
      users: 1,
      patients: 2,
      readings: 2,
      notes: 1,
      auditLogs: 1,
      settings: 1,
    });
    expect(await prisma.session.count()).toBe(0); // oturumlar taşınmaz
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.email).toBe('a@example.com');
    const note = await prisma.note.findFirstOrThrow();
    expect(note).toMatchObject({ waterMl: 330 });
    expect(Number(note.insulinU)).toBe(4.5);
    // otomatik artan kimlikler yeniden üretildiği için yeni kayıt çakışmaz
    await prisma.reading.create({
      data: { patientId: p1.id, ts: new Date(), mgdl: 100, source: 'current' },
    });
    expect(await prisma.reading.count()).toBe(3);
  });

  it('hedefte kullanıcı varsa hiçbir şeyi ezmez', async () => {
    await createUser('ADMIN', 'a@example.com');
    const b64 = await exportSnapshot(prisma);
    const r = await restoreSnapshot(prisma, b64);
    expect(r.restored).toBe(false);
    expect(await prisma.user.count()).toBe(1);
  });

  it('bozuk veya yanlış sürümlü veri reddedilir', async () => {
    const { gzipSync } = await import('node:zlib');
    const bad = gzipSync(Buffer.from(JSON.stringify({ version: 99, tables: {} }))).toString(
      'base64',
    );
    await expect(restoreSnapshot(prisma, bad)).rejects.toThrow(/sürüm/);
  });
});
