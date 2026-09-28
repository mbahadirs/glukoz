import { useCallback, useMemo, useState } from 'react';
import {
  extrapolate,
  linearProjection,
  medianIntervalMin,
  segmentTrend,
  type Projection,
  type TrendSegment,
} from '@glukoz/metrics';
import type { GlucosePoint } from '@glukoz/shared';

export const PROJECTION_HORIZON_MIN = 30;
const STORAGE_KEY = 'glk.showProjection';

function readShowProjection(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

function writeShowProjection(v: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(v));
  } catch {
    // tercih yalnızca bu oturumda geçerli kalır
  }
}

/** Seçime nokta ekler: aynı noktaya dokunmak kaldırır, 3. nokta yeni seçim başlatır. */
export function nextSelection(prev: GlucosePoint[], point: GlucosePoint): GlucosePoint[] {
  if (prev.some((p) => p.ts === point.ts)) return prev.filter((p) => p.ts !== point.ts);
  if (prev.length >= 2) return [point];
  return [...prev, point];
}

export interface TrendState {
  selection: GlucosePoint[];
  segment: TrendSegment | null;
  extension: GlucosePoint[];
  projection: Projection | null;
  showProjection: boolean;
  intervalMin: number | null;
  select: (p: GlucosePoint) => void;
  clear: () => void;
  toggleProjection: () => void;
}

/** Canlı grafik eğilim durumu. Hesaplar `@glukoz/metrics` saf fonksiyonlarındadır. */
export function useTrend(
  points: Array<[number, number]>,
  now: number,
  patientId?: string,
): TrendState {
  const [selectionState, setSelection] = useState<{ patientId?: string; points: GlucosePoint[] }>({
    points: [],
  });
  const [showProjection, setShow] = useState(readShowProjection);
  // Hasta değişince seçim sıfırlanır.
  const selection = useMemo(
    () => (selectionState.patientId === patientId ? selectionState.points : []),
    [selectionState, patientId],
  );

  const series = useMemo(() => points.map(([ts, mgdl]) => ({ ts, mgdl })), [points]);
  const projection = useMemo(
    () =>
      showProjection ? linearProjection(series, { now, horizonMin: PROJECTION_HORIZON_MIN }) : null,
    [series, now, showProjection],
  );
  const intervalMin = useMemo(() => medianIntervalMin(series), [series]);
  const segment = useMemo(
    () =>
      selection.length === 2
        ? segmentTrend(selection[0] as GlucosePoint, selection[1] as GlucosePoint)
        : null,
    [selection],
  );
  const extension = useMemo(
    () => (segment ? extrapolate(segment.to, segment.ratePerMin, PROJECTION_HORIZON_MIN) : []),
    [segment],
  );

  const select = useCallback(
    (p: GlucosePoint) =>
      setSelection((prev) => ({
        patientId,
        points: nextSelection(prev.patientId === patientId ? prev.points : [], p),
      })),
    [patientId],
  );
  const clear = useCallback(() => setSelection({ patientId, points: [] }), [patientId]);
  const toggleProjection = useCallback(() => {
    setShow((v) => {
      writeShowProjection(!v);
      return !v;
    });
  }, []);

  return {
    selection,
    segment,
    extension,
    projection,
    showProjection,
    intervalMin,
    select,
    clear,
    toggleProjection,
  };
}
