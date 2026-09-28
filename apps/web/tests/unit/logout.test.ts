import { afterEach, describe, expect, it, vi } from 'vitest';
import { API_DATA_CACHE, logoutAndPurge } from '../../src/lib/logout';

describe('logoutAndPurge', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('çıkış isteği atar ve sağlık verisi önbelleğini siler', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const deleteMock = vi.fn().mockResolvedValue(true);
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('caches', { delete: deleteMock });
    await logoutAndPurge();
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/auth/logout');
    expect(deleteMock).toHaveBeenCalledWith(API_DATA_CACHE);
  });

  it('ağ hatasında da önbelleği siler', async () => {
    const deleteMock = vi.fn().mockResolvedValue(true);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    vi.stubGlobal('caches', { delete: deleteMock });
    await logoutAndPurge();
    expect(deleteMock).toHaveBeenCalled();
  });
});
