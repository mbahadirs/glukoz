import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { PrismaClient, User } from '@prisma/client';

export const SESSION_COOKIE = 'glk_sid';
export const CSRF_COOKIE = 'glk_csrf';
export const SESSION_TTL_MS = 14 * 86_400_000;
/** Kayar süre güncellemesi en fazla saatte bir yazılır. */
const SLIDE_THRESHOLD_MS = 3600_000;

export function hashSessionId(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export function csrfTokenFor(sessionHash: string, secret: string): string {
  return createHmac('sha256', secret).update(`csrf:${sessionHash}`).digest('base64url');
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export async function createSession(
  prisma: PrismaClient,
  userId: string,
  meta: { userAgent?: string; ip?: string },
): Promise<{ raw: string; hash: string; expiresAt: Date }> {
  const raw = randomBytes(32).toString('base64url'); // 256 bit
  const hash = hashSessionId(raw);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.session.create({
    data: { id: hash, userId, expiresAt, userAgent: meta.userAgent?.slice(0, 300), ip: meta.ip },
  });
  return { raw, hash, expiresAt };
}

export async function resolveSession(
  prisma: PrismaClient,
  raw: string,
): Promise<{ user: User; hash: string } | null> {
  const hash = hashSessionId(raw);
  const session = await prisma.session.findUnique({ where: { id: hash }, include: { user: true } });
  if (!session) return null;
  const now = Date.now();
  if (session.expiresAt.getTime() <= now) {
    await prisma.session.delete({ where: { id: hash } }).catch(() => undefined);
    return null;
  }
  if (now + SESSION_TTL_MS - session.expiresAt.getTime() > SLIDE_THRESHOLD_MS) {
    await prisma.session.update({
      where: { id: hash },
      data: { expiresAt: new Date(now + SESSION_TTL_MS) },
    });
  }
  return { user: session.user, hash };
}

export async function destroyAllSessions(prisma: PrismaClient, userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}
