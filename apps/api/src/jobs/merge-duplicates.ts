import type { PrismaClient } from '@prisma/client';

/**
 * Aynı LibreLinkUp hastasının (lluPatientId) birden fazla hesap altında kaydı varsa
 * (ör. hesap yeniden eklendiğinde) verileri tek kayıtta birleştirir.
 *
 * Hedef: en son başarılı veri çekimi olan hesabın kaydı (yoksa en yeni hesap).
 * Okuma/logbook/sensör çakışmalarında hedefteki kayıt korunur (tekrar yok); notlar ve
 * uyarı geçmişi taşınır; hasta ayarları (takma ad, hedefler, saat dilimi, sensör ömrü)
 * eski kayıttan alınır. İçi boşalan eski hesap silinir (yeniden çift kayıt oluşmasın diye).
 */

export interface MergeResult {
  lluPatientId: string;
  targetId: string;
  sourceIds: string[];
  moved: { readings: number; logbook: number; sensors: number; notes: number; alertEvents: number };
  deletedAccounts: string[];
}

async function pickTarget(prisma: PrismaClient, patientIds: string[]) {
  const patients = await prisma.patient.findMany({
    where: { id: { in: patientIds } },
    include: { account: true },
  });
  const lastOk = await Promise.all(
    patients.map(async (p) => {
      const run = await prisma.collectorRun.findFirst({
        where: { accountId: p.accountId, ok: true },
        orderBy: { startedAt: 'desc' },
        select: { startedAt: true },
      });
      return { p, at: run?.startedAt.getTime() ?? 0 };
    }),
  );
  lastOk.sort(
    (a, b) => b.at - a.at || b.p.account.createdAt.getTime() - a.p.account.createdAt.getTime(),
  );
  return { target: lastOk[0]!.p, sources: lastOk.slice(1).map((x) => x.p) };
}

export async function mergeDuplicatePatients(prisma: PrismaClient): Promise<MergeResult[]> {
  const groups = await prisma.patient.groupBy({
    by: ['lluPatientId'],
    _count: { _all: true },
    having: { lluPatientId: { _count: { gt: 1 } } },
  });
  const results: MergeResult[] = [];
  for (const g of groups) {
    const ids = (
      await prisma.patient.findMany({
        where: { lluPatientId: g.lluPatientId },
        select: { id: true },
      })
    ).map((p) => p.id);
    const { target, sources } = await pickTarget(prisma, ids);
    const moved = { readings: 0, logbook: 0, sensors: 0, notes: 0, alertEvents: 0 };
    const deletedAccounts: string[] = [];

    await prisma.$transaction(
      async (tx) => {
        for (const src of sources) {
          moved.readings += await tx.$executeRaw`
            INSERT INTO readings ("patientId", ts, "deviceLocalTs", mgdl, trend, source, "createdAt")
            SELECT ${target.id}, ts, "deviceLocalTs", mgdl, trend, source, "createdAt"
            FROM readings WHERE "patientId" = ${src.id}
            ON CONFLICT ("patientId", ts) DO NOTHING`;
          moved.logbook += await tx.$executeRaw`
            INSERT INTO logbook_entries ("patientId", ts, mgdl, kind, "alarmType")
            SELECT ${target.id}, ts, mgdl, kind, "alarmType"
            FROM logbook_entries WHERE "patientId" = ${src.id}
            ON CONFLICT ("patientId", ts, kind) DO NOTHING`;
          moved.sensors += await tx.$executeRaw`
            INSERT INTO sensors (id, "patientId", serial, "productType", "activatedAt", "expectedEnd", "endedAt")
            SELECT gen_random_uuid()::text, ${target.id}, serial, "productType", "activatedAt", "expectedEnd", "endedAt"
            FROM sensors WHERE "patientId" = ${src.id}
            ON CONFLICT ("patientId", serial) DO NOTHING`;
          moved.notes += (
            await tx.note.updateMany({
              where: { patientId: src.id },
              data: { patientId: target.id },
            })
          ).count;
          // Uyarı olaylarını hedefteki aynı türden kurala bağla, sonra taşı.
          await tx.$executeRaw`
            UPDATE alert_events e SET "ruleId" = tr.id
            FROM alert_rules sr, alert_rules tr
            WHERE e."ruleId" = sr.id AND sr."patientId" = ${src.id}
              AND tr."patientId" = ${target.id} AND tr.kind = sr.kind`;
          moved.alertEvents += (
            await tx.alertEvent.updateMany({
              where: { patientId: src.id },
              data: { patientId: target.id },
            })
          ).count;
          await tx.$executeRaw`
            INSERT INTO patient_access ("userId", "patientId", "canEdit")
            SELECT "userId", ${target.id}, "canEdit" FROM patient_access WHERE "patientId" = ${src.id}
            ON CONFLICT ("userId", "patientId") DO NOTHING`;
          await tx.patient.update({
            where: { id: target.id },
            data: {
              displayName: target.displayName ?? src.displayName,
              targetLow: src.targetLow,
              targetHigh: src.targetHigh,
              timezone: src.timezone,
              sensorLifeDays: src.sensorLifeDays,
            },
          });
          await tx.patient.delete({ where: { id: src.id } }); // kalan satırlar cascade ile silinir
          if ((await tx.patient.count({ where: { accountId: src.accountId } })) === 0) {
            await tx.collectorRun.deleteMany({ where: { accountId: src.accountId } });
            await tx.lluAccount.delete({ where: { id: src.accountId } });
            deletedAccounts.push(src.accountId);
          }
        }
      },
      { timeout: 120_000 },
    );
    results.push({
      lluPatientId: g.lluPatientId,
      targetId: target.id,
      sourceIds: sources.map((s) => s.id),
      moved,
      deletedAccounts,
    });
  }
  return results;
}
