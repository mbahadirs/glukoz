import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
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

describe('kurulum ve oturum', () => {
  it('/setup yalnızca ilk kez çalışır; sonra 409', async () => {
    expect((await app.inject({ url: '/api/setup/status' })).json()).toEqual({ needsSetup: true });
    const body = { email: 'Admin@Example.com', password: 'long-enough-pw', displayName: 'Admin' };
    const res = await app.inject({ method: 'POST', url: '/api/setup', payload: body });
    expect(res.statusCode).toBe(200);
    expect(res.json().user).toMatchObject({ role: 'ADMIN', email: 'admin@example.com' });
    const sid = res.cookies.find((c) => c.name === 'glk_sid');
    expect(sid).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/' });
    expect(res.cookies.find((c) => c.name === 'glk_csrf')?.httpOnly).toBeFalsy();
    const again = await app.inject({
      method: 'POST',
      url: '/api/setup',
      payload: { ...body, email: 'b@example.com' },
    });
    expect(again.statusCode).toBe(409);
    const session = await prisma.session.findFirstOrThrow();
    expect(session.id).not.toBe(sid?.value); // DB'de ham kimlik değil hash tutulur
  });

  it('kısa şifre reddedilir', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/setup',
      payload: { email: 'a@b.co', password: 'short', displayName: 'A' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION');
  });

  it('yanlış şifre 401; me oturumsuz 401; çıkış oturumu siler', async () => {
    await createUser('ADMIN', 'a@example.com');
    const bad = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      remoteAddress: '10.8.8.8',
      payload: { email: 'a@example.com', password: 'wrong' },
    });
    expect(bad.statusCode).toBe(401);
    expect((await app.inject({ url: '/api/auth/me' })).statusCode).toBe(401);
    const agent = await login(app, 'a@example.com');
    expect(
      (await app.inject({ url: '/api/auth/me', headers: { cookie: agent.cookies } })).statusCode,
    ).toBe(200);
    const out = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: authed(agent),
    });
    expect(out.statusCode).toBe(204);
    expect(
      (await app.inject({ url: '/api/auth/me', headers: { cookie: agent.cookies } })).statusCode,
    ).toBe(401);
    expect(await prisma.auditLog.count({ where: { action: 'login_failed' } })).toBe(1);
  });

  it('giriş IP başına dakikada 5 deneme ile sınırlı', async () => {
    const codes: number[] = [];
    for (let i = 0; i < 6; i++) {
      const r = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        remoteAddress: '10.9.9.9',
        payload: { email: 'x@example.com', password: 'nope' },
      });
      codes.push(r.statusCode);
    }
    expect(codes.slice(0, 5).every((c) => c === 401)).toBe(true);
    expect(codes[5]).toBe(429);
  });
});

describe('CSRF', () => {
  it('GET dışı isteklerde başlık zorunlu ve oturuma bağlı', async () => {
    await createUser('ADMIN', 'a@example.com');
    await createUser('ADMIN', 'b@example.com');
    const a = await login(app, 'a@example.com');
    const b = await login(app, 'b@example.com');
    const url = '/api/me/preferences';
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url,
          headers: { cookie: a.cookies },
          payload: { unit: 'mmol' },
        })
      ).json().error.code,
    ).toBe('CSRF');
    // başka oturumun jetonu (çerez + başlık) kabul edilmez
    const cross = await app.inject({
      method: 'PATCH',
      url,
      headers: {
        cookie: `${a.cookies.replace(/glk_csrf=[^;]+/, `glk_csrf=${b.csrf}`)}`,
        'x-csrf-token': b.csrf,
      },
      payload: { unit: 'mmol' },
    });
    expect(cross.statusCode).toBe(403);
    const ok = await app.inject({
      method: 'PATCH',
      url,
      headers: authed(a),
      payload: { unit: 'mmol' },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().user.unit).toBe('mmol');
  });
});

