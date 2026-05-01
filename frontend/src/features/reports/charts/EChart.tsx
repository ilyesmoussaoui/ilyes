import { useRef, useEffect } from 'react';
import * as echarts from 'echarts';
import type { EChartsOption, ECharts } from 'echarts';
import { cn } from '../../../lib/cn';
import { Skeleton } from '../../../components/ui/Skeleton';

export interface EChartProps {
  option: EChartsOption;
  height?: number;
  loading?: boolean;
  className?: string;
  onChartClick?: (params: echarts.ECElementEvent) => void;
}

/** Color palette matching the design system tokens */
export const CHART_COLORS = [
  '#2563EB', // primary-500
  '#16A34A', // success
  '#D97706', // warning
  '#DC2626', // danger
  '#0284C7', // info
  '#5A8EFF', // primary-400
  '#8AB3FF', // primary-300
  '#64748B', // neutral-500
  '#94A3B8', // neutral-400
  '#475569', // neutral-600
] as const;

export function EChart({ option, height = 400, loading, className, onChartClick }: EChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ECharts | null>(null);

  // Initialize chart instance once on mount; dispose on unmount.
  useEffect(() => {
    if (!containerRef.current) return;
    const instance = echarts.init(containerRef.current, undefined, { renderer: 'canvas' });
    chartRef.current = instance;

    const observer = new ResizeObserver(() => {
      instance.resize({ animation: { duration: 200 } });
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      instance.dispose();
      chartRef.current = null;
    };
  }, []);

  // Update chart option whenever it changes.
  useEffect(() => {
    const instance = chartRef.current;
    if (!instance) return;

    const mergedOption: EChartsOption = {
      color: [...CHART_COLORS],
      textStyle: {
        fontFamily: 'Inter, system-ui, sans-serif',
      },
      grid: {
        left: 12,
        right: 12,
        top: 40,
        bottom: 12,
        containLabel: true,
      },
      tooltip: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
        textStyle: {
          color: '#F8FAFC',
          fontSize: 12,
          fontFamily: 'Inter, system-ui, sans-serif',
        },
        borderWidth: 1,
        borderRadius: 8,
        padding: [8, 12],
      },
      ...option,
    };

    instance.setOption(mergedOption, true);
  }, [option]);

  // Bind/unbind click handler when it changes.
  useEffect(() => {
    const instance = chartRef.current;
    if (!instance) return;

    // Remove any previously registered click handler before re-registering.
    instance.off('click');
    if (onChartClick) {
      instance.on('click', onChartClick);
    }

    return () => {
      instance.off('click');
    };
  }, [onChartClick]);

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center', className)} style={{ height }}>
        <div className="flex flex-col items-center gap-3 w-full px-8">
          <Skeleton variant="text" lines={1} width="40%" />
          <Skeleton variant="text" lines={1} width="100%" />
          <Skeleton variant="text" lines={1} width="85%" />
          <Skeleton variant="text" lines={1} width="95%" />
          <Skeleton variant="text" lines={1} width="70%" />
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      dir="ltr"
      className={cn('w-full', className)}
      style={{ height }}
      role="img"
      aria-label="Chart"
    />
  );
}
