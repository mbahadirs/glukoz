/**
 * Saat dilimi yardımcıları — yalnızca Intl kullanır (I/O yok).
 * Tüm girdiler ms UTC; çıktılar hastanın yerel takvim/saat bileşenleri.
 */

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  /** 1 = Pazartesi … 7 = Pazar */
  weekday: number;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string): Intl.DateTimeFormat {
  let f = formatterCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      weekday: 'short',
    });
    formatterCache.set(tz, f);
  }
  return f;
}

const WEEKDAYS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

export function zonedParts(ts: number, tz: string): ZonedParts {
  const parts = formatter(tz).formatToParts(new Date(ts));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0';
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')) % 24,
    minute: Number(get('minute')),
    weekday: WEEKDAYS[get('weekday')] ?? 1,
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

export function dateKey(ts: number, tz: string): string {
  const p = zonedParts(ts, tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function minuteOfDay(ts: number, tz: string): number {
  const p = zonedParts(ts, tz);
  return p.hour * 60 + p.minute;
}

/** Verilen UTC anında saat diliminin ofseti (ms, yerel − UTC). */
export function tzOffsetMs(ts: number, tz: string): number {
  const p = zonedParts(ts, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  const truncated = ts - (ts % 60_000);
  return asUtc - truncated;
}

/** YYYY-MM-DD yerel gün başlangıcının UTC ms karşılığı. */
export function zonedDayStart(date: string, tz: string): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const guess = Date.UTC(y, m - 1, d);
  let ts = guess - tzOffsetMs(guess, tz);
  // DST geçişlerinde ofset değişebilir; ikinci tur düzeltir.
  ts = guess - tzOffsetMs(ts, tz);
  return ts;
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** [from, to) aralığına düşen yerel tarihlerin listesi. */
export function datesInRange(from: number, to: number, tz: string): string[] {
  if (to <= from) return [];
  const out: string[] = [];
  let d = dateKey(from, tz);
  const last = dateKey(to - 1, tz);
  for (let i = 0; i < 4000; i++) {
    out.push(d);
    if (d === last) break;
    d = addDays(d, 1);
  }
  return out;
}
