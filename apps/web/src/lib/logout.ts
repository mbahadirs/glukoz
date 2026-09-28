import { api } from './api';

/** Service worker'ın sağlık verisi önbelleği (sw.ts ile aynı ad). */
export const API_DATA_CACHE = 'api-data';

/**
 * Oturumu kapatır ve cihazdaki önbelleğe alınmış sağlık verisini siler
 * (paylaşılan cihazda sonraki kullanıcı göremesin — KVKK).
 */
export async function logoutAndPurge(): Promise<void> {
  await api('/api/auth/logout', { method: 'POST', body: {} }).catch(() => undefined);
  await purgeCachedHealthData();
}

export async function purgeCachedHealthData(): Promise<void> {
  if (typeof caches === 'undefined') return;
  try {
    await caches.delete(API_DATA_CACHE);
  } catch (err) {
    console.warn('önbellek temizlenemedi', err);
  }
}
