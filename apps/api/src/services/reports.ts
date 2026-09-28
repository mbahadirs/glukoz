import type { Patient, PrismaClient } from '@prisma/client';
import { buildReport, compareReports } from '@glukoz/metrics';
import type { GlucoseReport, ReportComparison } from '@glukoz/shared';
import { loadMeals, loadPoints } from './readings.js';

const TTL_MS = 5 * 60_000;
const MAX_ENTRIES = 200;

/** Rapor hesaplama + `(patientId, from, to, lastReadingTs)` anahtarlı 5 dk bellek önbelleği. */
export class ReportService {
  private readonly cache = new Map<string, { at: number; value: GlucoseReport }>();

  constructor(private readonly prisma: PrismaClient) {}

  async report(patient: Patient, from: Date, to: Date): Promise<GlucoseReport> {
    const last = await this.prisma.reading.findFirst({
      where: { patientId: patient.id, ts: { lt: to } },
      orderBy: { ts: 'desc' },
      select: { ts: true },
    });
    const key = [
      patient.id,
      from.getTime(),
      to.getTime(),
      last?.ts.getTime() ?? 0,
      patient.targetLow,
      patient.targetHigh,
      patient.timezone,
    ].join('|');
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

    const [points, meals] = await Promise.all([
      loadPoints(this.prisma, patient.id, from, to),
      loadMeals(this.prisma, patient.id, from, to),
    ]);
    const value = buildReport(points, {
      from: from.getTime(),
      to: to.getTime(),
      timezone: patient.timezone,
      targetLow: patient.targetLow,
      targetHigh: patient.targetHigh,
      meals,
      includeDailySlots: to.getTime() - from.getTime() <= 31 * 86_400_000,
    });
    this.store(key, value);
    return value;
  }

  async compare(patient: Patient, from: Date, to: Date): Promise<ReportComparison> {
    const span = to.getTime() - from.getTime();
    const [current, previous] = await Promise.all([
      this.report(patient, from, to),
      this.report(patient, new Date(from.getTime() - span), from),
    ]);
    return compareReports(current, previous);
  }

  invalidatePatient(patientId: string): void {
    for (const k of this.cache.keys()) if (k.startsWith(`${patientId}|`)) this.cache.delete(k);
  }

  private store(key: string, value: GlucoseReport): void {
    const now = Date.now();
    for (const [k, v] of this.cache) if (now - v.at >= TTL_MS) this.cache.delete(k);
    if (this.cache.size >= MAX_ENTRIES) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(key, { at: now, value });
  }
}