describe('yetkilendirme (IDOR) ve KVKK', () => {
  it('erişimi olmayan hasta 403; olmayan hasta da 403; VIEWER not ekleyemez', async () => {
    const { p1, p2 } = await createPatientFixture();
    const viewerId = await createUser('VIEWER', 'v@example.com');
    const caregiverId = await createUser('CAREGIVER', 'c@example.com');
    await prisma.patientAccess.createMany({
      data: [
        { userId: viewerId, patientId: p1.id, canEdit: true },
        { userId: caregiverId, patientId: p1.id, canEdit: true },
      ],
    });
    const v = await login(app, 'v@example.com');
    const c = await login(app, 'c@example.com');

    const list = await app.inject({ url: '/api/patients', headers: { cookie: v.cookies } });
    expect(list.json().map((p: { id: string }) => p.id)).toEqual([p1.id]);
    expect(list.json()[0].canEdit).toBe(false); // VIEWER hiçbir zaman düzenleyemez

    for (const url of [
      `/api/patients/${p2.id}/current`,
      `/api/patients/${p2.id}/report?from=2026-01-01&to=2026-01-02`,
      `/api/patients/${p2.id}/export.csv?from=2026-01-01&to=2026-01-02`,
    ]) {
      expect((await app.inject({ url, headers: { cookie: v.cookies } })).statusCode).toBe(403);
    }
    expect(
      (
        await app.inject({
          url: '/api/patients/00000000-0000-4000-8000-000000000000/current',
          headers: { cookie: v.cookies },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (await app.inject({ url: `/api/patients/${p1.id}/current`, headers: { cookie: v.cookies } }))
        .statusCode,
    ).toBe(200);

    const note = { ts: '2026-09-27T10:00:00Z', type: 'meal', carbsG: 30 };
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/api/patients/${p1.id}/notes`,
          headers: authed(v),
          payload: note,
        })
      ).statusCode,
    ).toBe(403);
    const created = await app.inject({
      method: 'POST',
      url: `/api/patients/${p1.id}/notes`,
      headers: authed(c),
      payload: note,
    });
    expect(created.statusCode).toBe(201);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/api/patients/${p2.id}/notes`,
          headers: authed(c),
          payload: note,
        })
      ).statusCode,
    ).toBe(403);
    // başka hastanın not kimliğiyle düzenleme
    const noteId = created.json().id;
    const wrongPatient = await app.inject({
      method: 'DELETE',
      url: `/api/patients/${p2.id}/notes/${noteId}`,
      headers: authed(c),
    });
    expect(wrongPatient.statusCode).toBe(403);
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url: `/api/patients/${p1.id}`,
          headers: authed(v),
          payload: { targetLow: 80 },
        })
      ).statusCode,
    ).toBe(403);
  });

  it('ADMIN olmayan yönetim uçlarına erişemez', async () => {
    await createUser('CAREGIVER', 'c@example.com');
    const c = await login(app, 'c@example.com');
    for (const url of ['/api/admin/users', '/api/llu-accounts', '/api/system/status']) {
      expect((await app.inject({ url, headers: { cookie: c.cookies } })).statusCode).toBe(403);
    }
  });

  it('onay (consent) olmadan hasta verisi yok', async () => {
    const { p1 } = await createPatientFixture();
    await createUser('ADMIN', 'a@example.com', undefined, false);
    const a = await login(app, 'a@example.com');
    const r = await app.inject({
      url: `/api/patients/${p1.id}/current`,
      headers: { cookie: a.cookies },
    });
    expect(r.json().error.code).toBe('CONSENT_REQUIRED');
    const me = await app.inject({
      method: 'POST',
      url: '/api/me/consent',
      headers: authed(a),
      payload: { version: '2026-01' },
    });
    expect(me.json().patients).toHaveLength(2);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/me/consent',
          headers: authed(a),
          payload: { version: 'old' },
        })
      ).statusCode,
    ).toBe(400);
  });
});

