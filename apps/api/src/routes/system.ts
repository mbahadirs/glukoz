import type { FastifyInstance } from 'fastify';
import type { SystemStatusResponse } from '@glukoz/shared';
import { requireRole } from '../auth/guards.js';
import { AppError } from '../lib/errors.js';

export async function systemRoutes(app: FastifyInstance): Promise<void> {
  const { prisma, ctx } = app;

  app.get('/health', async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { ok: true };
    } catch {
      throw new AppError(503, 'DB_UNAVAILABLE', 'Veritabanına ulaşılamıyor.');
    }
  });

  app.get('/system/status', async (req): Promise<SystemStatusResponse> => {
    requireRole(req, 'ADMIN');
    const since = new Date(Date.now() - 86_400_000);
    const [pv, minimumVersionSeen, accounts] = await Promise.all([
      ctx.settings.lluProductVersion(),
      ctx.settings.get('llu.minimumVersionSeen'),
      prisma.lluAccount.findMany({ orderBy: { createdAt: 'asc' } }),
    ]);
    const rows = await Promise.all(
      accounts.map(async (a) => {
        const [lastOk, lastRun, total, ok] = await Promise.all([
          prisma.collectorRun.findFirst({
            where: { accountId: a.id, ok: true },
            orderBy: { startedAt: 'desc' },
          }),
          prisma.collectorRun.findFirst({
            where: { accountId: a.id },
            orderBy: { startedAt: 'desc' },
          }),
          prisma.collectorRun.count({ where: { accountId: a.id, startedAt: { gte: since } } }),
          prisma.collectorRun.count({
            where: { accountId: a.id, startedAt: { gte: since }, ok: true },
          }),
        ]);
        return {
          id: a.id,
          label: a.label,
          status: a.status,
          lastError: a.lastError,
          lastSuccessAt: lastOk?.startedAt.toISOString() ?? null,
          successRate24h: total ? Math.round((ok / total) * 1000) / 10 : null,
          runs24h: total,
          lastErrorCode: lastRun?.ok === false ? lastRun.errorCode : null,
        };
      }),
    );
    return { llu: { ...pv, mock: ctx.env.LLU_MOCK, minimumVersionSeen }, accounts: rows };
  });
}
