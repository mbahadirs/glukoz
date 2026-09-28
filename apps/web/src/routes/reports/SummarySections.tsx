import { useTranslation } from 'react-i18next';
import {
  TIR_GOALS,
  unitLabel,
  type CompareDirection,
  type GlucoseUnit,
  type ReportComparison,
  type ReportResponse,
} from '@glukoz/shared';
import { fmtGlucose, fmtNumber, fmtPercent } from '../../lib/format';
import { Card, Stat } from '../../components/ui';
import { TirStackedBar, type SegmentKey } from '../../components/charts/TirStackedBar';

const DIRECTION_ICON: Record<CompareDirection, string> = {
  better: '▲',
  worse: '▼',
  same: '=',
  neutral: '•',
};
const DIRECTION_CLASS: Record<CompareDirection, string> = {
  better: 'text-ok',
  worse: 'text-very-high',
  same: 'text-muted',
  neutral: 'text-muted',
};

export function CompareBadge({
  cmp,
  metric,
  suffix = '',
}: {
  cmp?: ReportComparison;
  metric: string;
  suffix?: string;
}) {
  const { t, i18n } = useTranslation();
  const m = cmp?.metrics.find((x) => x.key === metric);
  if (!m || m.diff === null) return null;
  const sign = m.diff > 0 ? '+' : '';
  return (
    <span className={`num text-xs ${DIRECTION_CLASS[m.direction]}`}>
      <span aria-hidden>{DIRECTION_ICON[m.direction]} </span>
      {sign}
      {fmtNumber(m.diff, 1, i18n.language)}
      {suffix} · {t(`compare.${m.direction}`)}
    </span>
  );
}

export function SummarySection({
  report,
  cmp,
  unit,
}: {
  report: ReportResponse;
  cmp?: ReportComparison;
  unit: GlucoseUnit;
}) {
  const { t, i18n } = useTranslation();
  const s = report.stats;
  const meanDiff = cmp?.metrics.find((m) => m.key === 'mean');
  return (
    <Card title={t('reports.sections.summary')}>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Stat
          label={t('reports.mean')}
          value={fmtGlucose(s.mean, unit, i18n.language)}
          hint={
            <>
              {unitLabel(unit)} {meanDiff && <CompareBadge cmp={cmp} metric="mean" />}
            </>
          }
        />
        <Stat
          label={t('reports.gmi')}
          value={s.gmiPercent === null ? '–' : fmtPercent(s.gmiPercent, i18n.language)}
          hint={
            <>
              {t('reports.gmiMmol', { value: s.gmiMmolMol ?? '–' })}{' '}
              <CompareBadge cmp={cmp} metric="gmiPercent" />
            </>
          }
        />
        <Stat
          label={t('reports.cv')}
          value={fmtPercent(s.cv, i18n.language)}
          hint={
            <>
              {t('reports.cvGoal')} <CompareBadge cmp={cmp} metric="cv" />
            </>
          }
        />
        <Stat
          label={t('reports.sufficiency')}
          value={fmtPercent(s.sufficiencyPercent, i18n.language)}
          hint={<CompareBadge cmp={cmp} metric="sufficiencyPercent" />}
        />
        <Stat label={t('reports.sensorDays')} value={`${report.sensorDays} / ${report.days}`} />
      </dl>
      {cmp && <p className="mt-3 text-xs text-muted">{t('compare.note')}</p>}
    </Card>
  );
}

type Goal = { ok: boolean; text: string };

export function tirGoals(
  report: ReportResponse,
  fmt: (v: number) => string,
  t: (k: string, o?: Record<string, unknown>) => string,
): Partial<Record<SegmentKey, Goal>> {
  const g = TIR_GOALS.general;
  const r = report.tir;
  const below = r.veryLow.percent + r.low.percent;
  const above = r.high.percent + r.veryHigh.percent;
  return {
    veryLow: {
      ok: r.veryLow.percent < g.veryLowMax,
      text: t('reports.goalLt', { v: fmt(g.veryLowMax) }),
    },
    low: {
      ok: below < g.lowTotalMax,
      text: t('reports.goalBelowTotal', { v: fmt(g.lowTotalMax) }),
    },
    inRange: {
      ok: r.inRange.percent > g.inRangeMin,
      text: t('reports.goalGt', { v: fmt(g.inRangeMin) }),
    },
    high: {
      ok: above < g.highTotalMax,
      text: t('reports.goalAboveTotal', { v: fmt(g.highTotalMax) }),
    },
    veryHigh: {
      ok: r.veryHigh.percent < g.veryHighMax,
      text: t('reports.goalLt', { v: fmt(g.veryHighMax) }),
    },
  };
}

export function TirSection({ report, cmp }: { report: ReportResponse; cmp?: ReportComparison }) {
  const { t, i18n } = useTranslation();
  const goals = tirGoals(report, (v) => fmtPercent(v, i18n.language), t);
  return (
    <Card title={t('reports.sections.tir')}>
      <TirStackedBar tir={report.tir} variant="vertical" goals={goals} />
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <span>
          {t('ranges.inRangeShort')}:{' '}
          <CompareBadge cmp={cmp} metric="inRange" suffix={` ${t('compare.points')}`} />
        </span>
        <span>
          {t('ranges.tightRange')}:{' '}
          <strong className="num">
            {fmtPercent(report.tir.tightRange.percent, i18n.language)}
          </strong>
        </span>
        <span>
          {t('ranges.inTarget', { low: report.targetLow, high: report.targetHigh })}:{' '}
          <strong className="num">{fmtPercent(report.tir.inTarget.percent, i18n.language)}</strong>
        </span>
      </div>
    </Card>
  );
}
