import { SLOT_MS, type EventKind, type EventSummary, type GlycemicEvent } from '@glukoz/shared';
import type { Slot } from './resample.js';
import { zonedParts } from './time.js';

export interface EventOptions {
  hypoL1Threshold: number;
  hypoL2Threshold: number;
  hyperThreshold: number;
  /** olayın başlaması için ardışık süre (dk) */
  minDurationMin: number;
  /** olayın bitmesi için normale dönüş süresi (dk) */
  endDurationMin: number;
  prolongedMin: number;
  /** bu süreden uzun veri boşluğu olayı keser (dk) */
  maxGapMin: number;
  nightStartHour: number;
  nightEndHour: number;
}

export const DEFAULT_EVENT_OPTIONS: EventOptions = {
  hypoL1Threshold: 70,
  hypoL2Threshold: 54,
  hyperThreshold: 250,
  minDurationMin: 15,
  endDurationMin: 15,
  prolongedMin: 120,
  maxGapMin: 20,
  nightStartHour: 0,
  nightEndHour: 6,
};

interface Detector {
  kind: EventKind;
  inside: (v: number) => boolean;
  /** daha uç mu (hipo: küçük, hiper: büyük) */
  moreExtreme: (a: number, b: number) => boolean;
}

function detect(slots: readonly Slot[], d: Detector, o: EventOptions, tz: string): GlycemicEvent[] {
  const events: GlycemicEvent[] = [];
  const minMs = o.minDurationMin * 60_000;
  const endMs = o.endDurationMin * 60_000;
  const gapMs = o.maxGapMin * 60_000;

  let runStart: Slot | null = null; // olay öncesi aday
  let active: { start: number; extreme: Slot; lastIn: Slot } | null = null;
  let exitStart: Slot | null = null;
  let prev: Slot | null = null;

  const close = (end: number, ongoing: boolean) => {
    if (!active) return;
    const durationMin = Math.round((end - active.start) / 60_000);
    const hour = zonedParts(active.start, tz).hour;
    events.push({
      kind: d.kind,
      start: active.start,
      end,
      durationMin,
      extremeMgdl: Math.round(active.extreme.mgdl),
      extremeTs: active.extreme.ts,
      nocturnal: hour >= o.nightStartHour && hour < o.nightEndHour,
      prolonged: durationMin >= o.prolongedMin,
      ongoing,
    });
    active = null;
    exitStart = null;
  };

  for (const s of slots) {
    if (prev && s.ts - prev.ts > gapMs) {
      // uzun boşluk: süren olay son içerideki dilimin sonunda biter
      if (active) close(active.lastIn.ts + SLOT_MS, false);
      runStart = null;
    }
    const isIn = d.inside(s.mgdl);
    if (!active) {
      if (isIn) {
        if (!runStart) runStart = s;
        if (s.ts - runStart.ts + SLOT_MS >= minMs) {
          // başlangıç adayından bu yana en uç değeri bul
          let extreme = runStart;
          for (const x of slots) {
            if (x.ts < runStart.ts) continue;
            if (x.ts > s.ts) break;
            if (d.moreExtreme(x.mgdl, extreme.mgdl)) extreme = x;
          }
          active = { start: runStart.ts, extreme, lastIn: s };
          runStart = null;
        }
      } else runStart = null;
    } else if (isIn) {
      exitStart = null;
      active.lastIn = s;
      if (d.moreExtreme(s.mgdl, active.extreme.mgdl)) active.extreme = s;
    } else {
      if (!exitStart) exitStart = s;
      if (s.ts - exitStart.ts + SLOT_MS >= endMs) close(exitStart.ts, false);
    }
    prev = s;
  }
  if (active) {
    const a = active as { lastIn: Slot };
    close(a.lastIn.ts + SLOT_MS, true);
  }
  return events;
}

/** Hipo (seviye 1 ve 2) ve hiper olaylarını tespit eder; başlangıca göre sıralı döner. */
export function detectEvents(
  slots: readonly Slot[],
  tz: string,
  options: Partial<EventOptions> = {},
): GlycemicEvent[] {
  const o = { ...DEFAULT_EVENT_OPTIONS, ...options };
  const lower = (a: number, b: number) => a < b;
  const higher = (a: number, b: number) => a > b;
  return [
    ...detect(
      slots,
      { kind: 'hypo_l1', inside: (v) => v < o.hypoL1Threshold, moreExtreme: lower },
      o,
      tz,
    ),
    ...detect(
      slots,
      { kind: 'hypo_l2', inside: (v) => v < o.hypoL2Threshold, moreExtreme: lower },
      o,
      tz,
    ),
    ...detect(
      slots,
      { kind: 'hyper', inside: (v) => v > o.hyperThreshold, moreExtreme: higher },
      o,
      tz,
    ),
  ].sort((a, b) => a.start - b.start || a.kind.localeCompare(b.kind));
}

function avg(values: number[]): number | null {
  return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
}

export function summarizeEvents(events: readonly GlycemicEvent[]): EventSummary {
  const hypo = events.filter((e) => e.kind !== 'hyper');
  const l1 = events.filter((e) => e.kind === 'hypo_l1');
  const l2 = events.filter((e) => e.kind === 'hypo_l2');
  const hyper = events.filter((e) => e.kind === 'hyper');
  return {
    total: events.length,
    hypoL1: l1.length,
    hypoL2: l2.length,
    hyper: hyper.length,
    nocturnalHypo: l1.filter((e) => e.nocturnal).length,
    prolongedHypo: l2.filter((e) => e.prolonged).length,
    prolongedHyper: hyper.filter((e) => e.prolonged).length,
    avgHypoDurationMin: avg(hypo.filter((e) => e.kind === 'hypo_l1').map((e) => e.durationMin)),
    avgHyperDurationMin: avg(hyper.map((e) => e.durationMin)),
  };
}
