import { cn } from '@/lib/utils';

export interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  /** stroke color (any CSS color) */
  color?: string;
  /** fill area under the line */
  area?: boolean;
  strokeWidth?: number;
  className?: string;
  /** Color automatically: green if last >= first, red otherwise */
  auto?: boolean;
}

/**
 * Pure-SVG sparkline. Server-safe (no hooks), deterministic.
 */
export function Sparkline({
  data,
  width = 120,
  height = 36,
  color,
  area = true,
  strokeWidth = 1.75,
  className,
  auto = true,
}: SparklineProps) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = strokeWidth;
  const stepX = (width - pad * 2) / (data.length - 1);

  const points = data.map((v, i) => {
    const x = pad + i * stepX;
    const y = pad + (1 - (v - min) / range) * (height - pad * 2);
    return [x, y] as const;
  });

  const path = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const areaPath = `${path} L${points[points.length - 1][0].toFixed(2)},${height} L${points[0][0].toFixed(2)},${height} Z`;

  const up = data[data.length - 1] >= data[0];
  const stroke = color ?? (auto ? (up ? '#34D399' : '#FB7185') : '#F0B90B');
  const gradId = `spark-${stroke.replace('#', '')}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={cn('overflow-visible', className)}
      aria-hidden
      focusable="false"
    >
      <defs>
        <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      {area && <path d={areaPath} fill={`url(#${gradId})`} />}
      <path d={path} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r={strokeWidth + 0.5} fill={stroke} />
    </svg>
  );
}
