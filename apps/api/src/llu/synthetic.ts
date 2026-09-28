import { addDays, dateKey, minuteOfDay, zonedDayStart } from '@glukoz/metrics';

/**
 * Deterministik sentetik glukoz üreteci (mock mod + seed).
 * 110 mg/dL taban + öğün tepeleri (08:00, 13:00, 19:30), gece hafif düşüş, ±5 gürültü,
 * haftada ~2–3 hipo, ara sıra 30–90 dk veri boşluğu. Aynı (profil, zaman) → aynı değer.
 */

export interface SyntheticProfile {
  id: string;
  seed: number;
  base: number;
  mealScale: number;
  timezone: string;
}

const MEALS_MIN = [8 * 60, 13 * 60, 19 * 60 + 30];
const MIN = 60_000;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

interface DayPlan {
  dayStart: number;
  meals: Array<{ ts: number; amp: number; tpMin: number }>;
  hypo: { ts: number; depth: number; sigmaMin: number } | null;
  gap: { from: number; to: number } | null;
}

const planCache = new Map<string, DayPlan>();

function dayPlan(p: SyntheticProfile, date: string): DayPlan {
  const key = `${p.id}|${date}`;
  const cached = planCache.get(key);
  if (cached) return cached;
  const rnd = mulberry32(hashString(key) ^ p.seed);
  const dayStart = zonedDayStart(date, p.timezone);
  const meals = MEALS_MIN.map((m) => ({
    ts: dayStart + (m + Math.round((rnd() - 0.5) * 40)) * MIN,
    amp: (60 + rnd() * 60) * p.mealScale,
    tpMin: 45 + rnd() * 20,
  }));
  const hypo =
    rnd() < 0.37
      ? {
          ts: dayStart + (90 + rnd() * 1260) * MIN,
          depth: 55 + rnd() * 25,
          sigmaMin: 18 + rnd() * 10,
        }
      : null;
  const gapStart = dayStart + rnd() * 1380 * MIN;
  const gap = rnd() < 0.3 ? { from: gapStart, to: gapStart + (30 + rnd() * 60) * MIN } : null;
  const plan = { dayStart, meals, hypo, gap };
  if (planCache.size > 5000) planCache.clear();
  planCache.set(key, plan);
  return plan;
}

/** Gama benzeri öğün yanıtı: tp dakikada zirve, 2–3 saatte söner. */
function mealCurve(tMin: number, amp: number, tpMin: number): number {
  if (tMin <= 0) return 0;
  const x = tMin / tpMin;
  return amp * x * Math.exp(1 - x) * (x > 1 ? Math.exp(-(x - 1) * 0.35) : 1);
}

export function glucoseAt(p: SyntheticProfile, ts: number): number {
  const today = dateKey(ts, p.timezone);
  const plans = [dayPlan(p, addDays(today, -1)), dayPlan(p, today)];
  const m = minuteOfDay(ts, p.timezone);
  let v = p.base;
  if (m < 360) v -= 12 * Math.sin((Math.PI * m) / 360);
  for (const plan of plans) {
    for (const meal of plan.meals) v += mealCurve((ts - meal.ts) / MIN, meal.amp, meal.tpMin);
    if (plan.hypo) {
      const d = (ts - plan.hypo.ts) / MIN;
      v -= plan.hypo.depth * Math.exp(-(d * d) / (2 * plan.hypo.sigmaMin ** 2));
    }
  }
  const noise = 3 * Math.sin(ts / (7 * MIN) + p.seed) + 2 * Math.sin(ts / (17 * MIN) + p.seed * 3);
  return Math.round(Math.min(400, Math.max(40, v + noise)));
}

export function isGap(p: SyntheticProfile, ts: number): boolean {
  const gap = dayPlan(p, dateKey(ts, p.timezone)).gap;
  return gap !== null && ts >= gap.from && ts < gap.to;
}

/** Son 15 dk eğiminden trend oku (1–5). */
export function trendAt(p: SyntheticProfile, ts: number): number {
  const rate = (glucoseAt(p, ts) - glucoseAt(p, ts - 15 * MIN)) / 15;
  if (rate < -2) return 1;
  if (rate < -1) return 2;
  if (rate <= 1) return 3;
  if (rate <= 2) return 4;
  return 5;
}

/** Verilen andaki son geçerli (boşlukta olmayan) dakikayı bulur. */
export function lastValidMinute(p: SyntheticProfile, ts: number): number {
  let t = ts - (ts % MIN);
  for (let i = 0; i < 180 && isGap(p, t); i++) t -= MIN;
  return t;
}
