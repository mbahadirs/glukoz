import { useTranslation } from 'react-i18next';
import { TREND_CODES, TREND_SYMBOLS } from '@glukoz/shared';

export function TrendArrow({
  trend,
  className,
}: {
  trend: number | null | undefined;
  className?: string;
}) {
  const { t } = useTranslation();
  const code = TREND_CODES[(trend ?? 0) as keyof typeof TREND_CODES] ?? 'NOT_COMPUTABLE';
  return (
    <span
      className={className}
      role="img"
      aria-label={t(`trend.${code}`)}
      title={t(`trend.${code}`)}
    >
      {TREND_SYMBOLS[trend ?? 0] ?? '–'}
    </span>
  );
}
