import { useTranslation } from 'react-i18next';
import type { RangeShare, TimeInRanges } from '@glukoz/shared';
import { fmtMinutes, fmtPercent } from '../../lib/format';

type Segments = Pick<TimeInRanges, 'veryLow' | 'low' | 'inRange' | 'high' | 'veryHigh'>;
export type SegmentKey = keyof Segments;

export const SEGMENTS: Array<{ key: SegmentKey; color: string; pattern?: string }> = [
  {
    key: 'veryHigh',
    color: 'var(--g-very-high)',
    pattern: 'repeating-linear-gradient(45deg, transparent 0 4px, rgba(0,0,0,.25) 4px 6px)',
  },
  { key: 'high', color: 'var(--g-high)' },
  { key: 'inRange', color: 'var(--g-in-range)' },
  { key: 'low', color: 'var(--g-low)' },
  {
    key: 'veryLow',
    color: 'var(--g-very-low)',
    pattern: 'repeating-linear-gradient(-45deg, transparent 0 4px, rgba(255,255,255,.35) 4px 6px)',
  },
];

function segStyle(seg: (typeof SEGMENTS)[number], share: RangeShare, vertical: boolean) {
  const size = `${Math.max(share.percent, 0)}%`;
  return {
    background: seg.pattern ? `${seg.pattern}, ${seg.color}` : seg.color,
    ...(vertical ? { height: size } : { width: size }),
  };
}

interface Props {
  tir: Segments;
  variant?: 'horizontal' | 'vertical';
  /** dikeyde yanında yüzde, süre/gün ve hedef işaretleri */
  goals?: Partial<Record<SegmentKey, { ok: boolean; text: string }>>;
  compact?: boolean;
}

/**
 * TIR yığılmış çubuğu (HTML/CSS — baskıda ve ekran okuyucuda güvenilir).
 * Renk tek başına anlam taşımaz: her segment etiketli, uç aralıklar desenli.
 */
export function TirStackedBar({ tir, variant = 'horizontal', goals, compact }: Props) {
  const { t, i18n } = useTranslation();
  const vertical = variant === 'vertical';
  const summary = SEGMENTS.map(
    (s) => `${t(`ranges.${s.key}`)} ${fmtPercent(tir[s.key].percent, i18n.language)}`,
  ).join(', ');

  if (!vertical) {
    return (
      <div>
        <div
          className="flex h-5 w-full overflow-hidden rounded border border-border"
          role="img"
          aria-label={summary}
        >
          {[...SEGMENTS].reverse().map((s) => (
            <div
              key={s.key}
              style={segStyle(s, tir[s.key], false)}
              title={`${t(`ranges.${s.key}`)} ${fmtPercent(tir[s.key].percent, i18n.language)}`}
            />
          ))}
        </div>
        {!compact && (
          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
            {[...SEGMENTS].reverse().map((s) => (
              <li key={s.key} className="flex items-center gap-1">
                <span
                  aria-hidden
                  className="inline-block h-3 w-3 rounded-sm"
                  style={segStyle(s, { percent: 100, minutesPerDay: 0 }, false)}
                />
                {t(`ranges.${s.key}`)}{' '}
                <span className="num font-semibold text-text">
                  {fmtPercent(tir[s.key].percent, i18n.language)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-stretch gap-4">
      <div
        className="flex h-72 w-12 shrink-0 flex-col overflow-hidden rounded border border-border"
        role="img"
        aria-label={summary}
      >
        {SEGMENTS.map((s) => (
          <div key={s.key} style={segStyle(s, tir[s.key], true)} />
        ))}
      </div>
      <ul className="flex flex-1 flex-col justify-between py-1 text-sm">
        {SEGMENTS.map((s) => {
          const g = goals?.[s.key];
          return (
            <li key={s.key} className="flex flex-wrap items-baseline gap-x-2">
              <span
                aria-hidden
                className="inline-block h-3 w-3 rounded-sm"
                style={segStyle(s, { percent: 100, minutesPerDay: 0 }, false)}
              />
              <span className="min-w-28">{t(`ranges.${s.key}`)}</span>
              <span className="text-xs text-muted">{t(`ranges.${s.key}Range`)}</span>
              <span className="num ml-auto text-base font-semibold">
                {fmtPercent(tir[s.key].percent, i18n.language)}
              </span>
              <span className="num w-24 text-right text-xs text-muted">
                {t('units.perDay', { value: fmtMinutes(tir[s.key].minutesPerDay, t) })}
              </span>
              {g && (
                <span className={`w-full text-xs ${g.ok ? 'text-ok' : 'text-danger-text'}`}>
                  <span aria-hidden>{g.ok ? '✓' : '✗'}</span>{' '}
                  {g.ok ? t('reports.goalMet') : t('reports.goalMissed')}: {g.text}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
