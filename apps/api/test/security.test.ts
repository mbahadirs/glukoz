import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { isAllowedPushEndpoint } from '../src/alerts/push-endpoint.js';
import { sanitizeErrorText } from '../src/lib/sanitize.js';
import {
  authed,
  createPatientFixture,
  createUser,
  login,
  makeApp,
  resetDb,
  testPrisma,
} from './helpers.js';

const prisma = testPrisma();
let app: FastifyInstance;
beforeAll(async () => {
  app = await makeApp();
});
afterAll(async () => {
  await app.close();
});
beforeEach(async () => {
  await resetDb();
});

describe('push uç noktası izin listesi (SSRF)', () => {
  it.each([
    ['https://fcm.googleapis.com/fcm/send/abc', true],
    ['https://updates.push.services.mozilla.com/wpush/v2/x', true],
    ['https://web.push.apple.com/QGx', true],
    ['https://wns2-par02p.notify.windows.com/w/?token=x', true],
    ['http://fcm.googleapis.com/fcm/send/abc', false],
    ['https://169.254.169.254/latest/meta-data/', false],
    ['https://fcm.googleapis.com.evil.com/x', false],
    ['https://user:pw@fcm.googleapis.com/x', false],
    ['https://fcm.googleapis.com:8443/x', false],
    ['not a url', false],
  ])('%s → %s', (url, ok) => expect(isAllowedPushEndpoint(url)).toBe(ok));

  it('API izin listesi dışındaki aboneliği reddeder', async () => {
    await createUser('VIEWER', 'v@example.com');
    const v = await login(app, 'v@example.com');
    const res = await app.inject({
      method: 'POST',
      url: '/api/push/subscribe',
      headers: authed(v),
      payload: {
        endpoint: 'https://169.254.169.254/latest/meta-data/',
        keys: { p256dh: 'x', auth: 'y' },
      },
    });
    expect(res.json().error.code).toBe('PUSH_ENDPOINT_NOT_ALLOWED');
    expect(await prisma.pushSubscription.count()).toBe(0);
  });
});

describe('uyarı onayı yetkisi', () => {
  it('salt-okunur erişimli CAREGIVER uyarı onaylayamaz', async () => {
    const { p1 } = await createPatientFixture();
    const ro = await createUser('CAREGIVER', 'ro@example.com');
    const rw = await createUser('CAREGIVER', 'rw@example.com');
    await prisma.patientAccess.createMany({
      data: [
        { userId: ro, patientId: p1.id, canEdit: false },
        { userId: rw, patientId: p1.id, canEdit: true },
      ],
    });
    const event = await prisma.alertEvent.create({
      data: { ruleId: 'r', patientId: p1.id, message: 'x' },
    });
    const a = await login(app, 'ro@example.com');
    const b = await login(app, 'rw@example.com');
    expect(
      (await app.inject({ method: 'POST', url: `/api/alerts/${event.id}/ack`, headers: authed(a) }))
        .statusCode,
    ).toBe(403);
    expect(
      (await app.inject({ method: 'POST', url: `/api/alerts/${event.id}/ack`, headers: authed(b) }))
        .statusCode,
    ).toBe(200);
  });
});

describe('hata metni temizleme', () => {
  it('e-posta, bearer ve uzun anahtarlar maskelenir', () => {
    const out = sanitizeErrorText(
      'LLU_HTTP: a.b@example.com Bearer eyJhbGciOi.xyz 0123456789abcdef0123456789abcdef0123',
    );
    expect(out).not.toContain('example.com');
    expect(out).not.toContain('eyJhbGciOi');
    expect(out).not.toContain('0123456789abcdef0123456789abcdef');
    expect(out.startsWith('LLU_HTTP')).toBe(true);
    expect(sanitizeErrorText('hata '.repeat(200))).toHaveLength(500);
  });
});
