/**
 * Web Push abonelik uç noktası izin listesi (SSRF önlemi): yalnızca HTTPS ve bilinen
 * tarayıcı push servisleri. Sunucu bu adreslere istek attığı için keyfi URL kabul edilmez.
 */
const ALLOWED_HOST_SUFFIXES = [
  'fcm.googleapis.com', // Chrome, Edge (Chromium), Android
  'push.services.mozilla.com', // Firefox
  'notify.windows.com', // Windows
  'push.apple.com', // Safari / iOS 16.4+
];

export function isAllowedPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.username || url.password) return false;
  if (url.port && url.port !== '443') return false;
  const host = url.hostname.toLowerCase();
  return ALLOWED_HOST_SUFFIXES.some((s) => host === s || host.endsWith(`.${s}`));
}
