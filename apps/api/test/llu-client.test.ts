import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { accountIdFor, LluClient } from '../src/llu/client.js';
import { LluError } from '../src/llu/errors.js';
import { hostFor, regionOf } from '../src/llu/types.js';

const fx = (name: string) =>
  JSON.parse(readFileSync(new URL(`./fixtures/llu/${name}.json`, import.meta.url), 'utf8'));
const GLOBAL = 'https://api.libreview.io';
const EU = 'https://api-eu.libreview.io';
const USER_ID = '7d2f3c1e-1111-4a2b-9c3d-000000000001';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const client = (extra: Partial<ConstructorParameters<typeof LluClient>[0]> = {}) =>
  new LluClient({
    email: 'follower@example.com',
    password: 'pw',
    product: 'llu.android',
    version: '4.16.0',
    ...extra,
  });

async function expectLluError(p: Promise<unknown>, code: string): Promise<LluError> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(LluError);
    expect((e as LluError).code).toBe(code);
    return e as LluError;
  }
  throw new Error(`beklenen hata: ${code}`);
}

describe('LluClient', () => {
  it('başarılı giriş ve zorunlu başlıklar', async () => {
    const seen: Record<string, string>[] = [];
    server.use(
      http.post(`${GLOBAL}/llu/auth/login`, async ({ request }) => {
        seen.push(Object.fromEntries(request.headers));
        expect(await request.json()).toEqual({ email: 'follower@example.com', password: 'pw' });
        return HttpResponse.json(fx('login-success'));
      }),
      http.get(`${GLOBAL}/llu/connections`, ({ request }) => {
        seen.push(Object.fromEntries(request.headers));
        return HttpResponse.json(fx('connections'));
      }),
    );
    const onSession = vi.fn();
    const c = client({ onSession });
    const session = await c.login();
    expect(session).toMatchObject({
      region: 'global',
      userId: USER_ID,
      token: 'tok-abc',
      expires: 1999999999,
    });
    const res = await c.connections();
    expect(res.data[0]?.glucoseMeasurement?.ValueInMgPerDl).toBe(91);

    for (const h of seen) {
      expect(h).toMatchObject({
        product: 'llu.android',
        version: '4.16.0',
        'content-type': 'application/json',
        accept: 'application/json',
        'cache-control': 'no-cache',
      });
    }
    const authedHeaders = seen[1] as Record<string, string>;
    const expectedAccountId = createHash('sha256').update(USER_ID).digest('hex');
    expect(authedHeaders['account-id']).toBe(expectedAccountId);
    expect(authedHeaders['account-id']).toMatch(/^[0-9a-f]{64}$/);
    expect(authedHeaders.authorization).toBe('Bearer tok-abc');
    // yanıttaki yeni ticket token'ı günceller
    expect(c.getSession()?.token).toBe('tok-refreshed');
    expect(onSession).toHaveBeenCalledTimes(2);
  });

  it('bölge yönlendirmesi', async () => {
    server.use(
      http.post(`${GLOBAL}/llu/auth/login`, () => HttpResponse.json(fx('login-redirect'))),
      http.post(`${EU}/llu/auth/login`, () => HttpResponse.json(fx('login-success'))),
      http.get(`${EU}/llu/connections/:pid/graph`, ({ params }) => {
        expect(params.pid).toBe('p1');
        return HttpResponse.json(fx('graph'));
      }),
    );
    const c = client();
    expect((await c.login()).region).toBe('eu');
    const g = await c.graph('p1');
    expect(g.data.graphData).toHaveLength(4);
  });

  it('status 2 → LLU_BAD_CREDENTIALS, tekrar deneme yok', async () => {
    let calls = 0;
    server.use(
      http.post(
        `${GLOBAL}/llu/auth/login`,
        () => (calls++, HttpResponse.json(fx('login-status2'))),
      ),
    );
    const err = await expectLluError(client().login(), 'LLU_BAD_CREDENTIALS');
    expect(err.isFatalForAccount).toBe(true);
    expect(calls).toBe(1);
  });

  it('status 4 → LLU_ACTION_REQUIRED', async () => {
    server.use(http.post(`${GLOBAL}/llu/auth/login`, () => HttpResponse.json(fx('login-status4'))));
    const err = await expectLluError(client().login(), 'LLU_ACTION_REQUIRED');
    expect(err.details.step).toContain('tou');
  });

  it('status 920 → sürümü bir kez yükseltip tekrar dener', async () => {
    const versions: string[] = [];
    server.use(
      http.post(`${GLOBAL}/llu/auth/login`, ({ request }) => {
        const v = request.headers.get('version') as string;
        versions.push(v);
        return v === '4.17.0'
          ? HttpResponse.json(fx('login-success'))
          : HttpResponse.json(fx('status920'), { status: 403 });
      }),
    );
    const onVersionUpgrade = vi.fn();
    const c = client({ onVersionUpgrade });
    await c.login();
    expect(versions).toEqual(['4.16.0', '4.17.0']);
    expect(c.version).toBe('4.17.0');
    expect(onVersionUpgrade).toHaveBeenCalledWith('4.17.0', '4.17.0');
  });

  it('status 920 ikinci kez → LLU_VERSION_TOO_OLD', async () => {
    server.use(
      http.post(`${GLOBAL}/llu/auth/login`, () =>
        HttpResponse.json(fx('status920'), { status: 403 }),
      ),
    );
    const err = await expectLluError(client().login(), 'LLU_VERSION_TOO_OLD');
    expect(err.details.minimumVersion).toBe('4.17.0');
  });

  it('status 920 minimumVersion olmadan → hemen hata', async () => {
    server.use(
      http.post(`${GLOBAL}/llu/auth/login`, () =>
        HttpResponse.json({ status: 920 }, { status: 403 }),
      ),
    );
    await expectLluError(client().login(), 'LLU_VERSION_TOO_OLD');
  });

  it('401 sonrası bir kez yeniden giriş yapıp isteği tekrarlar', async () => {
    let logins = 0;
    let conns = 0;
    server.use(
      http.post(
        `${GLOBAL}/llu/auth/login`,
        () => (logins++, HttpResponse.json(fx('login-success'))),
      ),
      http.get(`${GLOBAL}/llu/connections`, () =>
        ++conns === 1
          ? new HttpResponse(null, { status: 401 })
          : HttpResponse.json(fx('connections')),
      ),
    );
    const c = client();
    await c.login();
    await c.connections();
    expect(logins).toBe(2);
    expect(conns).toBe(2);
  });

  it('ikinci 401 → LLU_UNAUTHORIZED', async () => {
    server.use(
      http.post(`${GLOBAL}/llu/auth/login`, () => HttpResponse.json(fx('login-success'))),
      http.get(`${GLOBAL}/llu/connections`, () => new HttpResponse(null, { status: 401 })),
    );
    await expectLluError(client().connections(), 'LLU_UNAUTHORIZED');
  });

  it('429 → LLU_RATE_LIMITED (retry-after)', async () => {
    server.use(
      http.post(
        `${GLOBAL}/llu/auth/login`,
        () => new HttpResponse(null, { status: 429, headers: { 'retry-after': '600' } }),
      ),
    );
    const err = await expectLluError(client().login(), 'LLU_RATE_LIMITED');
    expect(err.details.retryAfterSec).toBe(600);
  });

  it('authed istekte 429 ve 920', async () => {
    server.use(
      http.post(`${GLOBAL}/llu/auth/login`, () => HttpResponse.json(fx('login-success'))),
      http.get(`${GLOBAL}/llu/connections`, () => new HttpResponse(null, { status: 429 })),
      http.get(`${GLOBAL}/llu/connections/:pid/logbook`, () =>
        HttpResponse.json(fx('status920'), { status: 403 }),
      ),
    );
    const c = client();
    await expectLluError(c.connections(), 'LLU_RATE_LIMITED');
    await expectLluError(c.logbook('x'), 'LLU_VERSION_TOO_OLD');
  });

  it('ağ hatası, JSON olmayan yanıt, şema hatası, HTTP 500', async () => {
    server.use(http.post(`${GLOBAL}/llu/auth/login`, () => HttpResponse.error()));
    await expectLluError(client().login(), 'LLU_NETWORK');
    server.use(
      http.post(`${GLOBAL}/llu/auth/login`, () => new HttpResponse('<html>', { status: 200 })),
    );
    await expectLluError(client().login(), 'LLU_BAD_RESPONSE');
    server.use(
      http.post(`${GLOBAL}/llu/auth/login`, () => HttpResponse.json(fx('login-success'))),
      http.get(`${GLOBAL}/llu/connections`, () => HttpResponse.json({ status: 0, data: 'bozuk' })),
      http.get(`${GLOBAL}/llu/connections/:pid/graph`, () =>
        HttpResponse.json({ status: 0 }, { status: 500 }),
      ),
    );
    const c = client();
    await expectLluError(c.connections(), 'LLU_BAD_RESPONSE');
    await expectLluError(c.graph('p'), 'LLU_HTTP');
  });

  it('geçerli oturum varsa giriş yapmaz; bitişe 1 günden az kaldıysa yeniden girer', async () => {
    let logins = 0;
    server.use(
      http.post(
        `${GLOBAL}/llu/auth/login`,
        () => (logins++, HttpResponse.json(fx('login-success'))),
      ),
      http.get(`${GLOBAL}/llu/connections`, () => HttpResponse.json(fx('connections'))),
    );
    const far = Math.floor(Date.now() / 1000) + 30 * 86400;
    await client({
      session: { region: 'global', userId: USER_ID, token: 't', expires: far },
    }).connections();
    expect(logins).toBe(0);
    const soon = Math.floor(Date.now() / 1000) + 3600;
    await client({
      session: { region: 'global', userId: USER_ID, token: 't', expires: soon },
    }).connections();
    expect(logins).toBe(1);
  });

  it('bölge yardımcıları', () => {
    expect(hostFor('EU2')).toBe('https://api-eu2.libreview.io');
    expect(hostFor('xy')).toBe('https://api-xy.libreview.io');
    expect(() => hostFor('../evil')).toThrow();
    expect(regionOf('https://api-xy.libreview.io')).toBe('xy');
    expect(regionOf('https://api.libreview.io')).toBe('global');
    expect(accountIdFor('abc')).toBe(createHash('sha256').update('abc').digest('hex'));
  });
});

