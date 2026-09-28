import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { pushSubscribeBody, pushUnsubscribeBody } from '@glukoz/shared';
import { requireUser } from '../auth/guards.js';
import { AppError, badRequest } from '../lib/errors.js';
import { isAllowedPushEndpoint } from '../alerts/push-endpoint.js';

export async function pushRoutes(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>();
  const { prisma, ctx } = fastify;

  app.get('/push/vapid-public-key', async () => ({ key: ctx.push.publicKey }));

  app.post('/push/subscribe', { schema: { body: pushSubscribeBody } }, async (req, reply) => {
    const user = requireUser(req);
    const { endpoint, keys } = req.body;
    if (!isAllowedPushEndpoint(endpoint)) {
      throw badRequest('Desteklenmeyen bildirim servisi adresi.', 'PUSH_ENDPOINT_NOT_ALLOWED');
    }
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: { userId: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
      update: { userId: user.id, p256dh: keys.p256dh, auth: keys.auth },
    });
    return reply.status(204).send();
  });

  app.delete('/push/subscribe', { schema: { body: pushUnsubscribeBody } }, async (req, reply) => {
    const user = requireUser(req);
    await prisma.pushSubscription.deleteMany({
      where: { endpoint: req.body.endpoint, userId: user.id },
    });
    return reply.status(204).send();
  });

  app.post(
    '/push/test',
    { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (req) => {
      const user = requireUser(req);
      if (!ctx.push.enabled)
        throw new AppError(
          503,
          'PUSH_DISABLED',
          'Sunucuda bildirim anahtarları (VAPID) tanımlı değil.',
        );
      const sent = await ctx.push.sendToUsers([user.id], {
        title: 'Glukoz Paneli',
        body: 'Test bildirimi — bildirimler çalışıyor.',
        tag: 'test',
        data: { url: '/uyarilar' },
      });
      return { sent };
    },
  );
}
