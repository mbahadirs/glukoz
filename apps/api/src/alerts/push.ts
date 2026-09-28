import type { FastifyBaseLogger } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import webpush from 'web-push';
import type { Env } from '../config/env.js';
import { isAllowedPushEndpoint } from './push-endpoint.js';

export interface PushPayload {
  title: string;
  body: string;
  tag: string;
  renotify?: boolean;
  data?: { url: string };
}

/** Web Push (VAPID). Anahtarlar yoksa devre dışı kalır. 404/410 dönen abonelikler silinir. */
export class PushService {
  readonly enabled: boolean;

  constructor(
    private readonly env: Env,
    private readonly prisma: PrismaClient,
    private readonly log: FastifyBaseLogger,
  ) {
    this.enabled = Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
    if (this.enabled)
      webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  }

  get publicKey(): string | null {
    return this.enabled ? this.env.VAPID_PUBLIC_KEY : null;
  }

  async sendToUsers(userIds: readonly string[], payload: PushPayload): Promise<number> {
    if (!this.enabled || userIds.length === 0) return 0;
    const subs = await this.prisma.pushSubscription.findMany({
      where: { userId: { in: [...userIds] } },
    });
    const results = await Promise.all(subs.map((s) => this.sendOne(s, payload)));
    return results.filter(Boolean).length;
  }

  private async sendOne(
    sub: { id: string; endpoint: string; p256dh: string; auth: string },
    payload: PushPayload,
  ): Promise<boolean> {
    // Savunma derinliği: izin listesi dışındaki aboneliklere istek atılmaz.
    if (!isAllowedPushEndpoint(sub.endpoint)) {
      await this.prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined);
      return false;
    }
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
        { TTL: 3600, urgency: payload.renotify ? 'high' : 'normal' },
      );
      return true;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await this.prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined);
      } else {
        this.log.warn({ status }, 'web push gönderilemedi');
      }
      return false;
    }
  }

  /** Hastaya erişimi olan kullanıcılar (ADMIN'ler tüm hastalara erişir). */
  async usersForPatient(patientId: string): Promise<string[]> {
    const [admins, access] = await Promise.all([
      this.prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } }),
      this.prisma.patientAccess.findMany({ where: { patientId }, select: { userId: true } }),
    ]);
    return [...new Set([...admins.map((a) => a.id), ...access.map((a) => a.userId)])];
  }

  async notifyAdmins(title: string, body: string): Promise<void> {
    const admins = await this.prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true },
    });
    await this.sendToUsers(
      admins.map((a) => a.id),
      { title, body, tag: 'system', data: { url: '/ayarlar' } },
    );
  }
}
