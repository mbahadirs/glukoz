const MINUTE = 60_000;
const MAX_BACKOFF_MS = 30 * MINUTE;

/** Üstel geri çekilme: 1 dk → 2 → 4 → … → en fazla 30 dk. `step` 1'den başlar. */
export function backoffDelayMs(step: number): number {
  if (step <= 0) return 0;
  return Math.min(MAX_BACKOFF_MS, MINUTE * 2 ** (step - 1));
}

/** ±5 sn rastgele kayma. */
export function jitterMs(maxMs = 5_000, rnd: () => number = Math.random): number {
  return Math.round((rnd() * 2 - 1) * maxMs);
}
