import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { LluAccount } from '@prisma/client';
import { lluAccountCreate, type LluAccountDto, type LluAccountTestResponse } from '@glukoz/shared';
import { requireRole } from '../auth/guards.js';
import { audit } from '../lib/audit.js';
import { AppError, badRequest, notFound } from '../lib/errors.js';
import { LluError } from '../llu/index.js';

const idParam = z.object({ id: z.string().uuid() });

/** `ali@gmail.com` → `a***@g***.com` */
export function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@');
  const dot = domain.lastIndexOf('.');
  const host = dot > 0 ? domain.slice(0, dot) : domain;
  const tld = dot > 0 ? domain.slice(dot) : '';
  return `${local.slice(0, 1)}***@${host.slice(0, 1)}***${tld}`;
}

function lluHttpError(err: LluError): AppError {
  const status =
    err.code === 'LLU_BAD_CREDENTIALS' || err.code === 'LLU_ACTION_REQUIRED' ? 400 : 502;
  return new AppError(status, err.code, err.message);
}

export async function lluAccountRoutes(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>();
  const { prisma, ctx } = fastify;

  const toDto = async (a: LluAccount): Promise<LluAccountDto> => ({
    id: a.id,
    label: a.label,
    emailMasked: maskEmail(ctx.cipher.decrypt(a.emailEnc)),
    region: a.region,
    status: a.status,
    lastError: a.lastError,
    failCount: a.failCount,
    patientCount: await prisma.patient.count({ where: { accountId: a.id } }),
    createdAt: a.createdAt.toISOString(),
  });

  /** Kaydetmeden önce kimlik bilgilerini dener; bağlantı sayısını döndürür. */
  const probe = async (email: string, password: string, region: string | null) => {
    const { product, version } = await ctx.settings.lluProductVersion();
    const client = ctx.clientFactory({ email, password, region, product, version });
    const session = await client.login();
    const conns = await client.connections();
    return { session, names: conns.data.map((c) => `${c.firstName} ${c.lastName}`.trim()) };
  };

  app.get('/llu-accounts', async (req) => {
    requireRole(req, 'ADMIN');
    const accounts = await prisma.lluAccount.findMany({ orderBy: { createdAt: 'asc' } });
    return Promise.all(accounts.map(toDto));
  });

  app.post('/llu-accounts', { schema: { body: lluAccountCreate } }, async (req, reply) => {
    const admin = requireRole(req, 'ADMIN');
    let result;
    try {
      result = await probe(req.body.email, req.body.password, null);
    } catch (err) {
      if (err instanceof LluError) throw lluHttpError(err);
      throw err;
    }
    if (result.names.length === 0) {
      throw badRequest(
        'Giriş başarılı ancak takip edilen hasta yok. Hastanın kendi hesabı değil, davet kabul edilmiş ayrı bir LibreLinkUp takipçi hesabı kullanın.',
        'LLU_NO_CONNECTIONS',
      );
    }
    const account = await prisma.lluAccount.create({
      data: {
        label: req.body.label,
        emailEnc: ctx.cipher.encrypt(req.body.email),
        passwordEnc: ctx.cipher.encrypt(req.body.password),
        region: result.session.region,
        lluUserId: result.session.userId,
        tokenEnc: ctx.cipher.encrypt(result.session.token),
        tokenExpiresAt: new Date(result.session.expires * 1000),
      },
    });
    await audit(prisma, {
      userId: admin.id,
      action: 'llu_account_create',
      targetId: account.id,
      ip: req.ip,
    });
    // İlk toplama + 12 saatlik backfill hemen yapılır.
    await ctx.collector.runAccount(account);
    return reply.status(201).send({ account: await toDto(account), patients: result.names });
  });

  app.post(
    '/llu-accounts/:id/test',
    { schema: { params: idParam } },
    async (req): Promise<LluAccountTestResponse> => {
      requireRole(req, 'ADMIN');
      const account = await prisma.lluAccount.findUnique({ where: { id: req.params.id } });
      if (!account) throw notFound();
      try {
        const r = await probe(
          ctx.cipher.decrypt(account.emailEnc),
          ctx.cipher.decrypt(account.passwordEnc),
          account.region,
        );
        return { ok: true, patients: r.names.length, errorCode: null, message: null };
      } catch (err) {
        if (err instanceof LluError)
          return { ok: false, patients: 0, errorCode: err.code, message: err.message };
        throw err;
      }
    },
  );

  app.post('/llu-accounts/:id/resume', { schema: { params: idParam } }, async (req) => {
    const admin = requireRole(req, 'ADMIN');
    const existing = await prisma.lluAccount.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound();
    const account = await prisma.lluAccount.update({
      where: { id: existing.id },
      data: { status: 'active', failCount: 0, lastError: null },
    });
    ctx.collector.forget(account.id);
    await audit(prisma, {
      userId: admin.id,
      action: 'llu_account_resume',
      targetId: account.id,
      ip: req.ip,
    });
    return toDto(account);
  });

  app.delete(
    '/llu-accounts/:id',
    { schema: { params: idParam, body: z.object({ confirmLabel: z.string() }) } },
    async (req, reply) => {
      const admin = requireRole(req, 'ADMIN');
      const account = await prisma.lluAccount.findUnique({
        where: { id: req.params.id },
        include: { patients: true },
      });
      if (!account) throw notFound();
      if (req.body.confirmLabel !== account.label)
        throw badRequest('Onay için hesap etiketini aynen yazın.', 'CONFIRMATION_MISMATCH');
      const patientIds = account.patients.map((p) => p.id);
      await prisma.$transaction([
        prisma.alertEvent.deleteMany({ where: { patientId: { in: patientIds } } }),
        prisma.collectorRun.deleteMany({ where: { accountId: account.id } }),
        prisma.lluAccount.delete({ where: { id: account.id } }), // hasta verisi cascade ile silinir
      ]);
      ctx.collector.forget(account.id);
      for (const id of patientIds) ctx.reports.invalidatePatient(id);
      await audit(prisma, {
        userId: admin.id,
        action: 'llu_account_delete',
        targetId: account.id,
        meta: { patients: patientIds.length },
        ip: req.ip,
      });
      return reply.status(204).send();
    },
  );
}
