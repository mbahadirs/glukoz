import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { User } from '@prisma/client';
import { AppError } from '../lib/errors.js';
import {
  CSRF_COOKIE,
  csrfTokenFor,
  resolveSession,
  safeEqual,
  SESSION_COOKIE,
  SESSION_TTL_MS,
} from './session.js';

declare module 'fastify' {
  interface FastifyRequest {
    auth: { user: User; sessionHash: string; csrfToken: string } | null;
  }
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const CSRF_EXEMPT = new Set(['/api/auth/login', '/api/setup']);

export function cookieOptions(secure: boolean, httpOnly = true) {
  return { path: '/', httpOnly, secure, sameSite: 'lax' as const, maxAge: SESSION_TTL_MS / 1000 };
}

export function setSessionCookies(
  reply: FastifyReply,
  raw: string,
  csrfToken: string,
  secure: boolean,
): void {
  reply.setCookie(SESSION_COOKIE, raw, cookieOptions(secure));
  reply.setCookie(CSRF_COOKIE, csrfToken, cookieOptions(secure, false));
}

export function clearSessionCookies(reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE, { path: '/' });
  reply.clearCookie(CSRF_COOKIE, { path: '/' });
}

/** Oturum çözümleme + CSRF (double-submit, oturuma bağlı HMAC). */
export const authPlugin = fp(async (app: FastifyInstance, opts: { secret: string }) => {
  app.decorateRequest('auth', null);

  app.addHook('onRequest', async (req: FastifyRequest) => {
    if (!req.url.startsWith('/api/')) return;
    const raw = req.cookies[SESSION_COOKIE];
    if (raw) {
      const resolved = await resolveSession(app.prisma, raw);
      if (resolved) {
        req.auth = {
          user: resolved.user,
          sessionHash: resolved.hash,
          csrfToken: csrfTokenFor(resolved.hash, opts.secret),
        };
      }
    }
    if (SAFE_METHODS.has(req.method)) return;
    const path = req.url.split('?')[0] ?? '';
    if (CSRF_EXEMPT.has(path) || !req.auth) return;
    const header = req.headers['x-csrf-token'];
    const cookie = req.cookies[CSRF_COOKIE];
    const token = typeof header === 'string' ? header : '';
    if (!token || !cookie || !safeEqual(token, cookie) || !safeEqual(token, req.auth.csrfToken)) {
      throw new AppError(
        403,
        'CSRF',
        'Güvenlik doğrulaması başarısız. Sayfayı yenileyip tekrar deneyin.',
      );
    }
  });
});
