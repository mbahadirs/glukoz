import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  consentBody,
  CONSENT_VERSION,
  loginBody,
  preferencesBody,
  setupBody,
} from '@glukoz/shared';
import { requireUser } from '../auth/guards.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { clearSessionCookies, setSessionCookies } from '../auth/plugin.js';
import { createSession, csrfTokenFor } from '../auth/session.js';
import { audit } from '../lib/audit.js';
import { AppError, badRequest, conflict } from '../lib/errors.js';
import { buildMe } from '../services/patients.js';

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>();
  const { prisma } = fastify;
  const secure = fastify.ctx.env.NODE_ENV === 'production';
  const secret = fastify.ctx.env.SESSION_SECRET;

  const startSession = async (
    userId: string,
    req: { headers: Record<string, unknown>; ip: string },
  ) => {
    const s = await createSession(prisma, userId, {
      userAgent: String(req.headers['user-agent'] ?? ''),
      ip: req.ip,
    });
    return { ...s, csrf: csrfTokenFor(s.hash, secret) };
  };

  app.get('/setup/status', async () => ({ needsSetup: (await prisma.user.count()) === 0 }));

  app.post(
    '/setup',
    { schema: { body: setupBody }, config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const passwordHash = await hashPassword(req.body.password);
      // İlk ADMIN yalnızca hiç kullanıcı yokken oluşturulabilir (yarış durumuna karşı serializable).
      const user = await prisma
        .$transaction(
          async (tx) => {
            if ((await tx.user.count()) > 0) throw conflict('Kurulum zaten tamamlandı.');
            return tx.user.create({
              data: {
                email: req.body.email,
                passwordHash,
                displayName: req.body.displayName,
                role: 'ADMIN',
              },
            });
          },
          { isolationLevel: 'Serializable' },
        )
        .catch((err: unknown) => {
          // Eşzamanlı kurulum istekleri: serializable çakışması (P2034) → 409
          if ((err as { code?: string }).code === 'P2034')
            throw conflict('Kurulum zaten tamamlandı.');
          throw err;
        });
      await audit(prisma, { userId: user.id, action: 'setup', ip: req.ip });
      const s = await startSession(user.id, req);
      setSessionCookies(reply, s.raw, s.csrf, secure);
      return buildMe(prisma, user, s.csrf);
    },
  );

  app.post(
    '/auth/login',
    { schema: { body: loginBody }, config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const user = await prisma.user.findUnique({ where: { email: req.body.email } });
      const ok = await verifyPassword(user?.passwordHash ?? null, req.body.password);
      if (!user || !ok) {
        await audit(prisma, { userId: user?.id ?? null, action: 'login_failed', ip: req.ip });
        throw new AppError(
          401,
          'INVALID_CREDENTIALS',
          'E-posta veya şifre hatalı. Bilgileri kontrol edip tekrar deneyin.',
        );
      }
      await audit(prisma, { userId: user.id, action: 'login', ip: req.ip });
      const s = await startSession(user.id, req);
      setSessionCookies(reply, s.raw, s.csrf, secure);
      return buildMe(prisma, user, s.csrf);
    },
  );

  app.post('/auth/logout', async (req, reply) => {
    if (req.auth) {
      await prisma.session.delete({ where: { id: req.auth.sessionHash } }).catch(() => undefined);
      await audit(prisma, { userId: req.auth.user.id, action: 'logout', ip: req.ip });
    }
    clearSessionCookies(reply);
    return reply.status(204).send();
  });

  app.get('/auth/me', async (req) => {
    const user = requireUser(req);
    return buildMe(prisma, user, req.auth?.csrfToken ?? '');
  });

  app.patch('/me/preferences', { schema: { body: preferencesBody } }, async (req) => {
    const user = requireUser(req);
    const updated = await prisma.user.update({ where: { id: user.id }, data: req.body });
    return buildMe(prisma, updated, req.auth?.csrfToken ?? '');
  });

  app.post('/me/consent', { schema: { body: consentBody } }, async (req) => {
    const user = requireUser(req);
    if (req.body.version !== CONSENT_VERSION)
      throw badRequest('Onay metni sürümü güncel değil. Sayfayı yenileyin.');
    await prisma.consent.create({ data: { userId: user.id, version: req.body.version } });
    await audit(prisma, {
      userId: user.id,
      action: 'consent',
      meta: { version: req.body.version },
      ip: req.ip,
    });
    return buildMe(prisma, user, req.auth?.csrfToken ?? '');
  });
}
