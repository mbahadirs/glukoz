import { Prisma, type PrismaClient, type ReadingSource } from '@prisma/client';
import type { SourceLogbookEntry, SourceReading } from '../sources/types.js';

/** Aynı ts için kaynak önceliği: current > graph > logbook > import. */
export const SOURCE_PRIORITY: Record<ReadingSource, number> = {
  current: 4,
  graph: 3,
  logbook: 2,
  import: 1,
};

const NEAR_DUPLICATE_MS = 30_000;

export interface StoredReading {
  ts: Date;
  mgdl: number;
  trend: number | null;
}

/** ±30 sn içinde aynı değere sahip farklı zaman damgalı okumayı yakın-kopya sayar. */
export function dropNearDuplicates<T extends { ts: Date; mgdl: number }>(
  candidates: readonly T[],
  existing: ReadonlyArray<{ ts: Date; mgdl: number }>,
): T[] {
  const accepted: T[] = [];
  const pool = [...existing];
  for (const c of candidates) {
    const t = c.ts.getTime();
    const dup = pool.some(
      (e) =>
        e.mgdl === c.mgdl &&
        e.ts.getTime() !== t &&
        Math.abs(e.ts.getTime() - t) <= NEAR_DUPLICATE_MS,
    );
    if (!dup) {
      accepted.push(c);
      pool.push(c);
    }
  }
  return accepted;
}

/** Aynı ts'li yinelenenleri tek kayda indirger (son gelen kazanır). */
function uniqueByTs<T extends { ts: Date }>(items: readonly T[]): T[] {
  const m = new Map<number, T>();
  for (const i of items) m.set(i.ts.getTime(), i);
  return [...m.values()].sort((a, b) => a.ts.getTime() - b.ts.getTime());
}

/**
 * Okumaları öncelik kuralıyla upsert eder; yalnızca YENİ eklenen okumaları döndürür.
 */
export async function upsertReadings(
  prisma: PrismaClient,
  patientId: string,
  readings: readonly SourceReading[],
  source: ReadingSource,
): Promise<StoredReading[]> {
  if (readings.length === 0) return [];
  const unique = uniqueByTs(readings);
  const minTs = new Date((unique[0] as SourceReading).ts.getTime() - NEAR_DUPLICATE_MS);
  const maxTs = new Date(
    (unique[unique.length - 1] as SourceReading).ts.getTime() + NEAR_DUPLICATE_MS,
  );
  const existing = await prisma.reading.findMany({
    where: { patientId, ts: { gte: minTs, lte: maxTs } },
    select: { ts: true, mgdl: true },
  });
  const accepted = dropNearDuplicates(unique, existing);
  if (accepted.length === 0) return [];

  const rows = await prisma.$queryRaw<
    Array<{ ts: Date; mgdl: number; trend: number | null; inserted: boolean }>
  >`
    INSERT INTO readings ("patientId", ts, "deviceLocalTs", mgdl, trend, source)
    SELECT ${patientId}, u.ts, u.local, u.mgdl, u.trend, ${source}::"ReadingSource"
    FROM unnest(
      ${accepted.map((r) => r.ts)}::timestamptz[],
      ${accepted.map((r) => r.deviceLocalTs)}::text[],
      ${accepted.map((r) => r.mgdl)}::int[],
      ${accepted.map((r) => r.trend)}::int[]
    ) AS u(ts, local, mgdl, trend)
    ON CONFLICT ("patientId", ts) DO UPDATE
      SET mgdl = EXCLUDED.mgdl,
          trend = COALESCE(EXCLUDED.trend, readings.trend),
          source = EXCLUDED.source,
          "deviceLocalTs" = COALESCE(EXCLUDED."deviceLocalTs", readings."deviceLocalTs")
      WHERE ${priorityCase(Prisma.sql`EXCLUDED.source`)} > ${priorityCase(Prisma.sql`readings.source`)}
    RETURNING ts, mgdl, trend, (xmax = 0) AS inserted`;
  return rows.filter((r) => r.inserted).map(({ ts, mgdl, trend }) => ({ ts, mgdl, trend }));
}

function priorityCase(col: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`(CASE ${col} WHEN 'current' THEN 4 WHEN 'graph' THEN 3 WHEN 'logbook' THEN 2 ELSE 1 END)`;
}

export async function upsertLogbook(
  prisma: PrismaClient,
  patientId: string,
  entries: readonly SourceLogbookEntry[],
): Promise<number> {
  if (entries.length === 0) return 0;
  const res = await prisma.logbookEntry.createMany({
    data: entries.map((e) => ({
      patientId,
      ts: e.ts,
      mgdl: e.mgdl,
      kind: e.kind,
      alarmType: e.alarmType,
    })),
    skipDuplicates: true,
  });
  // Tarama ve alarm kayıtları gerçek ölçümlerdir; okuma olarak da (en düşük LLU önceliğiyle) saklanır.
  await upsertReadings(prisma, patientId, entries, 'logbook');
  return res.count;
}

export async function latestReadingBefore(
  prisma: PrismaClient,
  patientId: string,
  before: Date,
): Promise<Date | null> {
  const r = await prisma.reading.findFirst({
    where: { patientId, ts: { lt: before } },
    orderBy: { ts: 'desc' },
    select: { ts: true },
  });
  return r?.ts ?? null;
}
