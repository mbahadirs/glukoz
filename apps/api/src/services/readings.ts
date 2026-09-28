import type { PrismaClient } from '@prisma/client';
import type { GlucosePoint } from '@glukoz/shared';

export async function loadPoints(
  prisma: PrismaClient,
  patientId: string,
  from: Date,
  to: Date,
): Promise<GlucosePoint[]> {
  const rows = await prisma.reading.findMany({
    where: { patientId, ts: { gte: from, lt: to } },
    orderBy: { ts: 'asc' },
    select: { ts: true, mgdl: true },
  });
  return rows.map((r) => ({ ts: r.ts.getTime(), mgdl: r.mgdl }));
}

export async function loadMeals(prisma: PrismaClient, patientId: string, from: Date, to: Date) {
  const notes = await prisma.note.findMany({
    where: { patientId, type: 'meal', ts: { gte: from, lt: to } },
    orderBy: { ts: 'asc' },
    select: { id: true, ts: true, carbsG: true },
  });
  return notes.map((n) => ({ id: n.id, ts: n.ts.getTime(), carbsG: n.carbsG }));
}