describe('veri uçları', () => {
  async function adminWithData() {
    const { p1 } = await createPatientFixture();
    await createUser('ADMIN', 'a@example.com');
    const a = await login(app, 'a@example.com');
    const t0 = Date.UTC(2026, 8, 20, 0, 0);
    await prisma.reading.createMany({
      data: Array.from({ length: 288 }, (_, i) => ({
        patientId: p1.id,
        ts: new Date(t0 + i * 300_000),
        mgdl: i < 10 ? 60 : 120,
        source: 'graph' as const,
      })),
    });
    return { a, p1, t0 };
  }

  it('rapor, gün, okumalar, karşılaştırma', async () => {
    const { a, p1, t0 } = await adminWithData();
    const h = { cookie: a.cookies };
    const rep = await app.inject({
      url: `/api/patients/${p1.id}/report?from=${t0}&to=${t0 + 86_400_000}`,
      headers: h,
    });
    expect(rep.statusCode).toBe(200);
    expect(rep.json().stats).toMatchObject({ count: 288, sufficiencyPercent: 100 });
    expect(rep.json().eventSummary.hypoL1).toBe(1);
    const day = await app.inject({ url: `/api/patients/${p1.id}/day?date=2026-09-20`, headers: h });
    expect(day.json().readings.length).toBeGreaterThan(200); // İstanbul günü UTC'den 3 saat kaymış
    const raw = await app.inject({
      url: `/api/patients/${p1.id}/readings?from=${t0}&to=${t0 + 3600_000}&resolution=raw`,
      headers: h,
    });
    expect(raw.json().points).toHaveLength(12);
    const tooLong = await app.inject({
      url: `/api/patients/${p1.id}/readings?from=2026-01-01&to=2026-03-01&resolution=raw`,
      headers: h,
    });
    expect(tooLong.statusCode).toBe(400);
    const cmp = await app.inject({
      url: `/api/patients/${p1.id}/report/compare?from=${t0}&to=${t0 + 86_400_000}`,
      headers: h,
    });
    expect(cmp.json().metrics.find((m: { key: string }) => m.key === 'inRange').previous).toBe(0);
    expect(await prisma.auditLog.count({ where: { action: 'view_report' } })).toBe(1);
  });

  it('CSV dışa aktarma: BOM, ; ayırıcı', async () => {
    const { a, p1, t0 } = await adminWithData();
    const res = await app.inject({
      url: `/api/patients/${p1.id}/export.csv?from=${t0}&to=${t0 + 3600_000}`,
      headers: { cookie: a.cookies },
    });
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.body.startsWith('﻿kayit;zaman_utc;')).toBe(true);
    expect(res.body.split('\r\n').filter(Boolean)).toHaveLength(13);
  });

  it('LibreView CSV içe aktarma (multipart)', async () => {
    const { a, p1 } = await adminWithData();
    const csv = [
      'Glucose Data,Generated on,x',
      'Device,Serial Number,Device Timestamp,Record Type,Historic Glucose mg/dL,Scan Glucose mg/dL',
      'FreeStyle,ABC,01-02-2026 08:00,0,100,',
      'FreeStyle,ABC,01-02-2026 08:15,0,105,',
    ].join('\n');
    const boundary = '----glk';
    const payload = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="lv.csv"\r\nContent-Type: text/csv\r\n\r\n${csv}\r\n--${boundary}--\r\n`;
    const res = await app.inject({
      method: 'POST',
      url: `/api/patients/${p1.id}/import/libreview-csv`,
      headers: authed(a, { 'content-type': `multipart/form-data; boundary=${boundary}` }),
      payload,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ imported: 2, skipped: 0, rows: 2 });
    expect(await prisma.reading.count({ where: { source: 'import' } })).toBe(2);
  });

  it('KVKK silme iki aşamalı', async () => {
    const { a, p1 } = await adminWithData();
    const url = `/api/patients/${p1.id}/data`;
    const step1 = await app.inject({ method: 'DELETE', url, headers: authed(a), payload: {} });
    const { confirmToken, confirmName } = step1.json();
    expect(confirmName).toBe('Bir Hasta');
    const wrong = await app.inject({
      method: 'DELETE',
      url,
      headers: authed(a),
      payload: { confirmToken, confirmName: 'x' },
    });
    expect(wrong.json().error.code).toBe('CONFIRMATION_MISMATCH');
    const ok = await app.inject({
      method: 'DELETE',
      url,
      headers: authed(a),
      payload: { confirmToken, confirmName },
    });
    expect(ok.statusCode).toBe(204);
    expect(await prisma.reading.count({ where: { patientId: p1.id } })).toBe(0);
    const reuse = await app.inject({
      method: 'DELETE',
      url,
      headers: authed(a),
      payload: { confirmToken, confirmName },
    });
    expect(reuse.json().error.code).toBe('CONFIRMATION_EXPIRED');
    expect(await prisma.auditLog.count({ where: { action: 'delete_patient_data' } })).toBe(1);
  });
});

describe('LibreLinkUp hesapları ve yönetim', () => {
  it('mock hesap eklenir, e-posta maskeli, şifreli saklanır, hastalar toplanır', async () => {
    await createUser('ADMIN', 'a@example.com');
    const a = await login(app, 'a@example.com');
    const res = await app.inject({
      method: 'POST',
      url: '/api/llu-accounts',
      headers: authed(a),
      payload: { label: 'Aile', email: 'follower@gmail.com', password: 'pw' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().patients).toEqual(['Deneme Hasta A', 'Deneme Hasta B']);
    expect(res.json().account.emailMasked).toBe('f***@g***.com');
    const row = await prisma.lluAccount.findFirstOrThrow();
    expect(row.emailEnc).not.toContain('follower');
    expect(row.passwordEnc.startsWith('v1:')).toBe(true);
    expect(await prisma.patient.count()).toBe(2);
    expect(await prisma.reading.count()).toBeGreaterThan(40); // current + 12 saatlik graph

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/llu-accounts/${row.id}`,
      headers: authed(a),
      payload: { confirmLabel: 'yanlış' },
    });
    expect(del.statusCode).toBe(400);
    const del2 = await app.inject({
      method: 'DELETE',
      url: `/api/llu-accounts/${row.id}`,
      headers: authed(a),
      payload: { confirmLabel: 'Aile' },
    });
    expect(del2.statusCode).toBe(204);
    expect(await prisma.reading.count()).toBe(0);
  });

  it('son yönetici silinemez; şifre değişimi oturumları kapatır', async () => {
    const adminId = await createUser('ADMIN', 'a@example.com');
    const a = await login(app, 'a@example.com');
    expect(
      (
        await app.inject({
          method: 'DELETE',
          url: `/api/admin/users/${adminId}`,
          headers: authed(a),
        })
      ).statusCode,
    ).toBe(400);
    const created = await app.inject({
      method: 'POST',
      url: '/api/admin/users',
      headers: authed(a),
      payload: {
        email: 'c@example.com',
        password: 'correct-horse-battery',
        displayName: 'C',
        role: 'CAREGIVER',
      },
    });
    expect(created.statusCode).toBe(201);
    const c = await login(app, 'c@example.com');
    await app.inject({
      method: 'PATCH',
      url: `/api/admin/users/${created.json().id}`,
      headers: authed(a),
      payload: { password: 'another-long-password' },
    });
    expect(
      (await app.inject({ url: '/api/auth/me', headers: { cookie: c.cookies } })).statusCode,
    ).toBe(401);
  });

  it('health ve sistem durumu', async () => {
    expect((await app.inject({ url: '/api/health' })).json()).toEqual({ ok: true });
    await createUser('ADMIN', 'a@example.com');
    const a = await login(app, 'a@example.com');
    const s = await app.inject({ url: '/api/system/status', headers: { cookie: a.cookies } });
    expect(s.json().llu).toMatchObject({ product: 'llu.android', version: '4.16.0' });
  });

  it('güvenlik başlıkları (CSP)', async () => {
    const res = await app.inject({ url: '/api/health' });
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});

