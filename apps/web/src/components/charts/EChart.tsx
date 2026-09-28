import { useEffect, useId, useRef, type ComponentProps } from 'react';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import type { EChartsCoreOption } from 'echarts/core';
import { echarts } from './echarts';

/** Grafik alanına tıklanınca veri koordinatları ([x, y]) ve piksel dönüştürücüsü. */
export interface ChartClick {
  data: [number, number];
  toPixel: (value: [number, number]) => [number, number] | null;
  pixel: [number, number];
}

type ChartInstance = Parameters<
  NonNullable<ComponentProps<typeof ReactEChartsCore>['onChartReady']>
>[0];

interface Props {
  option: EChartsCoreOption;
  /** ekran okuyucu için metin özeti */
  summary: string;
  label: string;
  height?: number | string;
  className?: string;
  onChartClick?: (click: ChartClick) => void;
}

/** Tüm grafiklerin ortak sarmalayıcısı: animasyonsuz, SVG, `aria-describedby` özetli. */
export function EChart({ option, summary, label, height = 280, className, onChartClick }: Props) {
  const id = useId();
  const clickRef = useRef(onChartClick);
  useEffect(() => {
    clickRef.current = onChartClick;
  }, [onChartClick]);

  const onReady = (chart: ChartInstance) => {
    chart.getZr().on('click', (e: { offsetX: number; offsetY: number }) => {
      const handler = clickRef.current;
      if (!handler) return;
      const pixel: [number, number] = [e.offsetX, e.offsetY];
      if (!chart.containPixel('grid', pixel)) return;
      const data = chart.convertFromPixel('grid', pixel) as [number, number];
      handler({
        data,
        pixel,
        toPixel: (v) => (chart.convertToPixel('grid', v) as [number, number] | undefined) ?? null,
      });
    });
  };

  return (
    <figure className={className} style={{ margin: 0 }}>
      <div role="img" aria-label={label} aria-describedby={id} data-chart="ready">
        <ReactEChartsCore
          echarts={echarts}
          option={{ animation: false, aria: { enabled: true }, ...option }}
          notMerge
          lazyUpdate
          style={{ height, width: '100%' }}
          opts={{ renderer: 'svg' }}
          onChartReady={onReady}
        />
      </div>
      <figcaption id={id} className="sr-only">
        {summary}
      </figcaption>
    </figure>
  );
}
