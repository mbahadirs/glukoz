import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  addDays,
  basicStats,
  dailySummaries,
  detectEvents,
  resample5m,
  slotsInRange,
  zonedDayStart,
} from '@glukoz/metrics';
import {
  dayQuery,
  eventsQuery,
  patientUpdate,
  rangeQuery,
  readingsQuery,
  type DayResponse,
  type LogbookEntryDto,
  type ReadingsResponse,
  type SensorHistoryDto,
} from '@glukoz/shared';
import { requirePatient, requireUser, requireConsent } from '../auth/guards.js';
import { audit } from '../lib/audit.js';
import { badRequest } from '../lib/errors.js';
import { buildCurrent, toSensorInfo } from '../services/current.js';
import { listAccessiblePatients, toPatientSummary } from '../services/patients.js';
import { loadPoints } from '../services/readings.js';
import { toNoteDto } from './notes.js';

export const patientParam = z.object({ id: z.string() });

const DAY = 86_400_000;
const MAX_RAW_DAYS = 31;
const MAX_RANGE_DAYS = 366;

function assertSpan(from: Date, to: Date, maxDays: number): void {
  if (to.getTime() - from.getTime() > maxDays * DAY)
    throw badRequest(`Aralık en fazla ${maxDays} gün olabilir.`);
}

