import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { CurrentResponse, StreamEvent } from '@glukoz/shared';
import { qk } from '../lib/queries';

export const FALLBACK_POLL_MS = 60_000;

/** Olayı sorgu önbelleğine uygular (saf güncelleme — yeni nesne döner). */
export function applyReading(
  prev: CurrentResponse | undefined,
  ev: Extract<StreamEvent, { type: 'reading' }>,
) {
  if (!prev) return prev;
  if (prev.reading && Date.parse(prev.reading.ts) >= Date.parse(ev.reading.ts)) return prev;
  return {
    ...prev,
    reading: ev.reading,
    ageSec: Math.max(0, Math.round((Date.now() - Date.parse(ev.reading.ts)) / 1000)),
    lastFetchAt: new Date().toISOString(),
  };
}

/**
 * SSE aboneliği. Bağlantı koparsa `connected=false` döner; çağıran 60 sn polling'e geçer.
 * `reading` → current sorgusu güncellenir, ilgili sorgular geçersiz kılınır; `alert` → uyarı listesi.
 */
export function useStream(patientId: string | undefined): { connected: boolean } {
  const qc = useQueryClient();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!patientId || typeof EventSource === 'undefined') return;
    const es = new EventSource(`/api/stream?patientId=${encodeURIComponent(patientId)}`, {
      withCredentials: true,
    });
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    const onReading = (e: MessageEvent<string>) => {
      const ev = JSON.parse(e.data) as Extract<StreamEvent, { type: 'reading' }>;
      qc.setQueryData<CurrentResponse>(qk.current(ev.patientId), (prev) => applyReading(prev, ev));
      void qc.invalidateQueries({ queryKey: qk.current(ev.patientId) });
      void qc.invalidateQueries({ queryKey: ['readings', ev.patientId] });
      void qc.invalidateQueries({ queryKey: qk.patients });
    };
    const onAlert = () => {
      void qc.invalidateQueries({ queryKey: qk.activeAlerts });
      void qc.invalidateQueries({ queryKey: ['alerts'] });
    };
    es.addEventListener('reading', onReading as EventListener);
    es.addEventListener('alert', onAlert);
    return () => {
      es.close();
      setConnected(false);
    };
  }, [patientId, qc]);

  return { connected };
}
