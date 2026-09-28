import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { alertRulesPut, type AlertKind, type AlertRuleDto } from '@glukoz/shared';
import type { AlertRule } from '@prisma/client';
import { requireConsent, requirePatient, requireUser } from '../auth/guards.js';
import { ensureDefaultRules, toAlertEventDto } from '../alerts/engine.js';
import { forbidden, notFound } from '../lib/errors.js';
import { listAccessiblePatients } from '../services/patients.js';

const params = z.object({ id: z.string() });

function toRuleDto(r: AlertRule): AlertRuleDto {
  return {
    id: r.id,
    kind: r.kind as AlertKind,
    enabled: r.enabled,
    thresholdMgdl: r.thresholdMgdl,
    sustainMin: r.sustainMin,
    cooldownMin: r.cooldownMin,
    quietStart: r.quietStart,
    quietEnd: r.quietEnd,
  };
}

export async function alertRoutes(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>();
  const { prisma } = fastify;

  const kindsByRule = async (ruleIds: string[]) => {
    const rules = await prisma.alertRule.findMany({
      where: { id: { in: ruleIds } },
      select: { id: true, kind: true },
    });
    return new Map(rules.map((r) => [r.id, r.kind]));
  };

  app.get('/patients/:id/alert-rules', { schema: { params } }, async (req) => {
    const { patient } = await requirePatient(prisma, req, req.params.id);
    await ensureDefaultRules(prisma, patient.id);
    const rules = await prisma.alertRule.findMany({
      where: { patientId: patient.id },
      orderBy: { kind: 'asc' },
    });
    return rules.map(toRuleDto);
  });

  app.put('/patients/:id/alert-rules', { schema: { params, body: alertRulesPut } }, async (req) => {
    const { patient } = await requirePatient(prisma, req, req.params.id, { edit: true });
    await ensureDefaultRules(prisma, patient.id);
    await prisma.$transaction(
      req.body.rules.map(({ kind, ...data }) =>
        prisma.alertRule.update({
          where: { patientId_kind: { patientId: patient.id, kind } },
          data,
        }),
      ),
    );
    const rules = await prisma.alertRule.findMany({
      where: { patientId: patient.id },
      orderBy: { kind: 'asc' },
    });
    return rules.map(toRuleDto);
  });

  app.get(
    '/patients/:id/alerts',
    {
      schema: {
        params,
        querystring: z.object({ limit: z.coerce.number().int().min(1).max(500).default(100) }),
      },
    },
    async (req) => {
      const { patient } = await requirePatient(prisma, req, req.params.id);
      const events = await prisma.alertEvent.findMany({
        where: { patientId: patient.id },
        orderBy: { firedAt: 'desc' },
        take: req.query.limit,
      });
      const kinds = await kindsByRule(events.map((e) => e.ruleId));
      return events.map((e) => toAlertEventDto(e, kinds.get(e.ruleId) ?? null));
    },
  );

  app.get('/alerts/active', async (req) => {
    const user = requireUser(req);
    await requireConsent(prisma, user);
    const patientIds = (await listAccessiblePatients(prisma, user)).map((p) => p.id);
    const events = await prisma.alertEvent.findMany({
      where: {
        patientId: { in: patientIds },
        ackAt: null,
        firedAt: { gte: new Date(Date.now() - 86_400_000) },
      },
      orderBy: { firedAt: 'desc' },
      take: 50,
    });
    const kinds = await kindsByRule(events.map((e) => e.ruleId));
    return events.map((e) => toAlertEventDto(e, kinds.get(e.ruleId) ?? null));
  });

  app.post(
    '/alerts/:id/ack',
    { schema: { params: z.object({ id: z.string().uuid() }) } },
    async (req) => {
      const user = requireUser(req);
      const event = await prisma.alertEvent.findUnique({ where: { id: req.params.id } });
      if (!event) throw notFound();
      const { canEdit } = await requirePatient(prisma, req, event.patientId);
      if (!canEdit) throw forbidden('Bu hasta için uyarı onaylama yetkiniz yok.');
      const updated = await prisma.alertEvent.update({
        where: { id: event.id },
        data: { ackBy: user.id, ackAt: new Date() },
      });
      const kinds = await kindsByRule([event.ruleId]);
      return toAlertEventDto(updated, kinds.get(event.ruleId) ?? null);
    },
  );
}