function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export async function patientRoutes(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>();
  const { prisma, ctx } = fastify;

  app.get('/patients', async (req) => {
    const user = requireUser(req);
    await requireConsent(prisma, user);
    return listAccessiblePatients(prisma, user);
  });

  app.patch(
    '/patients/:id',
    { schema: { params: patientParam, body: patientUpdate } },
    async (req) => {
      const { user, patient, canEdit } = await requirePatient(prisma, req, req.params.id, {
        edit: true,
      });
      if (req.body.timezone && !isValidTimezone(req.body.timezone))
        throw badRequest('Geçersiz saat dilimi.');
      const low = req.body.targetLow ?? patient.targetLow;
      const high = req.body.targetHigh ?? patient.targetHigh;
      if (low >= high) throw badRequest('Alt hedef üst hedeften küçük olmalı.');
      const updated = await prisma.patient.update({ where: { id: patient.id }, data: req.body });
      if (req.body.sensorLifeDays && req.body.sensorLifeDays !== patient.sensorLifeDays) {
        const sensors = await prisma.sensor.findMany({
          where: { patientId: patient.id, endedAt: null },
        });
        for (const s of sensors) {
          await prisma.sensor.update({
            where: { id: s.id },
            data: {
              expectedEnd: new Date(s.activatedAt.getTime() + req.body.sensorLifeDays * DAY),
            },
          });
        }
      }
      ctx.reports.invalidatePatient(patient.id);
      await audit(prisma, {
        userId: user.id,
        action: 'patient_update',
        targetId: patient.id,
        meta: { fields: Object.keys(req.body) },
        ip: req.ip,
      });
      return toPatientSummary(prisma, updated, canEdit);
    },
  );

  app.get('/patients/:id/current', { schema: { params: patientParam } }, async (req) => {
    const { patient } = await requirePatient(prisma, req, req.params.id);
    return buildCurrent(prisma, patient);
  });

  app.get(
    '/patients/:id/readings',
    { schema: { params: patientParam, querystring: readingsQuery } },
    async (req): Promise<ReadingsResponse> => {
      const { patient } = await requirePatient(prisma, req, req.params.id);
      const { from, to, resolution } = req.query;
      assertSpan(from, to, resolution === 'raw' ? MAX_RAW_DAYS : MAX_RANGE_DAYS);
      const points = await loadPoints(prisma, patient.id, from, to);
      if (resolution === 'raw') return { resolution, points: points.map((p) => [p.ts, p.mgdl]) };
      return { resolution, points: resample5m(points).map((s) => [s.ts, Math.round(s.mgdl)]) };
    },
  );

  app.get(
    '/patients/:id/day',
    { schema: { params: patientParam, querystring: dayQuery } },
    async (req): Promise<DayResponse> => {
      const { patient } = await requirePatient(prisma, req, req.params.id);
      const tz = patient.timezone;
      const from = zonedDayStart(req.query.date, tz);
      const to = zonedDayStart(addDays(req.query.date, 1), tz);
      const [points, notes] = await Promise.all([
        loadPoints(prisma, patient.id, new Date(from), new Date(to)),
        prisma.note.findMany({
          where: { patientId: patient.id, ts: { gte: new Date(from), lt: new Date(to) } },
          orderBy: { ts: 'asc' },
        }),
      ]);
      const slots = slotsInRange(resample5m(points), from, to);
      const events = detectEvents(slots, tz);
      const [summary] = dailySummaries(slots, events, tz, from, to);
      const stats = basicStats(slots, from, to);
      return {
        date: req.query.date,
        timezone: tz,
        from: new Date(from).toISOString(),
        to: new Date(to).toISOString(),
        // Grafik için ham ölçümler (LLU ne sıklıkta veriyorsa); özetler 5 dk dilimlerden.
        readings: points.filter((p) => p.ts >= from && p.ts < to).map((p) => [p.ts, p.mgdl]),
        notes: notes.map(toNoteDto),
        events,
        summary: { ...(summary as NonNullable<typeof summary>), gmiPercent: stats.gmiPercent },
      };
    },
  );

  app.get(
    '/patients/:id/report',
    { schema: { params: patientParam, querystring: rangeQuery } },
    async (req) => {
      const { user, patient } = await requirePatient(prisma, req, req.params.id);
      assertSpan(req.query.from, req.query.to, MAX_RANGE_DAYS);
      const report = await ctx.reports.report(patient, req.query.from, req.query.to);
      await audit(prisma, {
        userId: user.id,
        action: 'view_report',
        targetId: patient.id,
        meta: { from: req.query.from.toISOString(), to: req.query.to.toISOString() },
        ip: req.ip,
      });
      return report;
    },
  );

  app.get(
    '/patients/:id/report/compare',
    { schema: { params: patientParam, querystring: rangeQuery } },
    async (req) => {
      const { patient } = await requirePatient(prisma, req, req.params.id);
      assertSpan(req.query.from, req.query.to, MAX_RANGE_DAYS);
      return ctx.reports.compare(patient, req.query.from, req.query.to);
    },
  );

  app.get(
    '/patients/:id/events',
    { schema: { params: patientParam, querystring: eventsQuery } },
    async (req) => {
      const { patient } = await requirePatient(prisma, req, req.params.id);
      assertSpan(req.query.from, req.query.to, MAX_RANGE_DAYS);
      const report = await ctx.reports.report(patient, req.query.from, req.query.to);
      return req.query.type
        ? report.events.filter((e) => e.kind === req.query.type)
        : report.events;
    },
  );

  app.get(
    '/patients/:id/sensors',
    { schema: { params: patientParam } },
    async (req): Promise<SensorHistoryDto[]> => {
      const { patient } = await requirePatient(prisma, req, req.params.id);
      const sensors = await prisma.sensor.findMany({
        where: { patientId: patient.id },
        orderBy: { activatedAt: 'desc' },
      });
      const now = Date.now();
      return Promise.all(
        sensors.map(async (s) => {
          const end = Math.min(s.endedAt?.getTime() ?? now, s.expectedEnd.getTime(), now);
          const start = s.activatedAt.getTime();
          const points = await loadPoints(prisma, patient.id, new Date(start), new Date(end));
          const stats = basicStats(resample5m(points), start, end);
          const endedEarly =
            s.endedAt !== null && s.expectedEnd.getTime() - s.endedAt.getTime() > 12 * 3600_000;
          return {
            ...toSensorInfo(s),
            usedDays: Math.round(((end - start) / DAY) * 10) / 10,
            sufficiencyPercent: stats.sufficiencyPercent,
            endedEarly,
            active: s.endedAt === null && s.expectedEnd.getTime() > now,
          };
        }),
      );
    },
  );

  app.get(
    '/patients/:id/logbook',
    { schema: { params: patientParam, querystring: rangeQuery } },
    async (req): Promise<LogbookEntryDto[]> => {
      const { patient } = await requirePatient(prisma, req, req.params.id);
      assertSpan(req.query.from, req.query.to, MAX_RANGE_DAYS);
      const rows = await prisma.logbookEntry.findMany({
        where: { patientId: patient.id, ts: { gte: req.query.from, lt: req.query.to } },
        orderBy: { ts: 'desc' },
      });
      return rows.map((r) => ({
        ts: r.ts.toISOString(),
        mgdl: r.mgdl,
        kind: r.kind === 'alarm' ? 'alarm' : 'scan',
        alarmType: r.alarmType,
      }));
    },
  );
}
