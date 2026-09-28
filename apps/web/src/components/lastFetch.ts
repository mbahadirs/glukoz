import { useQueryClient } from '@tanstack/react-query';
import type { CurrentResponse } from '@glukoz/shared';

/** Önbellekteki `current` yanıtlarından en yeni sunucu çekim zamanı. */
export function useLastFetch(): string | null {
  const qc = useQueryClient();
  const all = qc.getQueriesData<CurrentResponse>({ queryKey: ['current'] });
  const times = all.map(([, d]) => d?.lastFetchAt).filter((x): x is string => !!x);
  return times.sort().at(-1) ?? null;
}
