import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';

export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export type PushState = 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed';

export function usePush() {
  const [state, setState] = useState<PushState>('unsubscribed');
  const supported =
    typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;

  const refresh = useCallback(async () => {
    if (!supported) return setState('unsupported');
    if (Notification.permission === 'denied') return setState('denied');
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    setState(sub ? 'subscribed' : 'unsubscribed');
  }, [supported]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const subscribe = async () => {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return refresh();
    const { key } = await api<{ key: string | null }>('/api/push/vapid-public-key');
    if (!key) throw new Error('VAPID');
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
    });
    const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
    await api('/api/push/subscribe', {
      method: 'POST',
      body: { endpoint: json.endpoint, keys: json.keys },
    });
    await refresh();
  };

  const unsubscribe = async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await api('/api/push/subscribe', { method: 'DELETE', body: { endpoint: sub.endpoint } });
      await sub.unsubscribe();
    }
    await refresh();
  };

  const test = () => api<{ sent: number }>('/api/push/test', { method: 'POST', body: {} });

  return { state, subscribe, unsubscribe, test };
}
