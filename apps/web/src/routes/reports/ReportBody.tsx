import { useTranslation } from 'react-i18next';
import type { GlucoseUnit, ReportComparison, ReportResponse } from '@glukoz/shared';
import { Card } from '../../components/ui';
import { AgpChart } from '../../components/charts/AgpChart';
import { DailySmallMultiples } from '../../components/charts/DailySmallMultiples';
import { HourDayHeatmap } from '../../components/charts/HourDayHeatmap';
import { SummarySection, TirSection } from './SummarySections';
import { EventsSection } from './EventsSection';
import { AdvancedSection, MealsSection, PeriodsSection } from './AnalysisSections';

interface Props {
  report: ReportResponse;
  cmp?: ReportComparison;
  unit: GlucoseUnit;
  print?: boolean;
}

export function InsufficientDataWarning({ report }: { report: ReportResponse }) {
  const { t } = useTranslation();
  if (!report.insufficientData) return null;
  return (
    <div
      role="alert"
      className="rounded-md border border-high bg-warn-bg px-3 py-2 text-sm font-semibold text-warn-text"
    >
      ⚠ {t('reports.insufficient', { value: Math.round(report.stats.sufficiencyPercent) })}
    </div>
  );
}

/** Rapor bölümleri SPEC 11.2 sırasıyla (ekran ve yazdırma ortak). */
export function ReportBody({ report, cmp, unit, print }: Props) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <InsufficientDataWarning report={report} />
      <SummarySection report={report} cmp={cmp} unit={unit} />
      <TirSection report={report} cmp={cmp} />
      <Card title={t('reports.sections.agp')} className={print ? 'print-break' : ''}>
        <p className="mb-2 text-xs text-muted">{t('reports.agp.legend')}</p>
        <div data-testid="agp-chart">
          <AgpChart
            agp={report.agp}
            unit={unit}
            targetLow={report.targetLow}
            targetHigh={report.targetHigh}
          />
        </div>
      </Card>
      <Card title={t('reports.sections.daily')}>
        <DailySmallMultiples
          days={report.daily}
          tz={report.timezone}
          unit={unit}
          targetLow={report.targetLow}
          targetHigh={report.targetHigh}
        />
      </Card>
      <EventsSection report={report} unit={unit} />
      <PeriodsSection report={report} unit={unit} />
      <Card title={t('reports.sections.heatmap')}>
        <HourDayHeatmap cells={report.heatmap} unit={unit} />
      </Card>
      <MealsSection report={report} unit={unit} />
      <AdvancedSection report={report} unit={unit} />
    </div>
  );
}
