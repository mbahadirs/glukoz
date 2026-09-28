/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

// Uygulama kabuğu
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
clientsClaim();

// SPA gezinme: /api dışındaki tüm gezinmeler index.html
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/api\//] }),
);

// Canlı/günlük/rapor verisi: NetworkFirst, 5 sn zaman aşımı, çevrimdışıyken son yanıt.
// Kimlik uçları ve GET dışı istekler hiçbir zaman önbelleğe alınmaz (yalnız GET eşleşir).
const DATA_PATH = /^\/api\/patients\/[^/]+\/(current|day|report)$/;
registerRoute(
  ({ url, request }) =>
    request.method === 'GET' && url.origin === self.location.origin && DATA_PATH.test(url.pathname),
  new NetworkFirst({
    cacheName: 'api-data', // lib/logout.ts API_DATA_CACHE ile aynı; çıkışta silinir
    networkTimeoutSeconds: 5,
    plugins: [new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 7 * 24 * 3600 })],
  }),
  'GET',
);

self.addEventListener('message', (event) => {
  if ((event.data as { type?: string } | undefined)?.type === 'SKIP_WAITING')
    void self.skipWaiting();
});

interface PushPayload {
  title?: string;
  body?: string;
  tag?: string;
  renotify?: boolean;
  data?: { url?: string };
}

self.addEventListener('push', (event) => {
  let payload: PushPayload = {};
  try {
    payload = (event.data?.json() ?? {}) as PushPayload;
  } catch {
    payload = { title: 'Glukoz Paneli', body: event.data?.text() };
  }
  const options: NotificationOptions & { renotify?: boolean } = {
    body: payload.body,
    tag: payload.tag,
    renotify: !!payload.renotify && !!payload.tag,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: payload.data ?? { url: '/' },
  };
  event.waitUntil(self.registration.showNotification(payload.title ?? 'Glukoz Paneli', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(
    (event.notification.data as { url?: string } | undefined)?.url ?? '/',
    self.location.origin,
  ).href;
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const same = all.find((c) => c.url === target) ?? all[0];
      if (same) {
        await same.focus();
        if (same.url !== target && 'navigate' in same)
          await (same as WindowClient).navigate(target);
        return;
      }
      await self.clients.openWindow(target);
    })(),
  );
});
