import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  api,
  ApiError,
  AUTH_EVENT,
  buildUrl,
  CONSENT_EVENT,
  setCsrfToken,
} from '../../src/lib/api';

function mockFetch(status: number, body: unknown, contentType = 'application/json') {
  const fn = vi.fn(
    async () =>
      new Response(status === 204 ? null : JSON.stringify(body), {
        status,
        headers: { 'content-type': contentType },
      }),
  );
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('api client', () => {
  beforeEach(() => setCsrfToken('tok123'));
  afterEach(() => vi.unstubAllGlobals());

  it('GET CSRF başlığı göndermez, sorgu parametrelerini kurar', async () => {
    const f = mockFetch(200, { ok: true });
    await api('/api/x', { query: { a: 1, b: undefined, c: '' } });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/x?a=1');
    expect((init.headers as Record<string, string>)['x-csrf-token']).toBeUndefined();
  });

  it('POST CSRF başlığı ekler; login muaf', async () => {
    const f = mockFetch(200, {});
    await api('/api/patients/p/notes', { method: 'POST', body: { a: 1 } });
    expect(
      ((f.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Record<string, string>)[
        'x-csrf-token'
      ],
    ).toBe('tok123');
    await api('/api/auth/login', { method: 'POST', body: {} });
    expect(
      ((f.mock.calls[1] as unknown as [string, RequestInit])[1].headers as Record<string, string>)[
        'x-csrf-token'
      ],
    ).toBeUndefined();
  });

  it('CSRF token yoksa çerezden okur', async () => {
    setCsrfToken(null);
    document.cookie = 'glk_csrf=fromcookie';
    const f = mockFetch(204, null);
    await api('/api/x', { method: 'DELETE' });
    expect(
      ((f.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Record<string, string>)[
        'x-csrf-token'
      ],
    ).toBe('fromcookie');
  });

  it('hata gövdesini ApiError olarak fırlatır ve 401 olayı yayar', async () => {
    mockFetch(401, { error: { code: 'UNAUTHORIZED', message: 'no' } });
    const spy = vi.fn();
    window.addEventListener(AUTH_EVENT, spy);
    await expect(api('/api/auth/me')).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
    expect(spy).toHaveBeenCalledOnce();
    window.removeEventListener(AUTH_EVENT, spy);
  });

  it('CONSENT_REQUIRED olayı ve JSON olmayan hata', async () => {
    mockFetch(403, { error: { code: 'CONSENT_REQUIRED', message: 'c' } });
    const spy = vi.fn();
    window.addEventListener(CONSENT_EVENT, spy);
    await expect(api('/api/patients')).rejects.toBeInstanceOf(ApiError);
    expect(spy).toHaveBeenCalledOnce();
    mockFetch(500, 'boom', 'text/plain');
    await expect(api('/api/x')).rejects.toMatchObject({ code: 'HTTP_500' });
  });

  it('buildUrl', () => {
    expect(buildUrl('/a')).toBe('/a');
    expect(buildUrl('/a', { x: 'y z' })).toBe('/a?x=y+z');
  });
});