describe('LluClient hata zarfı', () => {
  it('status ≠ 0 yanıtında bir kez yeniden girer; tekrarında kodlu hata verir', async () => {
    let logins = 0;
    let calls = 0;
    server.use(
      http.post(
        `${GLOBAL}/llu/auth/login`,
        () => (logins++, HttpResponse.json(fx('login-success'))),
      ),
      http.get(`${GLOBAL}/llu/connections`, () =>
        ++calls === 1
          ? HttpResponse.json({ status: 2, error: { message: 'notAuthenticated' } })
          : HttpResponse.json(fx('connections')),
      ),
    );
    const c = client();
    await c.login();
    await c.connections();
    expect(logins).toBe(2);

    server.use(
      http.get(`${GLOBAL}/llu/connections`, () =>
        HttpResponse.json({ status: 7, error: { message: 'bakım' } }),
      ),
    );
    const err = await expectLluError(client().connections(), 'LLU_HTTP');
    expect(err.message).toContain('hata durumu 7: bakım');
  });

  it('şema hatası yapı ipucu içerir, değer içermez', async () => {
    server.use(
      http.post(`${GLOBAL}/llu/auth/login`, () => HttpResponse.json(fx('login-success'))),
      http.get(`${GLOBAL}/llu/connections`, () =>
        HttpResponse.json({ status: 0, data: { secret: 'gizli-deger' } }),
      ),
    );
    const err = await expectLluError(client().connections(), 'LLU_BAD_RESPONSE');
    expect(err.message).toContain('status:number,data:{secret}');
    expect(err.message).not.toContain('gizli-deger');
  });
});

describe('LluClient veri isteğinde bölge yönlendirmesi', () => {
  it('connections yönlendirme dönerse bölgeye geçip yeniden girer', async () => {
    server.use(
      http.post(`${GLOBAL}/llu/auth/login`, () => HttpResponse.json(fx('login-success'))),
      http.get(`${GLOBAL}/llu/connections`, () =>
        HttpResponse.json({ status: 0, data: { redirect: true, region: 'eu' } }),
      ),
      http.post(`${EU}/llu/auth/login`, () => HttpResponse.json(fx('login-success'))),
      http.get(`${EU}/llu/connections`, () => HttpResponse.json(fx('connections'))),
    );
    const onSession = vi.fn();
    const c = client({ onSession });
    const res = await c.connections();
    expect(res.data).toHaveLength(1);
    expect(c.getSession()?.region).toBe('eu');
    expect(onSession).toHaveBeenLastCalledWith(expect.objectContaining({ region: 'eu' }));
  });
});
