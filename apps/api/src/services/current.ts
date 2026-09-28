import type { Patient, PrismaClient, Sensor } from '@prisma/client';
import {
  dateKey,
  detectEvents,
  liveDelta,
  resample5m,
  timeInRanges,
  zonedDayStart,
} from '@glukoz/metrics';
import type { CurrentResponse, SensorInfo } from '@glukoz/shared';
import { loadPoints } from './readings.js';

export function toSensorInfo(s: Sensor): SensorInfo {
  return {
    id: s.id,
    serial: s.serial,
    productType: s.productType,
    activatedAt: s.activatedAt.toISOString(),
    expectedEnd: s.expectedEnd.toISOString(),
    endedAt: s.endedAt?.toISOString() ?? null,
  };
}

export async function buildCurrent(
  prisma: PrismaClient,
  patient: Patient,
  now = Date.now(),
): Promise<CurrentResponse> {
  const last = await prisma.reading.findFirst({
    where: { patientId: patient.id },
    orderBy: { ts: 'desc' },
  });
  const sensor = await prisma.sensor.findFirst({
    where: { patientId: patient.id, endedAt: null },
    orderBy: { activatedAt: 'desc' },
  });
  const run = await prisma.collectorRun.findFirst({
    where: { accountId: patient.accountId, ok: true },
    orderBy: { startedAt: 'desc' },
    select: { startedAt: true },
  });

  const dayStart = zonedDayStart(dateKey(now, patient.timezone), patient.timezone);
  const today = await loadPoints(prisma, patient.id, new Date(dayStart), new Date(now + 60_000));
  const slots = resample5m(today);
  const values = slots.map((s) => s.mgdl);
  const recent = last
    ? await loadPoints(
        prisma,
        patient.id,
        new Date(last.ts.getTime() - 10 * 60_000),
        new Date(last.ts.getTime() + 1),
      )
    : [];

  return {
    patientId: patient.id,
    reading: last ? { ts: last.ts.toISOString(), mgdl: last.mgdl, trend: last.trend } : null,
    delta: liveDelta(recent),
    ageSec: last ? Math.max(0, Math.round((now - last.ts.getTime()) / 1000)) : null,
    sensor: sensor
      ? {
          ...toSensorInfo(sensor),
          remainingSec: Math.max(0, Math.round((sensor.expectedEnd.getTime() - now) / 1000)),
        }
      : null,
    today: {
      tir: slots.length ? timeInRanges(slots, patient.targetLow, patient.targetHigh) : null,
      mean: values.length
        ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
        : null,
      hypoCount: detectEvents(slots, patient.timezone).filter((e) => e.kind === 'hypo_l1').length,
      min: values.length ? Math.round(Math.min(...values)) : null,
      max: values.length ? Math.round(Math.max(...values)) : null,
    },
    lastFetchAt: run?.startedAt.toISOString() ?? null,
  };
}
