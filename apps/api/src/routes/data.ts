import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import {
  deleteDataBody,
  rangeQuery,
  TREND_SYMBOLS,
  type DeleteDataStep1Response,
  type ImportResponse,
} from '@glukoz/shared';
import { requirePatient } from '../auth/guards.js';
import { upsertReadings } from '../collector/store.js';
import { csvCell } from '../import/csv.js';
import { parseLibreViewCsv } from '../import/libreview-csv.js';
import { audit } from '../lib/audit.js';
import { badRequest, forbidden } from '../lib/errors.js';
import { patientName } from '../services/patients.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const params = z.object({ id: z.string() });
const CONFIRM_TTL_MS = 5 * 60_000;
const IMPORT_CHUNK = 5000;

export async function dataRoutes(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>();
  const { prisma, ctx } = fastify;
  /** İki aşamalı silme onay jetonları (bellek içi, 5 dk). */
  const pendingDeletes = new Map<string, { patientId: string; userId: string; expires: number }>();

  app.get(
    '/patients/:id/export.csv',
    { schema: { params, querystring: rangeQuery } },
    async (req, reply) => {
      const { user, patient } = await requirePatient(prisma, req, req.params.id);
      const { from, to } = req.query;
      const [readings, notes] = await Promise.all([
        prisma.reading.findMany({
          where: { patientId: patient.id, ts: { gte: from, lt: to } },
          orderBy: { ts: 'asc' },
        }),
        prisma.note.findMany({
          where: { patientId: patient.id, ts: { gte: from, lt: to } },
          orderBy: { ts: 'asc' },
        }),
      ]);
      const local = (d: Date) => dayjs(d).tz(patient.timezone).format('YYYY-MM-DD HH:mm:ss');
      const header = [
        'kayit',
        'zaman_utc',
        'yerel_zaman',
        'glukoz_mgdl',
        'trend',
        'kaynak',
        'not_tipi',
        'karbonhidrat_g',
        'insulin_u',
        'sure_dk',
        'su_ml',
        'aciklama',
      ];
      const lines = [
        header.join(';'),
        ...readings.map((r) =>
          [
            'okuma',
            r.ts.toISOString(),
            local(r.ts),
            r.mgdl,
            r.trend ? TREND_SYMBOLS[r.trend] : '',
            r.source,
            '',
            '',
            '',
            '',
            '',
            '',
          ]
            .map((v) => csvCell(v))
            .join(';'),
        ),
        ...notes.map((n) =>
          [
            'not',
            n.ts.toISOString(),
            local(n.ts),
            '',
            '',
            '',
            n.type,
            n.carbsG,
            n.insulinU === null ? '' : Number(n.insulinU).toLocaleString('tr-TR'),
            n.durationMin,
            n.waterMl,
            n.text,
          ]
            .map((v) => csvCell(v))
            .join(';'),
        ),
      ];
      await audit(prisma, {
        userId: user.id,
        action: 'export_csv',
        targetId: patient.id,
        meta: { from: from.toISOString(), to: to.toISOString() },
        ip: req.ip,
      });
      const filename = `glukoz-${patient.id.slice(0, 8)}-${dayjs(from).format('YYYYMMDD')}-${dayjs(to).format('YYYYMMDD')}.csv`;
      return reply
        .header('content-type', 'text/csv; charset=utf-8')
        .header('content-disposition', `attachment; filename="${filename}"`)
        .header('cache-control', 'no-store')
        .send(`\uFEFF${lines.join('\r\n')}\r\n`);
    },
  );

  app.post(
    '/patients/:id/import/libreview-csv',
    { schema: { params } },
    async (req): Promise<ImportResponse> => {
      const { user, patient } = await requirePatient(prisma, req, req.params.id, { edit: true });
      const file = await req.file();
      if (!file) throw badRequest('Dosya bulunamadı (`file` alanı).');
      const text = (await file.toBuffer()).toString('utf8');
      let parsed;
      try {
        parsed = parseLibreViewCsv(text, patient.timezone);
      } catch (err) {
        throw badRequest((err as Error).message, 'IMPORT_FORMAT');
      }
      let imported = 0;
      for (let i = 0; i < parsed.readings.length; i += IMPORT_CHUNK) {
        imported += (
          await upsertReadings(
            prisma,
            patient.id,
            parsed.readings.slice(i, i + IMPORT_CHUNK),
            'import',
          )
        ).length;
      }
      ctx.reports.invalidatePatient(patient.id);
      await audit(prisma, {
        userId: user.id,
        action: 'import_csv',
        targetId: patient.id,
        meta: { rows: parsed.rows, imported },
        ip: req.ip,
      });
      return { imported, skipped: parsed.rows - imported, rows: parsed.rows };
    },
  );

  app.delete(
    '/patients/:id/data',
    { schema: { params, body: deleteDataBody } },
    async (req, reply) => {
      const { user, patient } = await requirePatient(prisma, req, req.params.id);
      if (user.role !== 'ADMIN')
        throw forbidden('Veri silme yalnızca yönetici tarafından yapılabilir.');
      const now = Date.now();
      for (const [k, v] of pendingDeletes) if (v.expires < now) pendingDeletes.delete(k);
      const name = patientName(patient);

      if (!req.body.confirmToken) {
        const token = randomBytes(16).toString('base64url');
        pendingDeletes.set(token, {
          patientId: patient.id,
          userId: user.id,
          expires: now + CONFIRM_TTL_MS,
        });
        const res: DeleteDataStep1Response = {
          confirmToken: token,
          expiresInSec: CONFIRM_TTL_MS / 1000,
          confirmName: name,
        };
        return res;
      }
      const pending = pendingDeletes.get(req.body.confirmToken);
      if (!pending || pending.patientId !== patient.id || pending.userId !== user.id) {
        throw badRequest(
          'Onay süresi doldu veya geçersiz. Silme işlemini baştan başlatın.',
          'CONFIRMATION_EXPIRED',
        );
      }
      if (req.body.confirmName?.trim() !== name)
        throw badRequest('Onay için hasta adını aynen yazın.', 'CONFIRMATION_MISMATCH');
      pendingDeletes.delete(req.body.confirmToken);
      const counts = await prisma.$transaction([
        prisma.reading.deleteMany({ where: { patientId: patient.id } }),
        prisma.note.deleteMany({ where: { patientId: patient.id } }),
        prisma.logbookEntry.deleteMany({ where: { patientId: patient.id } }),
        prisma.sensor.deleteMany({ where: { patientId: patient.id } }),
        prisma.alertEvent.deleteMany({ where: { patientId: patient.id } }),
      ]);
      ctx.reports.invalidatePatient(patient.id);
      await audit(prisma, {
        userId: user.id,
        action: 'delete_patient_data',
        targetId: patient.id,
        meta: { readings: counts[0].count, notes: counts[1].count },
        ip: req.ip,
      });
      return reply.status(204).send();
    },
  );
}