describe('eşzamanlı kurulum', () => {
  it('iki paralel /setup isteğinden yalnızca biri başarılı, diğeri 409', async () => {
    const mk = (email: string) =>
      app.inject({
        method: 'POST',
        url: '/api/setup',
        remoteAddress: `10.7.7.${email.length}`,
        payload: { email, password: 'long-enough-pw', displayName: 'A' },
      });
    const codes = (
      await Promise.all([mk('a@example.com'), mk('bb@example.com'), mk('ccc@example.com')])
    )
      .map((r) => r.statusCode)
      .sort();
    expect(codes).toEqual([200, 409, 409]);
    expect(await prisma.user.count()).toBe(1);
  });
});

describe('su ve uyku girdileri', () => {
  it("su (ml) ve uyku (süre) notu kaydedilir, CSV'de görünür", async () => {
    const { p1 } = await createPatientFixture();
    await createUser('ADMIN', 'a@example.com');
    const a = await login(app, 'a@example.com');
    const url = `/api/patients/${p1.id}/notes`;
    const water = await app.inject({
      method: 'POST',
      url,
      headers: authed(a),
      payload: { ts: '2026-09-27T10:00:00Z', type: 'water', waterMl: 330 },
    });
    expect(water.statusCode).toBe(201);
    expect(water.json()).toMatchObject({ type: 'water', waterMl: 330 });
    const sleep = await app.inject({
      method: 'POST',
      url,
      headers: authed(a),
      payload: { ts: '2026-09-26T20:30:00Z', type: 'sleep', durationMin: 450 },
    });
    expect(sleep.json()).toMatchObject({ type: 'sleep', durationMin: 450 });
    const bad = await app.inject({
      method: 'POST',
      url,
      headers: authed(a),
      payload: { ts: '2026-09-27T10:00:00Z', type: 'water', waterMl: 99999 },
    });
    expect(bad.statusCode).toBe(400);
    const csv = await app.inject({
      url: `/api/patients/${p1.id}/export.csv?from=2026-09-26&to=2026-09-28`,
      headers: { cookie: a.cookies },
    });
    expect(csv.body).toContain('su_ml');
    expect(csv.body).toMatch(/;water;;;;330;/);
  });
});
